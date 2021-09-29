"use strict";
/*
 * Remote Radio
 * MIT License 2020
 *
 */
 // Issues: 
 //
const debugLevel = "3";
const SERVER = "p2pstudio.herokuapp.com";
const STUDIO_ID = "SourceFMStudio";
var remoteStudioID = STUDIO_ID;
const NUM_SAMPLERS = 6;
const CALL_IN_NUM_SAMPLERS=2;
// time to leave before attempting reconnect if disconnected...
const reconnectInterval = 30000;
///
///
///
var conn = null;            // connection to studio
var connectedPeers = [];    // list of connected peers
var theGain = null;          //
var themicMediaStream = null; // media stream from mic input
var outputBuss = null;    // send all audio through here
var micToSpeakerCheckBox;
var accessedAudio = false;    // have we got permission from getUserMedia
var theAudioContext;          // global audio context used by everything
var mixedAudio = null;        // holds the merged audio
var micMediaStream;           // audio from user's mic
var mic;                      // RRMicrophone object
// Two RRPlayers
var playerLeft;
var playerRight;
var samplers = [];            // Array of RRSamplers
var crossfader;               // RRCrossfader
var meter;
var remoteConnections = [];   // guest remote presenters
var remoteBuss = null;

var constraints = {
    audio: {
         sampleRate:        44100,
         sampleSize:        16,
         channelCount:      2,         // try and get stereo
         echoCancellation:  false,
         noiseSuppression:  false,
         autoGainControl:   false,
        // mandatory:{googAutoGainControl: false}
    },
    video: false
};
var sendMicToSpeakers = false;  // output mic input to default audio device
// RRRecorder object and audio buss to send to it
var theRecorder;
var recorderBuss;
//var errorDiv;
// if a dialog box is open - useful to stop key shortcuts
var dialogOpened = false;
var peer, peerHandler;          // Peer from Peer.js, and PeerHandler object

const ConnectionStatus = {
  DISCONNECTED: 0, // no connection to anything
  PEER: 1,         // we have a peer object
  CONNECTING: 2,   // trying to connect
  CONNECTED: 3,    // connected to remote computer
};
var studioConnectionStatus = ConnectionStatus.DISCONNECTED;

//
// HTML Elements
//
var statusReportDiv = null;
var isConnected = false;
var studioConnectionStatusDiv = null;
var connectionSettingsButton = null;
var outputSettingsButton = null;
var speakerSelect = null;
var audioInputSelection;        // select menu with audio input devices
var recordingSettingsButton = null;

const RRMode = {
  STUDIO: 0,        // Full studio mode
  CALL_IN: 1,       // for interviews - no decks, less samplers
  REMOTE_GUEST: 2,  // someone calling in
  LINK: 3,          // direct link, basic interface with talkback
  SERVER: 4,        // server mode
};
var remoteRadioMode = RRMode.STUDIO;
/*
 * Utility functions...
 */
// turn seconds into "HH:MM:SS" string
function createHMS(t) {
    if (t == "Infinity")
        return "--:--:--";
  return new Date(t*1000).toISOString().substr(11, 8);
}
// Report errors
function RRError(e) {
  console.error(e);
}
// For debugging purposes
function RRDebug(str) {
  console.debug(str);
}
function  dbToGain(db) {
  return Math.exp(db*Math.log(10.0)/20.0);
}
// work around Chrome to maintain connection to server
// not sure if this required any longer..?
var resumeAudio = function() {
  if (typeof theAudioContext == "undefined" || theAudioContext == null)
    return;
  if (theAudioContext.state == "suspended")
    theAudioContext.resume();
  document.removeEventListener("click", resumeAudio);
};
function hideHTMLElement(el){
  el.classList.add("notDisplayed");
}
/*
 * Web Audio
 *
 */
//
// Called when we get permission to access audio from end-user
//
function onUserMediaSuccess(s) {
  //notSupported.style.visibility = "hidden";
  notSupported.classList.add("byebye"); // remove splash screen
  document.getElementById("RemoteRadio").classList.remove("disabledRR");
  // get audio devices
  navigator.mediaDevices.enumerateDevices()
    .then(gotDevices)
    .catch((e) => RRError(e));
  accessedAudio = true;
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  theAudioContext = new AudioContext();
  // set up busses
  outputBuss = theAudioContext.createGain();
  outputBuss.connect(theAudioContext.destination);

  mixedAudio = theAudioContext.createMediaStreamDestination();
  // remote buss we send to remote guests (switch between PGM and TALK)
  remoteBuss = theAudioContext.createGain();

  recorderBuss = theAudioContext.createGain();
  recorderBuss.connect(mixedAudio);
  if (remoteRadioMode == RRMode.STUDIO) {
    crossfader = new RRCrossfader(playerLeft, playerRight);
  } else {
    hideHTMLElement(document.getElementById("songs"));
  }
	mic = new RRMicrophone(s);
	micMediaStream = s;
	mic.connect(/* mixedAudio */ recorderBuss);

  if (remoteRadioMode != RRMode.REMOTE_GUEST) {
	 theRecorder = new RRRecorder(mixedAudio.stream);
  } else {
    hideHTMLElement(document.getElementById("RRRecorder"));
    hideHTMLElement(document.getElementById("cartH1"));
  }

  meter = new RRVolumeMeter(document.getElementById("meter"), theAudioContext, recorderBuss, false, "horizontal");
  remoteConnections[0] = new RemoteConnection();
}

// Called if we can't get an audio input from getUserMedia
//
//
function onUserMediaError(e){
	document.getElementById("badBrowser").style.visibility = "visible";
	document.getElementById("riskyClick").addEventListener("click", (e) => {
		document.getElementById("badBrowser").style.visibility = "hidden";
		onUserMediaSuccess(null);
	});
	RRError("Could not get User Media from Browser: "+e);
	statusReport("Unable to get User Media: "+e);
}
// shows a toast with info
function statusReport(str) {
    statusReportDiv.innerHTML = str;
    statusReportDiv.classList.add('show');
    setTimeout(function() { statusReportDiv.classList.remove('show'); }, 3000);
}
//
// one time initialisation of audio
function initialiseAudio() {
  if (Config.micDeviceId && Config.micDeviceId !== "null") {
   // console.log(typeof Config.micDeviceId);
   RRDebug("Attempting to get device, id of: " + Config.micDeviceId);
   constraints = {
    audio: { 
      deviceId: { exact: Config.micDeviceId },
      sampleRate: 48000,
      sampleSize: 16,
      channelCount: 2,         // try and get stereo
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
        // mandatory:{googAutoGainControl: false}
    },
    video: false
   };
  }
  micMediaStream = navigator.mediaDevices.getUserMedia(constraints)
              .then(onUserMediaSuccess)
              .catch(onUserMediaError);
}

// get all the HTML elements we need into variables
function initialiseDOM() {
  document.addEventListener("click", resumeAudio);  // keep audio alive for Chrome
  document.addEventListener("keydown", handleKeys);
  let b = document.getElementById("connectButton");
  b.addEventListener("click", connectToStudio);
  studioConnectionStatusDiv = document.getElementById("studioConnectionStatus");
  audioInputSelection = document.getElementById("audioInputSelection");
  audioInputSelection.addEventListener("change", onAudioInputChanged);
  connectionSettingsButton = document.getElementById("connectionSettingsButton");
  connectionSettingsButton.addEventListener("click", onConnectionSettingsClick);
  outputSettingsButton = document.getElementById("outputSettingsButton");
  outputSettingsButton.addEventListener("click", outputSettingsButtonClick);
  speakerSelect = document.getElementById("speakerSelect");
  recordingSettingsButton = document.getElementById("recordingSettingsButton");
  recordingSettingsButton.addEventListener("click", recordingSettingsButtonClick);
  statusReportDiv = document.getElementById("statusReport");
}

// handle keyboard shortcuts
function handleKeys(e){
if (dialogOpened) return;

  switch (e.key) {
    case 't':
      meter.dump();
      break;
    case 'a':
    case 'A':
      if (playerLeft){
        playerLeft.onClick();
      }
      break;
    case 'q':
    case 'Q':
      if (playerLeft){
        playerLeft.eject();
      }
      break;
    case 'L':
    case 'l':
      if (playerRight){
        playerRight.onClick();
      }
      break;
    case 'p':
    case 'P':
      if (playerRight){
        playerRight.eject();
      }      
      break;
    case 'm':
    case 'M':
      // turn mic on/off
      if (mic){
        mic.switch();
      }
      break;
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
      let s = parseInt(e.key) - 1;
      if (samplers[s]){
        samplers[s].onClick();
      }
      break;
    case 'n': // toggle sending mic input to headphones/speakers
        mic.switchSpeakerOutput();
        break;

    case "ArrowLeft": // left arrow
    case "Left":
		if (crossfader) crossfader.moveLeft();
		break;
	case "ArrowRight": // left arrow
    case "Right":
		if (crossfader) crossfader.moveRight();
    	break;
    default:
      break;
  }
}
//
function connectToStudio(){
	peerHandler.connectToStudio();
}
// user has selected a different audio input device
function onAudioInputChanged(e){
  var constraints = {
	  audio: { 
			deviceId: { exact: e.target.value },
      sampleRate: 48000,
      sampleSize: 16,
      channelCount: 2,         // try and get stereo
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
        // mandatory:{googAutoGainControl: false}
    },
    video: false
  };
  Config.micDeviceId = e.target.value;
  saveStorage();
  mic.disconnectFromSpeaker();
  mic.disconnect();
  if (!mic.muted) mic.mute();

  micMediaStream.getTracks().forEach(function(track) {
		track.stop();
	});
  statusReport("Switching to new microphone...");
	micMediaStream = navigator.mediaDevices.getUserMedia(constraints).then(newMic).catch();
  document.getElementById("micSettingsDialog").open = false;
}
// initialise mic object
function newMic(s) {
	micMediaStream = s;
	mic.changeInput(s);
	mic.connect(/*mixedAudio */ recorderBuss);
}
// main
window.addEventListener("load", (e) => {
  const urlParams = new URLSearchParams(window.location.search); 
  for (const [key, value] of urlParams) {
    // console.log(key + "=" + value);
    if (key === "peer") { // connected as remote guest
      var remotePeerID = value;
      //callRemotePeer(remotePeerID);
      remoteRadioMode =  RRMode.REMOTE_GUEST;
    } else if (key === "mode") {
      switch (value) {
        case "direct":
          remoteRadioMode = RRMode.LINK;
          break;
        case "interview":
          remoteRadioMode = RRMode.CALL_IN;
          break;
        default:
          remoteRadioMode = RRMode.STUDIO;
          break;
      }
    }
  }
  initialiseAudio();
  // if studio mode we need:
  // 2 decks, array of samplers, crossfader
  switch (remoteRadioMode) {
    case RRMode.STUDIO:
      playerLeft  = new RRPlayer();
      playerRight = new RRPlayer();
      for (let i = 0; i < NUM_SAMPLERS; i++){
        samplers[i] = new RRSampler();
      }
      break;
    case RRMode.LINK:
      break;
    case RRMode.CALL_IN:
      for (let i = 0; i < CALL_IN_NUM_SAMPLERS; i++){
        samplers[i] = new RRSampler();
      }
      break;
    case RRMode.REMOTE_GUEST:
      break;
  }
  // errorDiv = document.getElementById("errorDiv");  
  // takeConsole();
  peer = new Peer({ host: SERVER, port:'', debug: debugLevel });
  peerHandler = new PeerHandler(peer);
  initialiseDOM();
  document.addEventListener("dragover", (e) => { e.preventDefault(); });
  document.addEventListener("drop", (e) => { e.preventDefault();
    if (remoteRadioMode == RRMode.STUDIO) playerLeft.filePicked(e.dataTransfer.files);
  });
});

function recordingSettingsButtonClick(e) {
  let d = document.getElementById("recordingSettingsDialog");
  let t = document.getElementById("recordingTitle");
  t.value = theRecorder.title;
  let c = document.getElementById("addDateToRecordingCheckbox");
  c.checked = theRecorder.addDateToTitle;
  let b = document.getElementById("recordingSettingsDialogButton");

  b.addEventListener("click", (e) => {
    dialogOpened = false;
 
    if (t.value !== "") {
      theRecorder.title = t.value;
    }
    theRecorder.addDateToTitle = c.checked;
  });

  d.showModal();
  dialogOpened = true;
}
// called when the connection settings button is clicked
// open the dialog and get the new server string, if any
//
function onConnectionSettingsClick(e) {

  var d  = document.getElementById("settingsDialog");
  let b = document.getElementById("settingsDialogButton");
  let t = document.getElementById("serverText");
  t.value = remoteStudioID;
  var radios = document.getElementsByName("bitrate");
  b.addEventListener("click", (e) => {
    dialogOpened = false;
    connectToNewPeer(t.value);
    radios.forEach((radio) => {
      if (radio.checked) {
        switch (radio.value) {
          case "low":
            Config.bitrate = 20;
            Config.stereo = 0;
            break;
          case "medium":
            Config.bitrate = 144;
            Config.stereo = 1;
            break;
          case "high":
            Config.bitrate = 320;
            Config.stereo = 1;
            break;
        }
      }
    });
  });
  d.showModal();
  dialogOpened = true;
}
// called when the audio output settings button is clicked
// open the dialog and get the new audio device id and connect
// to the new output device
function outputSettingsButtonClick(e) {
  var d = document.getElementById("outputSettingsDialog");
  let b = document.getElementById("outputSettingsDialogButton");

  if (speakerSelect.length <=1) {
	  hideHTMLElement(speakerSelect);
	  document.getElementById("outputLabel").innerHTML = "<p>You only have one possible audio output...</p>";
  }
  b.addEventListener("click", (e) => {
    dialogOpened = false;
    // TODO implement output selection
  });
  d.showModal();
  dialogOpened = true;
}

// User has supplied a new peer id for the studio 
// If connected: close the old connection and open new one
// otherwise update remoteStudioID
function connectToNewPeer(p) {
  // TODO
  RRDebug(p);
  remoteStudioID = p;
}
/*
function takeConsole () {
    console.defaultError = console.error.bind(console);
    console.errors = [];
    console.error = function() {
        RRError(arguments);
        // default &  console.error()
        console.defaultError.apply(console, arguments);
        // new & array data
        console.errors.push(Array.from(arguments));
    };
}
*/
// update the connection status 
function setStudioConnectionStatus(status) {
  studioConnectionStatus = status;
  let s = studioConnectionStatusDiv;
  s.classList.remove("Connecting");
  s.classList.remove("Connected");

  switch (status) {
    case ConnectionStatus.DISCONNECTED:
      s.textContent = "Disconnected";
      isConnected = false;
      connectButton.disabled = false;
      // RRDebug("Connection to studio lost...");
      break;
    case ConnectionStatus.PEER:
      s.textContent = "Ready...";
      connectButton.disabled = false;
      break;
    case ConnectionStatus.CONNECTING:
      s.textContent = "Connecting...";
      s.classList.add("Connecting");
      connectButton.disabled = true;
      break;
    case ConnectionStatus.CONNECTED:
      s.textContent = "Connected";
      s.classList.add("Connected");
      isConnected = true;
      connectButton.disabled = true;
      //connectButton.value = "Disconnect";
      break;
    default:
      RRDebug("Unknown value for Connection Status passed to setStudioConnectionStatus");
      break;
    }
}
//
// where all the action happens to alter quality of streams
// streams we may need -> 
//    + stream to studio - high bitrate, stereo
//    + talkback stream - low bitrate, mono
//    + remote guest stream(s): med/high bitrate, mono
//
// important sdp lines we need to alter/add:
// a=rtpmap: opus/48000/2 - get opus codec at 48k sample rate stereo
// b=AS: Config.bitrate - set the bandwidth
// a=fmtp: - set the codec options:
//    x-google-min-bitrate, x-google-max-bitrate=Config.bitrate - for Chrome set bitrate bounds
//    maxeveragebitrate=Config.bitrate*1024 - sdp spec bitrate (in k)
//    cbr=1 - constant bit rate boolean - we want yes
//    dty=1 - yes
//    nostd=1 - yes
//    usedtx=0 - no
//    stereo=0/1 - send stereo sound
//    sprop-stereo=1 - receive stereo
//    
// configs -
// bitrate=24 mono - talkback, 144, stereo - music, 256 mono - high speech, 320 stereo - max, 80 mono (default)
function doSdpTransform(sdp, overridester=0, bitrate) {
  if (!bitrate)
    bitrate = Config.bitrate;

  RRDebug("bitrate: "+ bitrate);
  const media="audio";
  var lines = sdp.split("\n");
  var line = -1;
  var fmtline = -1;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf("m="+media) === 0) {
      line = i;
      // break;
    }
    if (lines[i].indexOf("a=fmtp") === 0)
      fmtline = i;
  }
  if (line === -1) {
    console.debug("Could not find the m line for", media);
   // return sdp;
  }
  if (fmtline !== -1) {
  //  console.debug("Found fmtp: " + lines[fmtline]);
    // FIX FIX FIX
    lines[fmtline]=lines[fmtline].trim();
    lines[fmtline]=lines[fmtline].concat('; stereo='+Config.stereo+'; maxaveragebitrate='+bitrate*1024+'; sprop-stereo=1; x-google-max-bitrate='
      +bitrate+ '; x-google-min-bitrate='+bitrate+'; cbr=1; nostd=1; usedtx=0; dty=1');
    console.debug("FMTP: "+lines[fmtline]);
  }
  //console.debug("Found the m line for", media, "at line", line);
 
  // Pass the m line
  line++;
 
  // Skip i and c lines
  while (lines[line].indexOf("i=") === 0 || lines[line].indexOf("c=") === 0) {
    line++;
  }
 
  // If we're on a b line, replace it
  if (lines[line].indexOf("b") === 0) {
    //console.debug("Replaced b line at line", line);
    lines[line] = "b=AS:"+bitrate;// + bitrate;
  }
  sdp = lines.join("\n");
  //console.log("SDP = "+sdp);
  return sdp;
}
/////////////////////////////////////////////////////////////////////////////////////
//
// PeerHandler class
// wrapper to handle all the peer to peer stuff
//
class PeerHandler {

    // setup callbacks for peer
    constructor(p) {
        this.remoteConnections=[];
        this.peer = p;
        this.newPeer(p);
    }

    newPeer(peer) {
        heartbeater = makePeerHeartbeater(this.peer);

        // callbacks
        this.peer.on("open",   // called when server connection established
          function(id) {
                RRDebug("My peer ID is: " + id);
                setStudioConnectionStatus(ConnectionStatus.PEER);
                // statusReport("Connected to internet, peer ID = " + id);
             }
        );
        this.peer.on("call",   // when we get an incoming call - i.e. remote guest
          function(mediaConnection) {
            mediaConnection.answer(remoteBuss.stream, {sdpTransform: doSdpTransform});
            // send audio pgm or talk buss
            mediaConnection.on("stream", function() {
                RRDebug("In mediaconnection on stream...");
                // setStudioConnectionStatus(ConnectionStatus.CONNECTED);
                this.remoteConnections[mediaConnection.peer] = 1;
              }
            );

            mediaConnection.on("close", function() {
                hangUp();
                RRDebug("Connection closed");
                statusReport("Lost connection mediaConnection closed...");
                // TODO try and reconnect to peer
                // setStudioConnectionStatus(ConnectionStatus.PEER);
                delete this.remoteConnections[mediaConnection.peer];
              }
            );
          }
        );
        this.peer.on("connection",   // incoming data connection
            function(c) {
               RRDebug("Received data " + c);
               if (connectedPeers[c.peer] !== 1) { // not connected to this peer
                    connectedPeers[c.peer] = 1;
                    conn = c;
                    //createPeerList(c);
                    isConnected = true;
                    setStudioConnectionStatus(ConnectionStatus.CONNECTED);

                    c.on("data",
                        // received data
                        function(data) {
                            RRDebug("Received data: " + data);
                            statusReport("Message from studio server: <br /> "+data);
                            // chatDiv.innerHTML += "<span class='incomingText'>" + c.peer + " : " + data + "</span><br />";
                            c.on("close",
                                function() {
                                    statusReport("Connection lost to "+c.peer);
                                    setStudioConnectionStatus(ConnectionStatus.PEER);
                                    delete connectedPeers[c.peer];
                                }
                            );
                        }
                    );
                    c.on("open", // connection is ready to use
                        function() {
                            setStudioConnectionStatus(ConnectionStatus.CONNECTED);
                        }
                    );
                    c.on("error",
                        function(err) {
                            //RRError("Connection error: " + err);
                            statusReport(err);
                        }
                    );
                    c.on("close", // remote connection has been closed
                        function() {
                            //
                            isConnected = false;
                            delete connectedPeers[c.peer];
                            setStudioConnectionStatus(ConnectionStatus.PEER);
                            statusReport("Connection closed...");
                        }
                    );
                }
                connectedPeers[c.peer] = 1;
                }
        );
        this.peer.on("close",
          // peer is destroyed
            function() {
                RRDebug("Peer destroyed");
                statusReport("Not connected - check internet connection");
                this.peer = null;
                setStudioConnectionStatus(ConnectionStatus.DISCONNECTED);
            }
        );
        this.peer.on("error",
            function(err) {
                RRError("this.peer.on error: " + err);
                statusReport(err);
                hangUp();
                setStudioConnectionStatus(ConnectionStatus.PEER);
            }
        );
        this.peer.on("disconnected",
        // disconnnected from server
            function() {
                statusReport("Disconnected from internet... retrying");
                setStudioConnectionStatus(ConnectionStatus.DISCONNECTED);
                isConnected = false;
                if (this.peer) {
                    setTimeout(this.reconnect, reconnectInterval);
                } else {
                  RRDebug("No peer - attempting to recreate...");
                  this.peer = new Peer({ host: SERVER, port:'', debug: debugLevel });
                  setTimeout(this.reconnect, reconnectInterval);
                  //peerHandler = new PeerHandler(peer);
                }
                // disconnect from connections???
            }
        );
    }
    
    reconnect() {
      setStudioConnectionStatus(ConnectionStatus.CONNECTING);
      try {
        if (this.peer)
          this.peer.reconnect();
        else {
          this.peer = new Peer({ host: SERVER, port:'', debug: debugLevel });
          //peerHandler = new PeerHandler(peer);
          this.newPeer(this.peer);
        }
      } catch (e) {
        setTimeout(this.reconnect, reconnectInterval);
      }
    }

    connectToStudio(){
		  this.connectToPeer(remoteStudioID);
    }

    // connect to peer with id
    connectToPeer(id) {
		  setStudioConnectionStatus(ConnectionStatus.CONNECTING);
      if (connectedPeers[id] === 1 || id === this.peer.id) {
        RRError("Already connected. Ignoring request...");
        return;
      }
      conn = this.peer.connect(id);
      conn.on("open",
        function() {
          connectedPeers[id] = 1;
          conn.send("hi!");
          statusReport("Connected to studio");
          conn.on("data",
            function(data) { // received data as initiator
              RRDebug(id + " Received data: " + data);
              statusReport("Message from studio: <br />" + data);
              //chatDiv.innerHTML += "<span class='incomingText'>" + id + " : " + data + "</span><br />";
              //chatDiv.scrollTop = chatDiv.scrollHeight;
            }
          );
          // send our audio to the studio
          setStudioConnectionStatus(ConnectionStatus.CONNECTED);
          //RRDebug("Conn.peer: " + conn.peer + " "+ mixedAudio.stream);
          callRemotePeer(conn.peer, mixedAudio.stream);
        }
      );
      conn.on("close",
        function() {
          RRDebug("Connection lost to " + conn.peer);
          statusReport("Connection lost to studio");
          delete connectedPeers[conn.peer];
          setStudioConnectionStatus(ConnectionStatus.PEER);
        }
      );
      conn.on("error",
        // error could be can't connect
        function(err) {
          delete connectedPeers[conn.peer];
          statusReport("Connection error: "+err);
          setStudioConnectionStatus(ConnectionStatus.PEER);
          RRDebug("Error: " + err);
        }
      );
    }

    send(val) {
      conn.send(val);
      //chatDiv.innerHTML += "<span class='outgoingText'>" + peer.id + val + "</span></br>";
    }
}

// pass the peer instance, and it will start sending heartbeats
var heartbeater; // = makePeerHeartbeater(peer);
const HB_TIMEOUT_INTERVAL = 20000;
function makePeerHeartbeater(peer) {
    var timeoutId = 0;
    function heartbeat() {
        timeoutId = setTimeout(heartbeat, HB_TIMEOUT_INTERVAL);
        if (peer.socket._wsOpen()) {
            peer.socket.send( {type: 'HEARTBEAT'} );
        }
    }
    // Start 
    heartbeat();
    // return
    return {
        start : function() {
            if (timeoutId === 0) { heartbeat(); }
        },
        stop : function() {
            clearTimeout(timeoutId);
            timeoutId = 0;
        }
    };
}
//////////////
//
// call another peer with id
//
function callRemotePeer(id, stream) {
  var call = peerHandler.peer.call(id, stream, {sdpTransform: doSdpTransform});
  RRDebug("Calling: " + call);
  call.on("stream",
    function(s) {
      RRDebug("Receiving stream: " + (s));
      setStudioConnectionStatus(ConnectionStatus.CONNECTED);
      isConnected = true;
      if (s) {
 
      } else {
        // No incoming stream = one way call
      }
    }
  );
  call.on("close", function() {
        hangUp();
  });
  call.on("error",
    function(err) {
      hangUp();
      RRError("Call error: " + err);
    }
  );
}

function hangUp() {
  setStudioConnectionStatus(ConnectionStatus.PEER);
  isConnected = false;
}

function gotDevices(deviceInfos) {
  for (let i = 0; i !== deviceInfos.length; ++i) {
    var deviceInfo = deviceInfos[i];
    //RRDebug(deviceInfo);
    var option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label ||
        'Microphone ' + (audioInputSelection.length + 1);
      audioInputSelection.appendChild(option);
      if (deviceInfo.deviceId == Config.micDeviceId) {
        option.selected = true;
      }
    } else if (deviceInfo.kind === 'audiooutput') {
      option.text = deviceInfo.label || 'Output ' + (speakerSelect.length + 1);
      speakerSelect.appendChild(option);
      if (Config.speakerDeviceId==deviceInfo.deviceId) {
        option.selected = true;
      }
    }
  }

  var types = ["audio/ogg", 
             "audio/webm", 
             "audio/webm;codecs=opus", 
             "audio/mp3",
             "audio/wav",
             "audio/ogg;codecs=opus",
            ];
  var d = document.getElementById("audioFormats");
  d.addEventListener("input", chooseAudioFormat);
  var supportedTypes = [];
  for (var i in types) {
    if (MediaRecorder.isTypeSupported(types[i])) {
      supportedTypes.push(types[i]);
    }
  }
  supportedTypes.forEach((type) => {
      let o = document.createElement("option");
      o.text = type;
      audioFormats.appendChild(o);
    }
  );
}

function chooseAudioFormat(af) {
  theRecorder.recordingFormat = af.target.value;
}

window.addEventListener("beforeunload", (e) => {
  e.preventDefault();
  if (theRecorder.hasRecorded && !theRecorder.hasDownloaded) {
    return (e.returnValue = "You haven't downloaded your recording. Are you sure you want to leave the page..?");
  }
});
