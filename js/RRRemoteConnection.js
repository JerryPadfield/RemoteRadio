
/* 
 * A remote stream audio input - this shouldn't be here
 */
 const CONNECT_MESSAGE = `
 Connect to another computer...

 `;
 function validateEmail(email) {
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

class RemoteConnection {

    constructor(id, stream) {
        this.id = id;
        this.stream = stream;
        if (id != STUDIO_ID) {
            this.div = document.createElement("div");
            let parent = document.getElementById("GuestConnection");
            this.div.classList.add("GuestConnection");
            this.div.classList.add("disconnected");
            this.div.addEventListener("click", (e) => this.onClick(e));
            parent.appendChild(this.div);
        }
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
        this.disabled = true;
        this.dialog = null;
    }
    setConnectionStatus(s) {
        this.connectionStatus = s;
        switch (this.connectionStatus) {
            case ConnectionStatus.CONNECTED:
                RRDebug("Connected...");
                if (!this.meter) {
                    this.meter = new RRVolumeMeter(this.div, theAudioContext, this.stream);
                    this.meter.unmute();
                }
                this.disabled = false;
                break;
            case ConnectionStatus.DISCONNECTED:
                if (this.meter) {
                    this.meter.mute();
                }
                this.div.style.display = "none";
                delete this.div;
                break;
            }
    }
    onClick(e) { // remove dynamic dialog generation?
        if (this.disabled) {
            RRDebug("disabled");
            return;
        }
        switch (this.connectionStatus) {
            case ConnectionStatus.DISCONNECTED:
            // show connection dialog
/*                this.dialog = document.createElement("dialog");
                let g = document.createElement("h1");
                g.innerHTML = "Add Remote Guest";
                this.dialog.appendChild(g);
                let t = document.createElement("p");
                t.innerText = CONNECT_MESSAGE;
                this.dialog.appendChild(t);
                let i = document.createElement("input");
                i.setAttribute("type", "text");
                let connString = "Not Connected...";
                let href = window.location.href;
                if (window.location.search != "") {
                    href = href.replace(window.location.search, '');
                }
                i.disabled = true;
                if (peer.id) {
                    connString = href + "?peer=" + peer.id;
                    i.disabled = false;
                }
                i.value = connString;
                this.dialog.appendChild(i);
                let b = document.createElement("button");
                b.innerText = "OK";
                let cancelButt = document.createElement("button");
                cancelButt.innerText = "Cancel";
                cancelButt.addEventListener("click", (e) => {
                    this.dialog.open = false;
                    dialogOpened = false;
                    this.dialog.close("no connection made");
                    // do nothing
                });
                b.addEventListener("click", (e) => {
                    this.dialog.open = false;
                    this.disabled = false;
                    dialogOpened = false;
                    this.div.innerHTML = "<b>Waiting...</b>"; 
        //           console.log(this.connectionStatus);
                    this.connectionStatus = ConnectionStatus.CONNECTING;
                    this.div.classList.remove("disconnected");
                    this.div.classList.add("connecting");
                    this.dialog.close();
                    // set to waiting for connection and add new remote link box....
                });
                this.dialog.appendChild(cancelButt);
                this.dialog.appendChild(b);
                document.body.appendChild(this.dialog);
                this.dialog.showModal();
                dialogOpened = true;
                */
                break;
            case ConnectionStatus.CONNECTING:
                break;
            case ConnectionStatus.CONNECTED:
                // disconnect...?
                break;
            default:
                break;
        }
    }
}

class PeerToPeerConnection {

    constructor(peerID, stream=null) {
        this.peerID = peerID;                                           // peer id from server
        this.connection = null;                                         // data connection to peer
        this.stream = stream;                                           // outgoing stream to send
        this.incomingStream = null;
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
        this.connectedPeers = [];
        // this needs to go really
        connectedPeers[peerID] = this;
        if (peerID == STUDIO_ID)
            studioConnection = this;
        if (stream)
           this.setStream(stream);
       this.connect();
    }
    
    connect() {
        if (this.connection) {
            RRDebug("Ignoring connection request");
            return;
        }
        this.connection = peerHandler.connectToPeer(this.peerID);
        RRDebug("Connected "+this.connection);
    }

    setIncomingStream(stream) {
        this.incomingStream = stream;
        RRDebug("Incoming stream is... " + stream);
        this.mss = theAudioContext.createMediaStreamSource(stream);
        this.msd = theAudioContext.createMediaStreamDestination();
        if (this.remoteConnection)
            delete this.remoteConnection;
        this.remoteConnection = new RemoteConnection(this.peerID, this.mss);
        this.remoteConnection.setConnectionStatus(ConnectionStatus.CONNECTED);
    }

    setConnectionStatus(s) {
        if (this.connectionStatus == s)
            return;
        if (this.remoteConnection)
            this.remoteConnection.setConnectionStatus(s);
        this.connectionStatus = s;
        setStudioConnectionStatus(this.connectionStatus);
        switch (s) {
            case ConnectionStatus.CONNECTED:
                if (this.peerID != STUDIO_ID) {
                    if (this.remoteConnection == null) {
                        // RRDebug("Stream is "+this.stream);
                        if (this.stream)
                            this.setStream(this.stream);
                    }
                }
                chatButton.disabled = false;
                talkbackButton.disabled = false;
                break;
            case ConnectionStatus.DISCONNECTED:
                delete this.remoteConnection;
                break;
            default:
                break;
        }
    }
    
    setConnection(conn) {
        RRDebug("Connection = " + this.connection + ", new connection = " + conn);
        this.connection = conn;
      //  this.setConnectionStatus(ConnectionStatus.CONNECTED);
    }

    setStream(stream) {
        this.stream = stream;
    }
    
    callRemotePeer() {
        chatButton.disabled = false; // HACK!
        this.remoteCall = peerHandler.peer.call(this.peerID, this.stream, {sdpTransform: doSdpTransform});
        RRDebug("Calling: " + this.remoteCall);
        this.remoteCall.on('stream',
            (stream) => {
                RRDebug("Method callRemotePeer Receiving stream: " + (stream));
                this.connectionStatus = (ConnectionStatus.CONNECTED);
                if (stream) {
                    this.onCallStreamIncoming(stream);
                } else {
                    // No incoming stream = one way call
                    RRDebug("No stream...");
                }
            }
        );
        this.remoteCall.on("close", function() {
            this.hangUp();
        });
        this.remoteCall.on("error",
            (err) => {
                this.hangUp();
                RRError("Call error: " + err);
            }
        );
        RRDebug("Returnimg "+this.stream);
        return this.stream;
    }

    send(msg) {
        if (!this.connection) {
            RRDebug("No connection!");
            studioConnection.send(msg);
        } else {
            RRDebug("Sending " + msg + " to " + this.connection.peer);
            this.connection.send(msg);
        }
    }
    
    hangUp() {
    }
    
    talkback(b) {
        if (b) {
            this.incomingRemoteStreamGain.gain.setValueAtTime(1, theAudioContext.currentTime);
        } else {
            this.incomingRemoteStreamGain.gain.setValueAtTime(0, theAudioContext.currentTime);
        }
        this.send(RRCommand.TALKBACK);
    }

    onCallStreamIncoming(remoteStream) {
        // add remoteStream to audio
 
        var mss = theAudioContext.createMediaStreamSource(remoteStream);
        var msd = theAudioContext.createMediaStreamDestination();

        this.incomingRemoteStreamGain = theAudioContext.createGain();   // add the incoming stream from call to this
        this.incomingRemoteStreamGain.gain.setValueAtTime(1, theAudioContext.currentTime);
        mss.connect(this.incomingRemoteStreamGain);

        this.incomingRemoteStreamGain.connect(msd);
        this.incomingRemoteStreamGain.connect(recorderBuss);
        this.incomingRemoteStreamGain.connect(outputBuss);

        // play incoming audio stream
        RRDebug("In onCallStreamIncoming method");
        let audioIncomingStream = new Audio();

        audioIncomingStream.srcObject = remoteStream;
        audioIncomingStream.onloadedmetadata = function(e) {
            RRDebug('Now playing incoming stream: '+e);
            audioIncomingStream.play();
        };
    }
}
