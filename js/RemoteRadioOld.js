/**
 * Remote Radio -- An Open Source peer to peer audio streaming solution
 * for community radio stations
 * https://github.com/JerryPadfield/P2PStudio
 *
 * Version: 0.01
 *
 * Uses peer.js
 * Relies on config.js loading configuration
 *
 * Released under Creative Commons license
 */
//
// TODO list:
//
// Add modes login splash
//


// Send section -> route input
// Receive section -> route output
// Add audio streams
// allow mic to be routed to other output for pfl chats
// allow hanging up (keep a record of whether we're in a call)
// alter phone image depending on state:
//  no call
//  in a call
//  call refused?
//  can't connect?
// MULTIPLE CONNECTIONS!!!
// One-way calls
// Change audio settings {constraints} and apply before call
// Change soundcard settings input & output
// Tidy up GUI:
//    Audio section
//    Peer section
// Implement recording properly:
//  select stream(s) or combination of to record.
//  Autorecord on call start?
//  Buffer - array might get out of hand
//
// More robust error handling
//
// FIX LIST:
// Error: iceConnectionState is disconnected, closing connections to ...
// https://webrtchacks.com/an-intro-to-webrtcs-natfirewall-problem/
// https://www.nomachine.com/AR07N00894
// https://stackoverflow.com/questions/40595837/iceconnectionstate-is-disconnected-vp9-coded-is-null-peerserver
//   Disconnecting when a call is stopped
//   Add available devices via enumerateDevices rather than getDevices
//
"use strict";
// set to true if script is run on main studio
const isMainStudio = false;
const MAIN_STUDIO_ID = "P2PStudioMain";
////////////////////////////////////////////////////////////////////////////////////
//
// Global variables
//
//

// html elements
var pidDiv, mdilistDiv, mdolistDiv, brDiv, brSlider, micImgDiv, micImgOn, micImgOff;
var inputSelect, outputSelect, connectedPeersList, chatInputText, chatInputButton, peerInputText, peerInputButton;
var chatDiv, callButton, sendInviteButton, emailText, contentDiv, loadingDiv, connectionLinkText;
var browserInfoDiv, errorReportDiv, statusReportDiv, stereoMono, audioLocalDevice, audioMeterLocal, audioMeterCanvasLocal;
var twoWayCallDiv, recordButton, stopButton, micMuted = false;
var mainMenuDiv, launchP2PStudioDiv, launchCallInDiv, P2PStudioDiv, CallInDiv, onAirDiv, callListDiv, advancedCB;
var remoteRadioLogo;
//
var isConnected = false;
var isAdvanced = false;
var audioContext;
var peer, peerHandler;
var stream;
// invited by another peer
var invited = false;
var connectedPeers = {};
var audioIncomingStream;
// audio meter variables...
var audioMeterCanvas, audioMeter, mediaStreamSource, rafID, rafID2;
const METER_WIDTH = 500, METER_HEIGHT = 300;
//
var twoWayCall = false;
const debugLevel = "3";
var conn;
var mediaRecorder;
// The key for Peer.js
//const PEERJS_API_KEY = "hl8rgs7ghiurqkt9";
const SERVER = "p2pstudio.herokuapp.com";
var constraints = {
    autoGainControl: false,
    channelCount: 1,
    echoCancellation: false,
 // latency:
    noiseSuppression: false,
    sampleRate: bitrate,
    sampleSize: 16
//        volume:
};
var options = { mimeType: 'audio/webm;codecs=opus' };
var tryReconnect = true; //boolean - do we try and reconnect if connection drops?
var reconnectID, reconnectInterval = 1000;

// Modes of P2PStudio
const MODE = {
    LOADING: 0,
    SPLASH: 1,
    P2PSTUDIO: 2,
    CALL_IN: 3,
    ADVANCED: 4,
};
var currentMode = MODE.LOADING;
///////////////////////////////////////////////////////////////////////////////////////////////////
//
//

    // Opera 8.0+
let isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    // Firefox 1.0+
let isFirefox = typeof InstallTrigger !== 'undefined';
    // At least Safari 3+: "[object HTMLElementConstructor]"
let isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
    // Internet Explorer 6-11
let isIE = /*@cc_on!@*/false || !!document.documentMode;
    // Edge 20+
let isEdge = !isIE && !!window.StyleMedia;
    // Chrome 1+
let isChrome = !!window.chrome && !!window.chrome.webstore;
     // Blink engine detection
let isBlink = (isChrome || isOpera) && !!window.CSS;
//////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Heartbeater is here to maintain a connection on the Heroku server otherwise it disconnects
//

// pass the peer instance, and it will start sending heartbeats
var heartbeater;// = makePeerHeartbeater(peer);
const HB_TIMEOUT_INTERVAL = 20000;
// stop them later
// heartbeater.stop();

function makePeerHeartbeater(peer) {
    var timeoutId = 0;
    function heartbeat() {
        timeoutId = setTimeout(heartbeat, HB_TIMEOUT_INTERVAL);
        if (peer.socket._wsOpen()) {
            peer.socket.send( {type:'HEARTBEAT'} );
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
/////////////////////////////////////////////////////////////////////////////////////
//
// Recording functions
//
var chunks = [];

function recordButtonOnClick() {
   if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices.getUserMedia) {
        errorReport("MediaRecorder not found");
    } else {
      //navigator.mediaDevices.getUserMedia(constraints).then(startRecording).catch(errorCallback);
      // TODO: mix streams according to user preference
     // startRecording(stream);
     mediaRecorder = new RRRecorder();
    }
}

//
//
//
function saveConfig(){
	saveStorage();
	statusReport("Configuration saved!");
}
//function errorCallback(err){
//    errorReport(err);
//}

function startRecording(stream) {
    recordButton.setAttribute("fill", "#222");
    recordButton.style.fill = "red";
//    console.log('Starting...');
    if (isFirefox) {
        options = { mimeType: 'audio/ogg' };
    }
    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.start();

  //  var url = window.URL || window.webkitURL;
  //  audioElement.srcObject = stream;
  //  audioElement.play();

    mediaRecorder.ondataavailable = function(e) {
        chunks.push(e.data);
    };
 
    mediaRecorder.onerror = function(e){
        errorReport('Error: ', e);
    };
 
    mediaRecorder.onstart = function(){
        console.log('Started, state = ' + mediaRecorder.state);
    };
 
    mediaRecorder.onstop = function(){
     console.log('Stopped, state = ' + mediaRecorder.state);
  
        var blob;
        if (isFirefox){
            blob = new Blob(chunks, {type: "audio/ogg"});
        } else {
            blob = new Blob(chunks, {type: "audio/webm;codecs=opus"});            
        }
        chunks = [];
  
        var audioURL = window.URL.createObjectURL(blob);
  
        downloadLink.href = audioURL;
//        audioElement.src = audioURL;
        downloadLink.innerHTML = 'Download audio file';
  
        var rand = Math.floor((Math.random() * 10000000));
        var name = "audio_" + rand + ".webm" ;

        downloadLink.setAttribute("download", name);
        downloadLink.setAttribute("name", name);
    };
 
    mediaRecorder.onwarning = function(e){
         console.log('Warning: ' + e);
    };
}

function stopButtonOnClick() {
    if (!mediaRecorder)
        return;
    if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}

/////////////////////////////////////////////////////////////////////////////////////
//
// PeerHandler
//
class PeerHandler {

    // setup callbacks for peer
    constructor(p) {
        this.peer = p;
        heartbeater = makePeerHeartbeater(peer);

        // callbacks
        //
        this.peer.on("open",   // called when server connection established
            function(id) {
                writeIt(pidDiv, "My peer ID is: " + id);
                if (!invited) {
                    connectionLinkText.value = document.location + "?c=" + id;
                } else {
                    connectionLinkText.disabled = true;
                }
            }
        );
        this.peer.on("call",   // when we get an incoming call
            function(mediaConnection) {
                // debugLog("in PeerHandler.onPeerCall");
                if (window.confirm("Accept incoming call from " + mediaConnection.peer + "?")){
                    // Hmmm....
                    if (twoWayCall) {
                        mediaConnection.answer(stream);
                    } else {
                        mediaConnection.answer(null);
                    }
                    mediaConnection.on("stream", onCallStreamIncoming);
                    mediaConnection.on("close", function() {
                        callButton.src = "images/phone.svg";
                       // delete connectedPeers[c.peer];
                        hangUp();
                        unconnectedDisableUI();
                        statusReport("Connection closed");
                        // TODO try and reconnect to peer

                    });
                } else {
                    // User denied incoming call
                    errorReport("Incoming call denied!");
                }
            }
        );
        this.peer.on("connection",   // incoming data connection
            function(c) {

                //debugLog("Received data " + c);
                //seeObj(c);
               if (connectedPeers[c.peer] !== 1) { // not connected to this peer
                    connectedPeers[c.peer] = 1;
                    conn = c;
                    createPeerList(c);
                    isConnected = true;

                    c.on("data",
                        // received data
                        function(data) {
                            debugLog("Received data: " + data);
                            chatDiv.innerHTML += "<span class='incomingText'>" + c.peer + " : " + data + "</span><br />";
                            c.on("close",
                                function() {
                                    statusReport("Connection lost");
                                    delete connectedPeers[c.peer];
                                    createPeerList(c);
                                }
                            );
                        }
                    );
                    c.on("open", // connection is ready to use
                        function() {
                            // enable UI components
                            connectedEnableUI();
                        }
                    );
                    c.on("error",
                        function(err) {
                            errorReport("Connection error: " + err);
                        }
                    );
                    c.on("close", // remote connection has been closed
                        function() {
                            //
                            isConnected = false;
                            delete connectedPeers[c.peer];
                            unconnectedDisableUI();
                            createPeerList();
                        }
                    );
                }
                connectedPeers[c.peer] = 1;
                }
        );
        this.peer.on("close",
          // peer is destroyed
            function() {
                debugLog("Peer destroyed");
                this.peer = null;
            }
        );
        this.peer.on("error",
            function(err) {
                errorReport("Peer error: " + err);
            }
        );
        this.peer.on("disconnected",
        // disconnnected from server
            function() {
                statusReport("Disconnected from server");
                isConnected = false;
                if (this.peer)
                    setTimeout(this.peer.reconnect, reconnectInterval);
                // disconnect from connections???
            }
        );
    }

    // connect to peer with id
    connectToPeer(id) {
        if (connectedPeers[id] === 1 || id === this.peer.id) {
            errorReport("Already connected. Ignoring request...");
            return;
        }
        // TODO: check validity of id here
        // Could use own id format
        peerInputText.value = "";
        connectedPeers[id] = 1;
        conn = this.peer.connect(id);

        conn.on("open",
            function() {
                connectedEnableUI();
                conn.on("data",
                    function(data) { // received data as initiator
                        debugLog(id + " Received data: " + data);
                        chatDiv.innerHTML += "<span class='incomingText'>" + id + " : " + data + "</span><br />";
                        chatDiv.scrollTop = chatDiv.scrollHeight;
                    }
                );
                createPeerList(conn);
            }
        );
        conn.on("close",
            function() {
                statusReport("Connection lost to " + conn.peer);
                delete connectedPeers[conn.peer];
                // remove from html list
                createPeerList(conn);
                unconnectedDisableUI();
            }
        );
        conn.on("error",
            function(err) {
                errorReport("Error: " + err);
            }
        );
    }

    send(val) {
        conn.send(val);
        chatDiv.innerHTML += "<span class='outgoingText'>" + peer.id + val + "</span></br>";
    }
}
//
// updates the list of connected peers
//
function createPeerList(c) {
    var empty = true;
    connectedPeersList.innerHTML = "";

    for (var co in connectedPeers) {
        empty = false;
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(co));
        connectedPeersList.appendChild(li);
     }
     if (empty) {
        connectedPeersList.innerHTML = "<ul>No connections...</ul>";
     }
}
//////////////
//
// call another peer with id
//
function callRemotePeer(id) {
    var call = peerHandler.peer.call(id, stream);
    callButton.src = "images/phone-outgoing.svg";
     call.on("stream",
        function(s) {
            debugLog("Receiving stream: " + URL.createObjectURL(s));
            isConnected = true;
            if (s) {
                audioIncomingStream.srcObject = s;
                audioIncomingStream.onloadedmetadata = function(e) {
                    console.log('now playing the audio');
                    audioIncomingStream.play();
                    audioMeter = createAudioMeter(audioContext);
                    var mediaStreamSource2 = audioContext.createMediaStreamSource(s);
                    // Create a new volume meter and connect it.
                    mediaStreamSource2.connect(audioMeter);
                    onLevelChange2();
                };
            } else {
                // No incoming stream = one way call
            }
       }
    );
    call.on("close", function() {
        //
        hangUp();
    });
    call.on("error",
        function(err) {
            hangUp();
            errorReport("Call error: " + err);
        }
    );
}

function hangUp() {
    callButton.src = "images/phone.svg";
    isConnected = false;
    createPeerList();
}
// connect to peer with id
function connectToPeer(id) {
    if (id !== "" && id !== null && id !== undefined) {
        peerHandler.connectToPeer(id);
    } else {
        debugLog("Invalid id for peer: " + id);
    }
 }
////////////////////////////////////////////////////////////////////////////////////
//
//
//

function onCallStreamIncoming(remoteStream) {
    // play incoming audio stream
    console.log("In onCallStreamIncoming");
    callButton.src = "images/phone-incoming.svg";
    audioIncomingStream.srcObject = remoteStream;
    
    audioIncomingStream.onloadedmetadata = function(e) {
        console.log('now playing the audio');
        audioIncomingStream.play();
    };
    audioMeter = createAudioMeter(audioContext);
    var mediaStreamSource2 = audioContext.createMediaStreamSource(remoteStream);
    // Create a new volume meter and connect it.
    mediaStreamSource2.connect(audioMeter);
    onLevelChange2();
}
function onCallStreamOutgoing(remoteStream) {
    // play outgoing audio stream
    console.log("In onCallStreamOutgoing");
}

/////////////////////////////////////////////////////////////////////////////////////
//
//
//
//
// function to check if "email" is a valid email address
function validateEmail(email) {
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function invitePeerByEmail() {
    // TODO: send an email with link to the page
    var em = emailText.value;
    if (!validateEmail(em)) {
        //debugLog("Invalid email address");
        errorReport("Invalid email address");
        return;
    }
    window.open("mailto: " + em + "?subject=Connect%20via%20P2PStudio&body=" + document.location + "?c=" + peer.id);
}

function setupAudio() {
    // monkeypatch Web Audio
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    // grab an audio context
    audioContext = new window.AudioContext();
}

function unconnectedDisableUI() {
    chatInputButton.disabled = true;
    callButton.disabled = true;
    chatInputText.disabled = true;
    // reenable new connections
    peerInputText.value = "";
    peerInputText.disabled = false;
    peerInputButton.disabled = false;
    sendInviteButton.disabled = false;
    emailText.disabled = false;
    //twoWayCallDiv.disabled = true;
}
function connectedEnableUI() {
    chatInputButton.disabled = false;
    callButton.disabled = false;
    chatInputText.disabled = false;
    // disable new connection UI - in future we should handle multiple connections
    peerInputButton.disabled = true;
    peerInputText.value = conn.peer;
    peerInputText.disabled = true;
    sendInviteButton.disabled = true;
    emailText.disabled = true;
   // twoWayCallDiv.disabled = false;
}

// create HTML for each MediaDevice
function createDeviceHTML(dev) {
    var strRet = "<div class='device'>";

//    seeObj(dev);
//    var cap = dev.getCapabilities();
//    console.log("Capabilities: ");
//    seeObj(cap);
//    strRet += dev.label + "</div>";
    return strRet;
}

////////////////////////////////////////////////////////////////////////////////
//
// MediaStreamTrack
//

// called when the mic is muted
function onStreamMuted() {
    console.log("in onStreamMuted");
    micImgDiv.src = micImgOff;
}

function setStream(s) {
    audioLocalDevice.srcObject = s;
    //audioContext.createMediaStreamSource(s);
    audioContext.onmuted = onStreamMuted;
}

/////////////////////////////////////////////////////////////////////////////////////////
//
// UserMedia functions
//
//

// getUserMedia worked
function onUserMediaSuccess(s) {
  //  console.log("User has granted access to local media.");
    if (isAdvanced) currentMode=MODE.ADVANCED;
    else    currentMode = MODE.SPLASH;

    enableUI();
    stream = s;
    var msta = stream.getAudioTracks();
 //   console.log("Found " + msta.length + " audio track(s)");
    msta.forEach(createDeviceHTML);
    getList();
    setupAudio();
    setStream(stream);
    // audio meter
    mediaStreamSource = audioContext.createMediaStreamSource(s);
    // Create a new volume meter and connect it.
    audioMeterLocal = createAudioMeter(audioContext);
    mediaStreamSource.connect(audioMeterLocal);

    // kick off the visual updating
    //onLevelChange();
}

// update the audio meter
function onLevelChange2(time){
    // clear the background
    audioMeterCanvas.clearRect(0, 0, METER_WIDTH, METER_HEIGHT);

    // check if we're currently clipping
    if (audioMeter.checkClipping()) {
        audioMeterCanvas.fillStyle = "red";
    }
    else {
        audioMeterCanvas.fillStyle = "green";
    }

    // draw a bar based on the current volume
    audioMeterCanvas.fillRect(0, 0, audioMeter.volume * METER_WIDTH * 1.4, METER_HEIGHT);

    // set up the next visual callback
    rafID2 = window.requestAnimationFrame(onLevelChange2);
}


// getUserMedia failed -- abort
function onUserMediaError(err) {
    console.log(err);
    fail(err);
}

////////////////////////////////////////////////////////////////////////////////////////////
//
// Utility functions
//

function statusReport(str) {
    statusReportDiv.innerHTML = str;
    statusReportDiv.classList.add('show');
    setTimeout(function(){ statusReportDiv.classList.remove('show'); }, 3000);
}

function errorReport(err) {
    errorReportDiv.innerHTML = err;
    errorReportDiv.classList.add('show');
    setTimeout(function(){ errorReportDiv.classList.remove('show'); }, 3000);
}

function debugLog(str) {
    if (debugLevel === "3") {
        console.log(str);
    }
    //errorReportDiv.innerHTML = str;
}
// fail completely -- disables the UI and shows error message
// called if the browser can't handle it and there's no point in continuing
function fail(err) {
    document.getElementById("loading").innerHTML =
        "<img src=\"images/P2P-logo.svg\" /><h1>P2PStudio aborted</h1><p>Browser reported: "
            + err + "</p><p>P2PStudio requires a modern, standard-compliant, WebRTC enabled browser such as Chrome, Firefox or Opera...</p>";
    disableUI();
}

// write an object to the console
function seeObj(o) { for (var x in o) console.log(x + ":" + o[x]); }

function disableUI() {
    contentDiv.style.visibility = "hidden";
    contentDiv.style.opacity = "0";
    loadingDiv.style.visibility = "visible";
    loadingDiv.style.visibility = "1";
}
function enableUI() {
    switch (currentMode) {
        case MODE.SPLASH:
            mainMenuDiv.style.visibility = "visible";
            mainMenuDiv.style.opacity = "1";
            loadingDiv.style.visibility = "hidden";
            loadingDiv.style.opacity = "0";
            contentDiv.style.visibility = "hidden";
            contentDiv.style.opacity = "0";
            P2PStudioDiv.style.visibility = "hidden";
            P2PStudioDiv.style.opacity = "0";        
            CallInDiv.style.visibility = "hidden";
            CallInDiv.style.opacity = "0";     
            break;
        case MODE.P2PSTUDIO:
            mainMenuDiv.style.visibility = "hidden";
            mainMenuDiv.style.opacity = "0";
            loadingDiv.style.visibility = "hidden";
            loadingDiv.style.opacity = "0";
            contentDiv.style.visibility = "hidden";
            contentDiv.style.opacity = "0";
            P2PStudioDiv.style.visibility = "visible";
            P2PStudioDiv.style.opacity = "1";
            CallInDiv.style.visibility = "hidden";
            CallInDiv.style.opacity = "0";     
        break;
        case MODE.CALL_IN:
            mainMenuDiv.style.visibility = "hidden";
            mainMenuDiv.style.opacity = "0";
            loadingDiv.style.visibility = "hidden";
            loadingDiv.style.opacity = "0";
            contentDiv.style.visibility = "hidden";
            contentDiv.style.opacity = "0";
            P2PStudioDiv.style.visibility = "hidden";
            P2PStudioDiv.style.opacity = "0";   
            CallInDiv.style.visibility = "visible";
            CallInDiv.style.opacity = "1";     
        break;
        case MODE.ADVANCED:
        default:
        // turn off advisory and enable UI
            mainMenuDiv.style.visibility = "hidden";
            mainMenuDiv.style.opacity = "0";
            contentDiv.style.visibility = "visible";
            contentDiv.style.opacity = "1";
            loadingDiv.style.visibility = "hidden";
            loadingDiv.style.opacity = "0";
            P2PStudioDiv.style.visibility = "hidden";
            P2PStudioDiv.style.opacity = "0";        
            CallInDiv.style.visibility = "hidden";
            CallInDiv.style.opacity = "0";     
        break;
    }   
}
// write a message to a Div
function writeIt(divID, txt) {
    divID.innerHTML = txt;
}

////////////////////////////////////////////////////////////////////////////////////////////
//
// Document GUI interaction functions
//
//
function updateAudioParameters(){
    var sm = stereoMono.checked ? 2 : 1;

    constraints = {
        autoGainControl: false,
        channelCount: sm,
        echoCancellation: false,
 //       latency:
        noiseSuppression: false,
        sampleRate: brSlider.value,
        sampleSize: 16
//        volume:
    };
    const track = stream.getAudioTracks()[0];
    //console.log(track.getConstraints().sampleRate);
    track.applyConstraints(constraints).
        then(function() {
            // success!
            debugLog("Successfully updated audio parameters");
            //console.log(track.getConstraints().sampleRate);

        }
        ).catch(function(err) {
            debugLog("Could not update audio settings!");
        }
        );
}
function bitrateChange() { // called when bitrate slider is moved
    bitrate = brSlider.value;
    writeIt(brDiv, "Bitrate: " + bitrate + " kbps");
  // TODO: update audio bitrate
    updateAudioParameters();
}
// input select has been changed to indicate using a different input device
function onInputDeviceChanged(idx){
    debugLog("input select: " + inputSelect.selectedIndex);
    // TODO: set input device
    // recall navigator.mediaDevices.getUserMedia with constraints set to new device id
   // const audioSource = audioInputSelect.value;
   // const constraints = {
    //    audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
    //    //video: {deviceId: videoSource ? {exact: videoSource} : undefined}
    //};
    // navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(handleError);
}
function onOutputDeviceChanged(idx){
    debugLog("output select: " + outputSelect.selectedIndex);
    // TODO: set output device
}

////////////////////////////////////////////////////////////////////////////////////////////
//
// Setup functions
//
//

// Fills device lists for audio input and output
function getList() {
  navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
        inputSelect = document.getElementById("inputSelect");
        inputSelect.remove(0);
        inputSelect.onchange = onInputDeviceChanged;
        outputSelect = document.getElementById("outputSelect");
        outputSelect.remove(0);
        outputSelect.onchange = onOutputDeviceChanged;
        var numInputs = 0, numOutputs = 0;
        devices.forEach(function(device) {
          if (device.kind === "audioinput") {
            var opt = document.createElement("option");
            opt.text = device.label + " id = " + device.deviceId;
            inputSelect.add(opt);
            numInputs++;
          } else if (device.kind === "audiooutput") {
            var opt = document.createElement("option");
            opt.text = device.label + " id = " + device.deviceId;
            outputSelect.add(opt);
            numOutputs++;
          }
        });
        if (numInputs > 1) {
          inputSelect.disabled = false;
        }
        if (numOutputs > 1) {
          outputSelect.disabled = false;
        }
        })
        .catch(function(err) {
            fail(err.name + ": " + err.message);
        }
    );
}

/////////////////////////////
//
//
function sendChat(val) {
    if (val === ""){
        debugLog("Nothing to send in sendChat...");
        return;
    }
    if (conn === null || conn === undefined) {
        debugLog("No connection...");
        return;
    }
    if (!conn.open) { // connection lost
        debugLog("No connection in sendChat");
        delete connectedPeers[conn.peer];
        // remove from html list
        createPeerList(conn);
        return;
    }
    conn.send(val);
    chatInputText.value = "";
    chatDiv.innerHTML += "<span class='outgoingText'>Me : " + val + "</span></br>";
    chatDiv.scrollTop = chatDiv.scrollHeight;
}
//
function callPeer() {
    if (!conn){
        debugLog("No connection. Ignoring request to call.");
        return;
    }
    // TODO: check if already in a call
    callRemotePeer(conn.peer, stream);
}
//
function sendInviteByEmail(){
    invitePeerByEmail(document.getElementById('emailText').value);
}

function launchP2PStudio(){
    currentMode = MODE.P2PSTUDIO;
    enableUI();

}
function launchCallIn() {
    currentMode = MODE.CALL_IN;
    enableUI();
}
var onAir = false;

function onAirClick(){
    if (onAir) {
        onAir = false;
        onAirDiv.style.color = "grey";
        document.getElementById("onAirText").innerText = "OFF AIR";
      //  onAirDiv.style.borderColor = "black";
    } else {
        onAir = true;
        onAirDiv.style.color = "red";
        document.getElementById("onAirText").innerText = "ON AIR";
     //   onAirDiv.style.borderColor = "black";
    }
}
function backToMenu(){
    currentMode = MODE.SPLASH;
    enableUI();
}

var callers = [];
class Caller {
    //name ="";
    constructor(n){
        this.name = n;
    }
    writeHTML(){
        return "<div>"+name+"<img src=''></div>";
    }
}
function addCaller(n){
    callListDiv.innerHTML = "";
    l=callers.length;
    callers[l] = new Caller(n);
}
function rrlOnClick() {
    backToMenu();
}
function advancedCBOnClick(){
    if (advancedCB.checked == true){
        currentMode = MODE.ADVANCED;
    } else {
        currentMode = MODE.SPLASH;
    }
        enableUI();
}
/////////////////////////////////////////////////////////////////////////////////////
//
//
// called when window has loaded
//
window.onload = function() {
    // load UI DOM objects into global variables
    errorReportDiv = document.getElementById("errorReportDiv");
    if (util.browser === "Unsupported") {
        errorReport("Unsupported browser. Trying anyway...");
    }
    statusReportDiv = document.getElementById("statusReportDiv");

    pidDiv = document.getElementById("PeerID");
    browserInfoDiv = document.getElementById("browserInfoDiv");
  //  browserInfoDiv.innerHTML = "Browser: " + util.browser + ", Supports media: " + util.supports.audioVideo
  //      + ", Supports data: " + util.supports.data + ", Binary: " + util.supports.binary + ", Reliable: " + util.supports.reliable;
    contentDiv = document.getElementById("content");
    loadingDiv = document.getElementById("loading");
    mdilistDiv = document.getElementById("MediaInputDevicesList");
    mdolistDiv = document.getElementById("MediaOutputDevicesList");
    callListDiv = document.getElementById("callListDiv");

    remoteRadioLogo = document.getElementById("RemoteRadioLogo");
    remoteRadioLogo.onclick = rrlOnClick;

    mainMenuDiv = document.getElementById("main_menu");
    launchP2PStudioDiv = document.getElementById("launchP2PStudioDiv");
    launchCallInDiv = document.getElementById("launchCallInDiv");
    launchCallInDiv.onclick = launchCallIn;
    launchP2PStudioDiv.onclick = launchP2PStudio;
    P2PStudioDiv = document.getElementById("P2PStudioDiv");
    CallInDiv = document.getElementById("CallInDiv");
    onAirDiv = document.getElementById("onAirDiv");
    onAirDiv.onclick = onAirClick;

    brDiv = document.getElementById("Bitrate");
    brSlider = document.getElementById("brSlider");
    micImgDiv = document.getElementById("MicImg");
    micImgDiv.onmouseover = function() {
        // change image colour
    };
    micImgDiv.onclick = function() {
        if (micImgDiv.src === micImgOn.src) {
            micImgDiv.src = micImgOff.src;
			micMuted = true;
            // turn off audio input
        } else {
			micMuted = false;
            micImgDiv.src = micImgOn.src;
            // enable audio input
        }
    };
    connectedPeersList = document.getElementById("connectedPeersList");
    connectionLinkText = document.getElementById("connectionLinkText");
    connectionLinkText.onclick = function(){
        connectionLinkText.select();
        /* Copy the text inside the text field */
        document.execCommand("Copy");
        statusReport("Copied " + connectionLinkText.value + " to clipboard.");
    }
    chatInputText = document.getElementById("chatInputText");
    chatInputText.onkeyup = function(e) {
        if (e.key === "Enter"){
            sendChat(chatInputText.value);
        }
    };
    chatInputButton = document.getElementById("chatInputButton");
    chatInputButton.onclick = function() {
        sendChat(chatInputText.value);
    };
    peerInputText = document.getElementById("peerInputText");
    peerInputText.onkeyup = function(e){

    }
    peerInputButton = document.getElementById("peerInputButton");
    peerInputButton.onclick = function() {
        if (peerInputText.value === "") return;
        connectToPeer(peerInputText.value);
    };
    chatDiv = document.getElementById("chatDiv");
    callButton = document.getElementById("callButton");
    callButton.onclick = callPeer;

    emailText = document.getElementById("emailText");
    sendInviteButton = document.getElementById("sendInviteButton");
    sendInviteButton.onclick = function (){
        invitePeerByEmail();
    };
    stereoMono = document.getElementById("stereoMono");
    stereoMono.checked = isStereo;
    stereoMono.onclick = function() {
        updateAudioParameters();
    };
    twoWayCallDiv = document.getElementById("twoWayCall");
    twoWayCallDiv.onchange = function(){
        twoWayCall = twoWayCallDiv.checked;
    //    console.log(twoWayCallDiv.checked);
    };
    twoWayCallDiv.checked = twoWayCall;
    // disabled UI as we're not connected yet
    unconnectedDisableUI();

    // load images
    micImgOn = new Image();
    micImgOn.src = "images/Feather-core-mic.svg";
    micImgOff = new Image();
    micImgOff.src = "images/Feather-core-mic-off.svg";
    micImgDiv.src = micMuted ? micImgOff.src : micImgOn.src;

    audioLocalDevice = document.getElementById("audioLocalDevice");
    audioMeterCanvasLocal = document.getElementById("audioMeterLocal").getContext("2d");
    audioIncomingStream = document.getElementById("audioIncomingStream");
    audioMeterCanvas = document.getElementById("audioMeter").getContext("2d");

    recordButton = document.getElementById("recordButton");
    stopButton = document.getElementById("stopButton");
    stopButton.onclick = stopButtonOnClick;
    recordButton.onclick = recordButtonOnClick;
    // work around new Chrome rule that requires user interaction to start AudioContext
   var resumeAudio = function() {
      if (audioContext == null) audioContext = new window.AudioContext();
      if (audioContext.state == "suspended") audioContext.resume();
      document.removeEventListener("click", resumeAudio);
   };
   document.addEventListener("click", resumeAudio);
    advancedCB = document.getElementById("advancedCB");
    advancedCB.onclick = advancedCBOnClick;

    // load any saved values (from config.js) into UI components
    brSlider.value = bitrate;
    writeIt(brDiv, "Bitrate: " + bitrate + " kbps");
    // see if browser supports device enumeration
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        writeIt(mdilistDiv, "enumerateDevices() not supported.");
        return;
    }
    if (isEdge || isIE || isSafari) {
        fail("Unsupported Browser!");
        // errorReport("Unsupported Browser - results may vary...");
    } else {
        // get user media - audio only
        navigator.mediaDevices.getUserMedia({audio:true}).then(onUserMediaSuccess).catch(onUserMediaError);
        // Peer.js object creation
        //peer = new Peer({ key: PEERJS_API_KEY, debug: debugLevel });
        peer = new Peer(/*"p2p_"+Math.floor(Math.random()*100000), */{ host: SERVER, port:'', debug: debugLevel });
        // add callbacks to peer
        peerHandler = new PeerHandler(peer);
        var params = new URLSearchParams(window.location.search);
        if (params.has("c")) { // this is a connection from email source
            // new peer connection to the id in c
            connectToPeer(params.get("c"));
            invited = true;
        }
    }
};

window.onbeforeunload = function() {
  // TODO: test if connected & shut down gracefully
  if (isConnected) {
      return("Leaving!");
  }
};


function openNav(){
    document.getElementById("sidenav").style.width = "250px";
}

function closeNav(){
    document.getElementById("sidenav").style.width = "0px";

}