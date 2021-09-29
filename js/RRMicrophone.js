/**
 *
 * class RRMicrophone - handles the microphone input.
 *
 *
 */
 // message shown when first asking to monitor the mic through speakers
 //
const HEADPHONE_WARNING_MESSAGE = 
`We highly recommend using headphones before activating monitoring to prevent feedback loops.

Click OK to proceed (no future warnings will be shown.`;

class RRMicrophone {

    mss = null;             // MediaStreamSource object
    _connected = false;     // whether we are connected to an output
    destination = null;     // destination node
    micGain = null;         // GainNode
    muted = true;
    sentToSpeaker = false;  // whether mic is monitored through output audio device
    storedGain = 1;         // keeps a copy of current gain selected by user so it can be restored after muting/unmuting

    constructor(stream, dest=null){ //stream = mic input from getUserMedia, destination = audionode dest
        if (dest) {
            this.destination = dest;
            connect(dest);
        }
        this.mss = theAudioContext.createMediaStreamSource(stream);
        this.msd = theAudioContext.createMediaStreamDestination();
        this.div = document.getElementById("Mic_1");
        this.div.addEventListener("click", (evt) => this.onClick(evt));

        // mss -> micGain -> lim -> msd
        this.micGain = theAudioContext.createGain();
        this.micGain.gain.value = 0;
        this.mss.connect(this.micGain);

        // need to sort out the routing as Limiter connects to the mixedAudio buss & speakers
        // TODO TODO TODO
        //this.lim = new RRLimiter(null /* this.div*/);
        //this.lim.setStreamSource(theAudioContext, this.msd.stream, false, this.micGain);
        // this.lim.setAudioNodeSource(theAudioContext, this.micGain, false, this.msd);
        //this.lim.threshold = -100;
        //this.lim.gain = 5;

        this.micGain.connect(this.msd);

        this.containerDiv = document.createElement("div");
        this.containerDiv.classList.add("MicContainer");

        this.checkbox = document.createElement("input");
        this.checkbox.type = "checkbox";
        this.checkbox.title = "Monitor on/off (wear headphones!)";
        this.checkbox.addEventListener("click", function(e) {e.stopPropagation();});
        this.checkbox.addEventListener("change", (e) =>  {this.switchSpeakerOutput(); e.stopPropagation();});
        this.containerDiv.appendChild(this.checkbox);
        this.range = document.createElement("input");
        this.range.type = "range";
        this.range.title = "Adjust gain, -30-+20dB, double click to reset to 0";
        this.range.classList.add("MicSettings");
        this.range.value = 0;
        this.range.step = 1;
        this.range.min = -30;
        this.range.max = 20;
        this.range.addEventListener("click", (e) => {e.stopPropagation();});
        this.range.addEventListener("dblclick", (e) => { this.range.value = 0; this.gain = 0; e.stopPropagation();});
        this.range.addEventListener("input", (e) => {
            this.gain = e.target.value;
            e.stopPropagation();
        });
        this.containerDiv.appendChild(this.range);
        this.settingsButton = document.createElement("button");
        this.settingsButton.title = "Change microphone input";
        this.settingsButton.classList.add("settingsButton");
        this.settingsButton.addEventListener("click", (e) => {
            this.micSettings(e);
            e.stopPropagation();
        });
        this.containerDiv.appendChild(this.settingsButton);

        this.meter = new RRVolumeMeter(this.containerDiv, theAudioContext, this.micGain);
        this.mute();
        this.div.appendChild(this.containerDiv);
    }

    dbToGain(db) {
        return Math.exp(db*Math.log(10.0)/20.0);
    }

    set gain(g) {
        if (this.muted) {
            this.storedGain = g;
            return;
        }
        this.micGain.gain.setValueAtTime(this.dbToGain(g), theAudioContext.currentTime);
        this.storedGain = g;
    }
    get connected()  { return this._connected; }
    set connected(s) { this._connected = s; }
    
    get sentToSpeaker() { return this.sentToSpeaker; }
    switchSpeakerOutput() {
        if (this.sentToSpeaker) {
            this.disconnectFromSpeaker();
        }
        else {
            if (Config.headphoneWarningShown) {
                this.sendToSpeaker();
            } else {
                let c = window.confirm(HEADPHONE_WARNING_MESSAGE);
                if (c) {
                    this.sendToSpeaker();
                    Config.headphoneWarningShown = true;
                    saveStorage();
                } else {
                    this.checkbox.checked = false;
                }
            }
        }
    }
    changeInput(stream) {
        this.mss = theAudioContext.createMediaStreamSource(stream);
        this.msd = theAudioContext.createMediaStreamDestination();
		this.meter = new RRVolumeMeter(this.div, theAudioContext, this.mss);
        this.micGain = theAudioContext.createGain();
        this.micGain.gain.value = this.storedGain;
        this.mss.connect(this.micGain);
        this.micGain.connect(this.msd);
		this.mute();
 	}

    micSettings(e) {
        this.settingsDialog = document.getElementById("micSettingsDialog");
        this.settingsDialog.showModal()
    }

    get stream () { return this.msd; }
	mute() {
        this.micGain.gain.setValueAtTime(0, theAudioContext.currentTime);
        if (this.meter) this.meter.mute();
        this.muted = true;
        this.div.style.backgroundColor = "lightGrey";
	}
	unmute() {
        this.muted = false;
        this.micGain.gain.setValueAtTime(this.storedGain, theAudioContext.currentTime);
        this.meter.unmute();
        this.div.style.backgroundColor = "green";
	}
    sendToSpeaker(){
        this.checkbox.checked=true;
        this.micGain.connect(outputBuss);
        this.sentToSpeaker = true;
    }
    disconnectFromSpeaker(){
		if (!this.sentToSpeaker) return;
        this.checkbox.checked = false;
        this.micGain.disconnect(outputBuss);
        this.sentToSpeaker = false;
    }
    connect(dest) {
		if (dest == null) return;
		if (this.destination == null) {
			this.destination = dest;
		}
        this.disconnect();
        this.micGain.connect(dest);
        this.micGain.connect(remoteBussGain); //HACK!
        this._connected = true;
        this.meter = new RRVolumeMeter(this.containerDiv, theAudioContext, this.micGain);
    }
    talkback(b) {
        if (b) {
            this.micGain.disconnect(recorderBuss);
        }
        else {
            this.micGain.connect(recorderBuss);
        }
    }

    disconnect() {
        if (this.meter) {
            this.meter.disconnect(this.containerDiv);
            this.meter=null;
        }
        this.micGain.disconnect();
        this.connected = false;
    }

    switch() {
       if (this.muted){
		  this.muted=false;
		  this.unmute();          
	  } else {
		  this.muted=true;
		  this.mute();
	  }
    }

	onClick(){
        this.switch();
	}
}

// export class RRMicrophone