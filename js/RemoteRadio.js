"use strict";
/*
 * Remote Radio
 * MIT License 2021
 *
 */
 // TODO
 // IMPORTANT
 // Make work as a server so can use to connect any two computers rather than just to server
 //
 //
 // Reduce gain on songs
 //
const debugLevel = "0";
const SERVER = "p2pstudio.herokuapp.com";
const STUDIO_ID = "SourceFMStudio";
var   remoteStudioID = STUDIO_ID;
const NUM_SAMPLERS = 6;
const CALL_IN_NUM_SAMPLERS = 2;
const DEFAULT_SAMPLE_RATE = 48000;
const RRMode = {
  STUDIO: "studio",
  CALL_IN: "call_in",          // list of peers wanting to chat
  REMOTE_GUEST: "remote",      // guest has received a link
  LINK: "link",               // OB mode
  SERVER: "server",           // studio server listening for connections...
};
var remoteRadioMode = RRMode.STUDIO;  // set to SERVER to run page as a server...

// time to leave before attempting reconnect if disconnected...
const reconnectInterval = 30000;
///
///
/// Commands to communicate between peers
const RRCommand = {
  TALKBACK:     "_____talkback_____",
  SONG_ENDING:  "_____song_ending_____", 
  LEAVE:        "_____byebye_____", 
};
var studioConnection = null;  // connection to studio
var connectedPeers = [];      // list of connected peers
var themicMediaStream = null; // media stream from mic input
var outputBuss = null;        // send all audio through here before speaker
var micToSpeakerCheckBox;
var accessedAudio = false;    // have we got permission from getUserMedia
var theAudioContext;          // global audio context used by everything
var mixedAudio = null;        // holds the merged audio
var micMediaStream;           // audio from user's mic
var mic;                      // RRMicrophone object
var chatWindow, chatButton;
// Two RRPlayers act as decks
var playerLeft;
var playerRight;
var samplers = [];            // Array of RRSamplers
var crossfader;               // RRCrossfader
var meter;
var remoteConnections = [];   // guest remote presenters
var outgoingRemoteStreamBuss = null;        // audio buss to send to remote computer connections = mic + samplers (not incoming streams)
var talkbackBuss = null;      // audio buss to send low bitrate audio = mic only
var talkbackButton;
var talkingBack = false;      // whether or not we're in talkback mode
var rrModeSwitch = null;
var remoteBussGain;
var incomingRemoteStreamGain;
var audioIncomingStream;
var remotePeerID;             // id of the peer to connect to - TODO change this

var constraints = {
    audio: {
         sampleRate: DEFAULT_SAMPLE_RATE,
         sampleSize: 16,
         channelCount: 2,         // try and get stereo
         echoCancellation: false,
         noiseSuppression: false,
         autoGainControl: false,
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
var guestSettingsButton = null;
var speakerSelect = null;
var audioInputSelection;        // select menu with audio input devices
var recordingSettingsButton = null;
var chatClose=null;
var chatSend;
var chatDiv;
var chatToSendText = null;

/*
 * Utility functions...
 */
// turn seconds into "HH:MM:SS" string
function createHMS(t) {
  if (t == "Infinity") {
    return "--:--:--";
  }
  return new Date(t*1000).toISOString().substr(11, 8);
}
// Report errors
function RRError(e) {
  console.error("Remote Radio: " + e);
 // console.trace(e);
}
// For debugging purposes
function RRDebug(str) {
  console.debug("Remote Radio: " + str);
 // console.trace();
}
// remove html from text to stop chat interface being problematic
function stripHTML(html){
   let doc = new DOMParser().parseFromString(html, 'text/html');
   return doc.body.textContent || "";
}
/*
function  dbToGain(db) {
  return Math.exp(db*Math.log(10.0)/20.0);
}
*/
// work around Chrome to maintain connection to server
var resumeAudio = function() {
  if (typeof theAudioContext == "undefined" || theAudioContext == null) {return;}
  if (theAudioContext.state == "suspended") { theAudioContext.resume(); }
  document.removeEventListener("click", resumeAudio);
};
/*
 *
 *
 */
//
// Called when we get permission to access audio from end-user
//
function onUserMediaSuccess(s) {
  // notSupported.style.visibility = "hidden";
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

  outgoingRemoteStreamBuss = theAudioContext.createMediaStreamDestination();  // remote buss we send to remote guests (switch between PGM and TALK)
  remoteBussGain = theAudioContext.createGain();
  remoteBussGain.connect(outgoingRemoteStreamBuss);

  recorderBuss = theAudioContext.createGain();
  recorderBuss.connect(mixedAudio);
  if (remoteRadioMode == RRMode.STUDIO) {
    crossfader = new RRCrossfader(playerLeft, playerRight);
  } else {
    document.getElementById("songs").style.display = "none";
    // document.getElementById("cartH1").style.display = "none";
  }
	mic = new RRMicrophone(s);
	micMediaStream = s;
	mic.connect(recorderBuss);
  //mic.connect(remoteBussGain);

  if (remoteRadioMode != RRMode.REMOTE_GUEST) {
    // record outgoingRemoteStreamBuss + mixed audio
	 theRecorder = new RRRecorder(mixedAudio.stream);
  } else {
    setRRMode(remoteRadioMode);
  }

  meter = new RRVolumeMeter(document.getElementById("meter"), theAudioContext, recorderBuss, false, "horizontal");
}

// Called if we can't get an audio input from getUserMedia
//
//
function onUserMediaError(e) {
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
// chatButton handler
function onChatButtonClick(e) {
  chatWindow.classList.add("visible");
  chatToSendText.focus();
  dialogOpened = true;
}
// chat dialog
// currently just sends to all connected peers
function onChatSend() {
  let t = chatToSendText;
  let val = t.value;
  if (val === "") {
    RRDebug("Nothing to send in sendChat...");
    return;
  }
  if (studioConnection === null || studioConnection === undefined) {
    if (connectedPeers === null) {
      RRError("No connection...");
      return;
    }
  }
  let h = stripHTML(val);
  t.value = null;
  if (studioConnection != null) {
    studioConnection.send(h);
    statusReport("Sent message <br/ >" + h + "<br /> to " + studioConnection.peerID);
  }
    for (var i in connectedPeers) {
      // RRDebug(i);
      if (i != STUDIO_ID) {
        connectedPeers[i].send(h);
        statusReport("Sent message <br/ >" + h + "<br /> to " + i);
      }
    }

  chatDiv.innerHTML += "<span class='outgoingText'>Me: " + h + "</span><br />";
  chatDiv.scrollTop = chatDiv.scrollHeight;
}
//
function sendChatToAll(msg){
    if (studioConnection != null) {
    studioConnection.send(msg);
  }
    for (var i in connectedPeers) {
      if (i != STUDIO_ID) {
        connectedPeers[i].send(msg);
        statusReport("Sent message <br/ >" + h + "<br /> to " + i);
      }
    }
}
//
// one time initialisation of audio
function initialiseAudio() {
  if (Config.micDeviceId && Config.micDeviceId !== "null") {
   RRDebug("Attempting to get device, id of: " + Config.micDeviceId);
   constraints = {
    audio: { 
      deviceId: { exact: Config.micDeviceId },
      sampleRate: 44100,
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
// when talkback button is clicked
// could be implemented in the future with separate talkbackBuss
// for now just remove mics from recorderBuss
function onTalkbackButtonClick(e) {
  // if (!isConnected)
  //   return;
  if (!connectedPeers) {
    RRError("Attempted talkback with no connected peers.");
    talkbackButton.disabled = true;
    talkingBack = false;
    return;
  }
  if (!talkingBack) {
    talkingBack = true;
    talkbackButton.classList.add("talkingBack");
  } else {
    talkingBack = false;
    talkbackButton.classList.remove("talkingBack");
  }
  // remove mic(s) and remote connection(s) from mediarecorder buss
  // and remove samplers/players from remotestream and output buss
  if (playerLeft) playerLeft.talkback();
  if (playerRight) playerRight.talkback();
  for (let i = 0; i < NUM_SAMPLERS; i++) {
    if (samplers[i]) samplers[i].talkback();
  }
  mic.talkback(talkingBack);
  if (incomingRemoteStreamGain) {
    if (talkingBack) {
      incomingRemoteStreamGain.disconnect(recorderBuss);
    } else {
      incomingRemoteStreamGain.connect(recorderBuss);
    } 
  } else {
      RRDebug("incomingRemoteStreamGain not created");
  }
  if (e != null) {
    for (let i in connectedPeers) {
      connectedPeers[i].talkback(talkingBack);
    }
  }
}

// get all the HTML elements we need into variables
function initialiseDOM() {
  document.addEventListener("click", resumeAudio);  // keep audio alive for Chrome
  document.addEventListener("keydown", handleKeys);
  studioConnectionStatusDiv = document.getElementById("studioConnectionStatus");
  audioInputSelection = document.getElementById("audioInputSelection");
  audioInputSelection.addEventListener("change", onAudioInputChanged);
  connectionSettingsButton = document.getElementById("connectionSettingsButton");
  connectionSettingsButton.addEventListener("click", onConnectionSettingsClick);
  outputSettingsButton = document.getElementById("outputSettingsButton");
  outputSettingsButton.addEventListener("click", outputSettingsButtonClick);
  guestSettingsButton = document.getElementById("guestSettingsButton");
  guestSettingsButton.addEventListener("click", guestSettingsButtonClick);
  speakerSelect = document.getElementById("speakerSelect");
  recordingSettingsButton = document.getElementById("recordingSettingsButton");
  recordingSettingsButton.addEventListener("click", recordingSettingsButtonClick);
  talkbackButton = document.getElementById("talkbackButton");
  talkbackButton.addEventListener("click", onTalkbackButtonClick);
  talkbackButton.disabled = true;
  statusReportDiv = document.getElementById("statusReport");
  chatWindow = document.getElementById("chatWindow");
  new DragElement(chatWindow);
  chatButton = document.getElementById("chatButton");
  chatButton.disabled = true;
  chatButton.addEventListener("click", onChatButtonClick);
  chatSend = document.getElementById('chatSend');
  chatSend.addEventListener("click", onChatSend);
  chatClose = document.getElementById('chatClose');
  chatClose.addEventListener("click", (e) => {
    chatWindow.classList.remove("visible");
    dialogOpened = false;
  });
  chatDiv = document.getElementById("chatDiv");
  chatToSendText = document.getElementById("chatToSendText");
  chatToSendText.addEventListener("keyup", function(event) {
  // Number 13 is the "Enter" key on the keyboard
  if (event.keyCode === 13) {
    // Cancel the default action, if needed
    event.preventDefault();
    // Trigger the button element with a click
    onChatSend(event);
  }
});
  rrModeSwitch = document.getElementsByName("rr-mode");
  for (let j = 0; j < rrModeSwitch.length; j++) {
    rrModeSwitch[j].addEventListener("change", (e) => { onRRModeSwitch(e); });
  }

  let gc = document.getElementById("GuestConnection");
  gc.addEventListener("click", (e) => {
    if (connectedPeers.length == 0)
      guestSettingsButtonClick(e);
    else RRDebug(connectedPeers);
  });
  let b = document.getElementById("connectButton");
  if (remoteRadioMode == RRMode.REMOTE_GUEST) {
     b.addEventListener("click", () => {
        connectedPeers[remotePeerID] = callRemotePeer(remotePeerID, outgoingRemoteStreamBuss.stream);
      });
  } else {
    b.addEventListener("click", connectToStudio);
  }
  switch (remoteRadioMode) {
    case RRMode.REMOTE_GUEST: 
    case RRMode.LINK:
          // FIXME...
      setRRMode(RRMode.LINK);
      break;
    default:
      break;
  }
}
//
function setRRMode(mode) {

  document.getElementById("songs").classList.remove(remoteRadioMode);
  document.getElementById("cartH1").classList.remove(remoteRadioMode);
  document.getElementById("GuestConnection").classList.remove(remoteRadioMode);
  document.getElementById("samplers").classList.remove(remoteRadioMode);
  document.getElementById("RRRecorder").classList.remove(remoteRadioMode);
  document.getElementById("rrModeSwitch").classList.remove(remoteRadioMode);

  remoteRadioMode = mode;
  document.getElementById("songs").classList.add(remoteRadioMode);
  document.getElementById("cartH1").classList.add(remoteRadioMode);
  document.getElementById("GuestConnection").classList.add(remoteRadioMode);
  document.getElementById("samplers").classList.add(remoteRadioMode);
  document.getElementById("RRRecorder").classList.add(remoteRadioMode);
  document.getElementById("rrModeSwitch").classList.add(remoteRadioMode);
  if (remoteRadioMode == RRMode.LINK) {
    document.getElementById("Mic_1").classList.add(remoteRadioMode);
  }
}
//
function onRRModeSwitch(e) {
  setRRMode(e.target.id);
  switch (e.target.id) {
    case "direct":
      break;
    case "interview":
      break;
    case "studio":

      break;
    default:
      RRDebug("Unknown Remote Radio mode chosen: "+ e.target.id);
      break;
  }
}
// handle keyboard shortcuts
// disabled when dialogs or chat window is open
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
function connectToStudio() {
  if (studioConnectionStatus == ConnectionStatus.CONNECTED) {
    // disconnect from studio
    peerHandler.disconnectFromStudio();
  } else {
    peerHandler.connectToStudio();
  }
}
// user has selected a different audio input device
function onAudioInputChanged(e){
  var constraints = {
	  audio: { 
			deviceId: { exact: e.target.value },
      sampleRate: DEFAULT_SAMPLE_RATE,
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
  // mic.connect(remoteBussGain);
}
//
// main
//
window.addEventListener("load", (e) => {
//  var remotePeerID;
  const urlParams = new URLSearchParams(window.location.search); 
  for (const [key, value] of urlParams) {
    if (key === "peer") { // connected as remote guest
      remotePeerID = value;
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

  if (remoteRadioMode!=RRMode.SERVER){
    peer = new Peer({ host: SERVER, port:'', debug: debugLevel });
  }
  else {
    peer = new Peer(STUDIO_ID, { host: SERVER, port:'', debug: debugLevel });
  }
  peerHandler = new PeerHandler(peer);
  initialiseDOM();
  document.addEventListener("dragover", (e) => { e.preventDefault(); });
  document.addEventListener("drop", (e) => { e.preventDefault();
    if (remoteRadioMode == RRMode.STUDIO) playerLeft.filePicked(e.dataTransfer.files);
  });
});
// recording settings dialog handler
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
// open the dialog and get the new server/peer strings, if any
// and reconnnect if necessary
// audio bitrates to be implemented
function onConnectionSettingsClick(e) {

  var d = document.getElementById("settingsDialog");
  let b = document.getElementById("settingsDialogButton");
  let t = document.getElementById("serverText");
  let p = document.getElementById("peerText");
  if (peer) p.value = peer.id;
  t.value = remoteStudioID;
  var radios = document.getElementsByName("bitrate");
  b.addEventListener("click", (e) => {
    dialogOpened = false;
    remoteStudioID = t.value;
    Config.remoteStudioID = remoteStudioID;
    //connectToNewPeer(remoteStudioID);
    //remoteStudioID = p;
    if (p.value != peer.id) {
      RRDebug("Found new peer id: "+p.value+" - attempting to connect...");
      statusReport("Attempting to switch to peer id " + p.value);
      peer = new Peer(p.value, { host: SERVER, port:'', debug: debugLevel });
      peerHandler = new PeerHandler(peer);
    }
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
    saveStorage();
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
	  speakerSelect.style.display = "none";
	  document.getElementById("outputLabel").innerHTML = "<p>You only have one possible audio output...</p>";
  }
  b.addEventListener("click", (e) => {
    dialogOpened = false;
    // TODO implement output selection
  });
  d.showModal();
  dialogOpened = true;
}
// remote connections dialog handler
//
function guestSettingsButtonClick(e) {
  var d = document.getElementById("guestSettingsDialog");
  let t = document.getElementById("guestText");
  let b = document.getElementById("guestSettingsDialogButton");
  let i = document.getElementById("connectURL");
  let href = window.location.href;
  var connString ='';
  if (window.location.search != "") {
    href = href.replace(window.location.search, '');
  }
  if (peer.id) {
    connString = href + "?peer=" + peer.id;
  }
  i.innerHTML = connString;
  i.addEventListener("click", (e) => {
     navigator.clipboard.writeText(connString).then(function() {
      statusReport("Link copied to clipboard.");
    }, function() {
      RRDebug("Couldn't copy text to clipboard...");
      errorReport("Couldn't access clipboard, copy link manually.");
    });
  });
  b.addEventListener("click", (e) => {
    dialogOpened = false;
    invitePeerByEmail(t.value);
  });
  dialogOpened = true;
  if (!d.open) {
    d.showModal();
  } else {
    // RRDebug("dialog already open")
  }
}
// send an email with link to the page
function invitePeerByEmail(em) {
 if (em === null || em === "") {
  return;
 }
  if (!validateEmail(em)) {
    errorReport("Invalid email address");
    return;
  }
  window.open("mailto: " + em + "?subject=Connect%20via%20RemoteRadio&body=" + document.location + "?c=" + peer.id);
}

// update the connection status 
function setStudioConnectionStatus(status) {
  if (studioConnectionStatus == status)
    return;
  studioConnectionStatus = status;
  let s = studioConnectionStatusDiv;
  s.classList.remove("Connecting");
  s.classList.remove("Connected");

  switch (status) {
    case ConnectionStatus.DISCONNECTED:
      s.textContent = "Disconnected";
      isConnected = false;
      connectButton.disabled = false;
      if (connectedPeers==null)
        chatButton.disabled = true;
      talkbackButton.disabled = true;
      // RRDebug("Connection to studio lost...");
      break;
    case ConnectionStatus.PEER:
      s.textContent = "Ready...";
      connectButton.disabled = false;
      chatButton.disabled = true;
      break;
    case ConnectionStatus.CONNECTING:
      s.textContent = "Connecting...";
      s.classList.add("Connecting");
      connectButton.disabled = true;
      chatButton.disabled = true;
      break;
    case ConnectionStatus.CONNECTED:
      s.textContent = "Connected";
      s.classList.add("Connected");
      isConnected = true;
      connectButton.disabled = true;
      connectButton.value = "Disconnect";
      connectButton.innerHTML = "Disconnect";
      chatButton.disabled = false;
      talkbackButton.disabled = false;
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
// https://tools.ietf.org/id/draft-spittka-payload-rtp-opus-00.html
function doTalkbackSdpTransform(sdp) { doSdpTransform(sdp, 1, 24); }
function doSdpTransform(sdp, overridester=0, bitrate) {
  if (!bitrate)
    bitrate = Config.bitrate;

  //RRDebug("bitrate: "+ bitrate);
  const media = "audio";
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
    RRDebug("Could not find the m line for", media);
   // return sdp;
  }
  if (fmtline !== -1) {
  //  RRDebug("Found fmtp: " + lines[fmtline]);
    // FIX FIX FIX
    lines[fmtline]=lines[fmtline].trim();
    lines[fmtline]=lines[fmtline].concat('; stereo='+Config.stereo+'; maxaveragebitrate='+bitrate*1024+'; sprop-stereo=1; x-google-max-bitrate='
      +bitrate+ '; x-google-min-bitrate='+bitrate+'; cbr=1; nostd=1; usedtx=0; dty=1');
    //RRDebug("FMTP: "+lines[fmtline]);
  }
  //RRDebug("Found the m line for", media, "at line", line);
 
  // Pass the m line
  line++;
 
  // Skip i and c lines
  while (lines[line].indexOf("i=") === 0 || lines[line].indexOf("c=") === 0) {
    line++;
  }
 
  // If we're on a b line, replace it
  if (lines[line].indexOf("b") === 0) {
    //RRDebug("Replaced b line at line", line);
    lines[line] = "b=AS:"+bitrate;// + bitrate;
  }
  sdp = lines.join("\n");
  //RRDebug("SDP = "+sdp);
  return sdp;
}
/*
 *
 * PeerHandler class
 * wrapper to handle all the peer to peer stuff
 */
class PeerHandler {

    // setup callbacks for peer
    constructor(p) {
        this.peer = p;
        this.newPeer(p);
    }

    // set up all the callbacks for our peer connection
    newPeer(peer) {
        heartbeater = makePeerHeartbeater(this.peer);

        // callbacks
        this.peer.on("open",   // called when server connection established
          (id) => {
                RRDebug("Peer onOpen -> My peer ID is: " + id);
                statusReport("Connected to Remote Radio server");
                setStudioConnectionStatus(ConnectionStatus.PEER);
             }
        ); // open
        this.peer.on("call",   // when we get an incoming call - i.e. remote guest
          (mediaConnection) => {
            chatButton.disabled = false;
            talkbackButton.disabled = false;
            RRDebug("peer.onCall -> Answering incoming call from: " + mediaConnection.peer);
            mediaConnection.answer(outgoingRemoteStreamBuss.stream, {sdpTransform: doSdpTransform});
            // send audio pgm or talk buss
            mediaConnection.on("stream", (remoteStream) => { // incoming stream
                onCallStreamIncoming(remoteStream);
                //connectedPeers[mediaConnection.peer].setIncomingStream(incomingRemoteStreamGain.stream);
                //connectedPeers[mediaConnection.peer].setIncomingStream(remoteStream);
              }
            );

            mediaConnection.on("close", () => { // call is ended
                hangUp();
                RRDebug("Stream closed from " + mediaConnection.peer);
                statusReport("Lost stream connection with " + mediaConnection.peer);
                // TODO try and reconnect to peer
                // setStudioConnectionStatus(ConnectionStatus.PEER);

                delete connectedPeers[mediaConnection.peer];
              }
            );
          }
        ); // call
        this.peer.on("connection",   // incoming data connection
            (c) => {
               RRDebug("peer.onConnection -> Established data connection to " + c.peer);
               chatButton.disabled = false;
               if (!connectedPeers[c.peer]) {
                  RRDebug("Peer doesn't exist");
                  connectedPeers[c.peer] = new PeerToPeerConnection(c.peer);
               }
              connectedPeers[c.peer].setConnectionStatus(ConnectionStatus.CONNECTED);
              if (c.peer == STUDIO_ID) {
                //studioConnection.setConnection(c);
                setStudioConnectionStatus(ConnectionStatus.CONNECTED);
              } else {
                //connectedPeers[c.peer].setConnection(c);
              }
              isConnected = true;

              c.on("data",
                // received data
                (data) => {
                  RRDebug("Received data: " + data);
                  if (data.startsWith(RRCommand.TALKBACK)) {
                    RRDebug("Talkback message received..." + data);
                    if (data.includes("true")) {
                      // this is not very elegant or intuitive but it works
                      talkingBack = false;
                      onTalkbackButtonClick(null);
                    } else {
                      talkingBack = true;
                      onTalkbackButtonClick(null);
                    }
                  } else {
                      statusReport("Message from " + c.peer + ": <br /> " + data);
                      chatDiv.innerHTML += "<span class='incomingText'>" + c.peer + " : " + data + "</span><br />";
                      chatDiv.scrollTop = chatDiv.scrollHeight;
                    }
                  }); // data
                  c.on("close",
                        () => {
                          isConnected = false;
                          statusReport("Connection lost to "+c.peer);
                          RRDebug("Connection lost to "+c.peer);
                          if (c.peer == STUDIO_ID) {
                            setStudioConnectionStatus(ConnectionStatus.PEER);
                          }
                          else {
                            connectedPeers[c.peer].setConnectionStatus[ConnectionStatus.DISCONNECTED];
                          }
                          delete connectedPeers[c.peer];
                          }
                        ); // close
                   //   }
                   // );
                    c.on("open", // connection is ready to use
                        () => {
                            RRDebug ("open");
                            connectedPeers[c.peer].setConnectionStatus(ConnectionStatus.CONNECTED);
                            if (c.peer == STUDIO_ID)
                              setStudioConnectionStatus(ConnectionStatus.CONNECTED);
                        }
                    );
                    c.on("error",
                        (err) => {
                            RRError("Connection error: " + err);
                            statusReport(err);
                            connectedPeers[c.peer].setConnectionStatus(ConnectionStatus.DISCONNECTED);
                            delete connectedPeers[c.peer];
                        }
                    );
               }
        );
        this.peer.on("close",
          // peer is destroyed
            () => {
                RRDebug("Peer onClose -> Peer destroyed");
                statusReport("Not connected - check internet connection");
                this.peer = null;
                // delete all connections - or retry
                setStudioConnectionStatus(ConnectionStatus.DISCONNECTED);
            }
        );
        this.peer.on("error",
            (err) => {
                RRError("peer.onError: " + err);
                statusReport(err);
                switch (err.type) {
                  case 'browser-incompatable':
                    break;
                  case 'socket-error':
                  default: 
                    break;
                }
                hangUp();
                setStudioConnectionStatus(ConnectionStatus.PEER);
            }
        );
        this.peer.on("disconnected",
        // disconnnected from server
            () => {
                statusReport("Disconnected from server... retrying...");
                RRDebug("Peer onDisconnected -> Lost connection to server. Attempting reconnect");
                setStudioConnectionStatus(ConnectionStatus.DISCONNECTED);
                isConnected = false;
                /* if (this.peer) {
                    setTimeout(this.reconnect, reconnectInterval);
                } else {
                */
                  RRDebug("No peer - attempting to recreate...");
                  // this.peer = new Peer({ host: SERVER, port:'', debug: debugLevel });
                  this.reconnect();
                  //peerHandler = new PeerHandler(peer);
                //}
                // disconnect from connections???
            }
        );
    }

    handleData(data) {
      
    }

    reconnect() {
      if (!window.navigator.onLine) {
        RRDebug("Internet connection lost retrying in "+reconnectInterval/1000+" seconds");
        setTimeout(this.reconnect, reconnectInterval);
        return;
      }
      RRDebug("Reconnecting to server...");
      setStudioConnectionStatus(ConnectionStatus.CONNECTING);
      try {
        /* if (this.peer) {
          this.peer.reconnect();
        }
        else {
        */
          RRDebug("Creating Peer...");
          this.peer = new Peer({ host: SERVER, port:'', debug: debugLevel });
          peerHandler = new PeerHandler(peer);
          // this.newPeer(this.peer);
        //}
      } catch (e) {
        RRDebug(e + "\nAttempting reconnect in "+reconnectInterval);
        setTimeout(this.reconnect, reconnectInterval);
      }
    }

    connectToStudio() {
      setStudioConnectionStatus(ConnectionStatus.CONNECTING);
      studioConnection = new PeerToPeerConnection(remoteStudioID, outgoingRemoteStreamBuss.stream);
      // studioConnection.connect();
      studioConnection.callRemotePeer();
    }

    disconnectFromStudio() {
      this.disconnectFromPeer(remoteStudioID);
    }
    disconnectFromPeer(id){
      this.peer.disconnect(id);
    }
    // connect to peer with id
    connectToPeer(id) {
      if (id === this.peer.id) {
        RRError("Cannot connect to self!");
        return;
      }
      if (connectedPeers[id]) {
        if (connectedPeers[id].connectionStatus == ConnectionStatus.CONNECTED) {
          RRDebug("Already connected to "+id+". Ignoring request...");
          return;
        }
      }

      RRDebug("Trying new peer connection: " + id);
      var conn = this.peer.connect(id);
      // RRDebug(conn);
      conn.on("open",
        () => {
          RRDebug("In open");
          chatButton.disabled = false;
          connectedPeers[id].setConnectionStatus(ConnectionStatus.CONNECTED);
          // connectedPeers[id].send("Hello " + id);
          conn.send("Hello " + id);
          statusReport("Connected to " + id);
          conn.on("data",
            (data) => { // received data as initiator
              RRDebug(id + " Received data: " + data);
              // TODO remove duplidacted code into function
                if (data.startsWith(RRCommand.TALKBACK)) {
                      RRDebug("Talkback message received..." + data);
                      if (data.includes("true")) {
                        // this is not very elegant or intuitive but it works
                        talkingBack = false;
                        onTalkbackButtonClick(null);
                      } else {
                        talkingBack = true;
                        onTalkbackButtonClick(null);
                      }
                    } else {
                      statusReport("Message from "+conn.peer + ": <br /> "+data);
                      chatDiv.innerHTML += "<span class='incomingText'>" + conn.peer + " : " + data + "</span><br />";
                      chatDiv.scrollTop = chatDiv.scrollHeight;
                    }
            }
          );
          // send our audio to the studio
           if (id == STUDIO_ID) {
            setStudioConnectionStatus(ConnectionStatus.CONNECTED);
            RRDebug("Connecting to studio : " + conn.peer + " "+ outgoingRemoteStreamBuss.stream);
            callRemotePeer(conn.peer, outgoingRemoteStreamBuss.stream);
          } else if (remoteRadioMode != RRMode.GUEST) {
            RRDebug("Attempting call to "+ conn.peer);
            //connectedPeers[id].connect();
            connectedPeers[id].setStream(outgoingRemoteStreamBuss.stream);
            connectedPeers[id].callRemotePeer();
            //callRemotePeer(id);
          }
        }
      );
      conn.on("close",
        () => {
          RRDebug("Connection lost to " + conn.peer);
          statusReport("Connection lost to "+ conn.peer);
          connectedPeers[conn.peer].setConnectionStatus(ConnectionStatus.DISCONNECTED);
          delete connectedPeers[conn.peer];
          if (conn.peer == STUDIO_ID)
            setStudioConnectionStatus(ConnectionStatus.PEER);
        }
      );
      conn.on("error",
        // error could be can't connect
        (err) => {
          connectedPeers[conn.peer].setConnectionStatus(ConnectionStatus.DISCONNECTED);
          delete connectedPeers[conn.peer];
          statusReport("Connection error: " + err);
          if (conn.peer == STUDIO_ID)
            setStudioConnectionStatus(ConnectionStatus.PEER);
          RRDebug("Error: " + err);
        }
      );
      if (id == STUDIO_ID) {
        studioConnection.setConnection(conn);
        setStudioConnectionStatus(ConnectionStatus.CONNECTED);
      } else {
        connectedPeers[id].setConnectionStatus(ConnectionStatus.CONNECTED);
        connectedPeers[id].setConnection(conn);
      }

      return conn;
    }

    send(val) {
      studioConnection.send(val);
    }
}
// deal with new incoming stream
function onCallStreamIncoming(remoteStream) {
  // add remoteStream to audio
  let mss = theAudioContext.createMediaStreamSource(remoteStream);
  let msd = theAudioContext.createMediaStreamDestination();

  incomingRemoteStreamGain = theAudioContext.createGain();
  incomingRemoteStreamGain.gain.setValueAtTime(1, theAudioContext.currentTime);
  mss.connect(incomingRemoteStreamGain);

  incomingRemoteStreamGain.connect(msd);
  incomingRemoteStreamGain.connect(recorderBuss);
  incomingRemoteStreamGain.connect(outputBuss);

  // play incoming audio stream
  audioIncomingStream = new Audio();
  audioIncomingStream.srcObject = remoteStream;
  audioIncomingStream.onloadedmetadata = (e) => {
    RRDebug('Now playing incoming remote stream: ' + e);
    audioIncomingStream.play();
  };
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
  if (!connectedPeers[id]) {
    RRDebug("Call Remote Peer... " + id)
    connectedPeers[id] = new PeerToPeerConnection(id, stream);
    // connectedPeers[id].connect();
    //connectedPeers[id].setIncomingStream(outgoingRemoteStreamBuss.stream);
    if (id == STUDIO_ID) {
      studioConnection = connectedPeers[id];
    }
    let incomingRemoteStream = connectedPeers[id].callRemotePeer();
    var mss = theAudioContext.createMediaStreamSource(incomingRemoteStream);
    incomingRemoteStreamGain = theAudioContext.createGain();
    mss.connect(incomingRemoteStreamGain);
    incomingRemoteStreamGain.connect(outputBuss);
    // RRDebug("conn" + connectedPeers[id].connectionStatus);
    return connectedPeers[id];
  }
  else {
    RRDebug("Incoming call from already connected peer: " + id);
    return null;
  }
}

function hangUp() {
  setStudioConnectionStatus(ConnectionStatus.PEER);
  isConnected = false;
}
// when getUserMediaDevices is successful
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

  var types = [
    "audio/ogg", 
    "audio/webm", 
    "audio/webm;codecs=opus", 
    "audio/mp3",
    "audio/wav",
    "audio/ogg;codecs=opus",
    "audio/mp4",    // safari
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
  if (theRecorder.hasRecorded && !theRecorder.hasDownloaded) {
    e.preventDefault();
    return (e.returnValue = "You haven't downloaded your recording. Are you sure you want to leave the page..?");
  }
});

class DragElement {
  constructor(elmnt) {
    this.elmnt = elmnt;
    this.pos1 = 0, this.pos2 = 0, this.pos3 = 0, this.pos4 = 0;
    if (document.getElementById(elmnt.id + "Header")) {
    // if present, the header is where you move the DIV from:
      let d = document.getElementById(elmnt.id + "Header");
      this.onmousedown = this.dragMouseDown.bind(this);
      d.addEventListener("pointerdown", this.onmousedown);
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      elmnt.addEventListener("pointerdown", (e) => this.dragMouseDown(e));
    }
  }
  dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    this.pos3 = e.clientX;
    this.pos4 = e.clientY;
    this.onmouseup = this.closeDragElement.bind(this);
    document.addEventListener("pointerup", this.onmouseup);
    // call a function whenever the cursor moves:
    this.onmousemove = this.elementDrag.bind(this);
    document.addEventListener("pointermove", this.onmousemove);
  }

   elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    this.pos1 = this.pos3 - e.clientX;
    this.pos2 = this.pos4 - e.clientY;
    this.pos3 = e.clientX;
    this.pos4 = e.clientY;
    // set the element's new position:
    this.elmnt.style.top = (this.elmnt.offsetTop - this.pos2) + "px";
    this.elmnt.style.left = (this.elmnt.offsetLeft - this.pos1) + "px";
  }

  closeDragElement() {
    // stop moving when mouse button is released:
    document.removeEventListener("pointerdown", this.onmousedown);
    document.removeEventListener("pointermove", this.onmousemove);
  }
}

window.addEventListener('online', () =>  {
  RRDebug('Became online');
});
window.addEventListener('offline', () => {
  // TODO - handle gracefully going off line including any connections and incoming media streams...
  // set up reconnection
  RRDebug('Became offline');
});
