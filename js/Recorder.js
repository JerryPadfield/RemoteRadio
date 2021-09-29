/**
 * RRRecorder
 * Recorder class
 * Issues:
 *   + ?
 *   + Compatibility: https://caniuse.com/?search=mediarecorder
 * Features required:
 *   + Multiple track recording
 */
const MAX_TIME = 7200;  // 2 hours - not sure if this should be enforced or left to user discretion.
                        // This is the maximum amount of recording time.
const WARNING_MESSAGE = 
`You haven't downloaded your old recording, and will lose what you have recorded, are you sure you want to start a new one...?

Click cancel to return to Remote Radio and download your recording first, or OK to start a new recording.`;

// options for mediarecorder quality
var options = { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 };
// GUI stuff -- probably should remove from here
var WIDTH = 300;
var HEIGHT = 50;
var playButton;
var mediaStreamSource = null;
var mediaStreamSources = []; // array of tracks to record - currently not implemented

function errorReport(err)   {  console.error(err); }
function RRR_log(str) {
 console.log(str); 
}
function RRR_fail(msg){
  // hide GUI and report error message...
    //isRecording = false;
    console.error(msg);
}

function RRR_error(e) { console.error(e); }

class RRRecorder {
 
    get title()             { return this._title; }
    set title(str)          { this._title = str; this.updateDL(str); }
    get addDateToTitle()    { return this._addDateToTitle; }
    set addDateToTitle(b)   { this._addDateToTitle = b; }

    set audioFormat(str)    { this._audioFormat = str; }
    get audioFormat()       { return this._audioFormat; }
    set audioCodec(str)     { this._audioCodec = str; }
    get audioCodec()        { return this._audioCodec; }

    set recordingFormat(str) {
        ///console.log( str);
        let start = str.indexOf(";");
        if (start == -1) { // not found
            let a = str.indexOf("/");
            this.audioFormat = str.slice(a);
            this.audioCodec = "";
        } else {
            let a = str.indexOf("/");
            let af = str.slice(a+1, start);
            //console.log(af);
            this.audioFormat = af;
            let ac = str.slice(start);
            this.audioCodec = ac;
            // console.log(ac);
       }
    }

    stopTimer(){
        if (this.timerId) {
            clearTimeout(this.timerId);
        }
        this.timerId = null;
        this.timer = 0;
        this.timerText.innerHTML = "";
    }

     inc_timer() {
        this.timer++;
        if (this.timer === MAX_TIME) {
            // stop mediarecorder - stop timer
            // this.mediaRecorder.stop();
        }
        this.timerId = setTimeout(this.inc_timer.bind(this), 1000);
    }

    updateTime(e) {
        if (this.audioElement.currentTime != 0)
         timerText.innerHTML ="<h2>" + createHMS(this.audioElement.currentTime) + "</h2>";
        else timerText.innerHTML = "";
    }
    pauseTimer(){
     //   clearTimeout(this.timerId);
    }
    resumeTimer(){
     //  this.timerId = setTimeout(this.inc_timer.bind(this), 1000);
    }
    errorCallback(err){
		RRR_error(err);
		RRR_fail(err);
	}
    constructor(source) {
        if (typeof MediaRecorder === 'undefined') {
            RRR_error("MediaRecorder not found");
            RRR_fail();
        } else {
            // browser is supported
        }

        this.addDateToTitle = false;
        this.audioFormat = "webm";
        this.audioCodec = ";codec=opus";
        this.timer = 0;
        this.timerId = null;
        this.title=null;
        this.hasDownloaded = false;
        this.timerTextDiv = null;
        this.canvasContext = null;
		this.mediaRecorder = null;
        this.playButton = document.getElementById("playButton");
        this.playButton.addEventListener ("click", (evt) => this.onBtnPlayClicked(evt));
        this.recordButton = document.getElementById("recordButton");
        this.recordButton.addEventListener ("click", (evt) => this.onBtnRecordClicked(evt));
        this.stopButton = document.getElementById("stopButton");
        this.stopButton.addEventListener ("click", (evt) => this.onBtnStopClicked(evt));
        this.audioElement = document.getElementById("audioElement");
        this.audioElement.addEventListener("timeupdate", (e) => this.updateTime(e));
        this.downloadLink = document.getElementById("downloadLink");

        this.timerText = document.getElementById("timerText");

 		this.source = source;  
		//this.isRecording = false;
        this.hasRecorded = false;
        this.audioContext = null;
        if (MediaRecorder.isTypeSupported("audio/ogg")){
            this.audioFormat = "ogg";
        }
        this.newRandTitle();
 	}

    newRandTitle() {
        let rand = Math.floor((Math.random() * 10000000));
        this.title = "audio_" + rand;
    }

	onBtnStopClicked() {
		this.stopTimer();
		if (!this.audioElement) this.audioElement = document.getElementById("audioElement");
		this.audioElement.pause();
		this.audioElement.currentTime = 0;
		if (!this.mediaRecorder){
			return;
		}
		if (this.mediaRecorder.state !== "inactive")
			this.mediaRecorder.stop();
	}

	startRecording(stream) {
        //if (this.canvasContext==null){
        //     this.canvasContext = document.getElementById("audioCanvas").getContext("2d");
        // }
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") { // already recording - pause
            this.mediaRecorder.pause();
            //this.isRecording=false;
            recordButton.classList.remove("Recording");
            recordButton.classList.add("Paused");
            return;
        }
        if (this.mediaRecorder && this.mediaRecorder.state === "paused"){
            // restart
            this.mediaRecorder.resume();
            recordButton.classList.add("Recording");
            recordButton.classList.remove("Paused");
           // this.isRecording = true;
           return;
        }

       // this.isRecording = true;
		this.stream = stream;
		//console.log("in startRecording())");
		if (this.audioContext===null) {
            //console.log("new audiocontext");
            this.audioContext = new AudioContext();
        }
		this.stopButton.disabled = false;
		//this.svgStop.style.fill=grey;
		this.chunks = [];
        //let lim = new RRLimiter(this.audioElement);
        //lim.setStreamSource(this.audioContext, this.stream);
		this.mediaRecorder = new MediaRecorder(this.stream, options);
		this.mediaRecorder.start();

		let url = window.URL || window.webkitURL;
		this.audioElement.muted = true;
		this.audioElement.srcObject = this.stream;
		this.audioElement.play();

        this.mediaRecorder.onpause = (e) => {
           //
           RRR_log("Pausing Recording....");
            this.audioElement.pause();
            this.pauseTimer();
            recordButton.classList.remove("Recording");
            recordButton.classList.add("Paused");
         };

        this.mediaRecorder.onresume = (e) => {
            RRR_log("Resuming recording...");
            this.audioElement.play();
            this.resumeTimer();
            recordButton.classList.add("Recording");
            recordButton.classList.remove("Paused");
         };

		this.mediaRecorder.ondataavailable = (e) => {
			RRR_log(e.data);
			this.chunks.push(e.data);
		};

		this.mediaRecorder.onerror = (e) => {
			this.stopTimer();
			errorReport('Error: ', e);
		};

		this.mediaRecorder.onstart = () => {
			RRR_log('Recording started, state = ' + this.mediaRecorder.state);
            recordButton.classList.add("Recording");
			//document.getElementById("Capa_1").style.fill = "#ffffff";
			setTimeout(this.inc_timer.bind(this), 1000);
		};

		this.mediaRecorder.onstop = () => {
			RRR_log('Recording stopped, state = ' + this.mediaRecorder.state);
			this.stopTimer();
            recordButton.classList.remove("Recording");
            recordButton.classList.remove("Paused");
            
			let blob = new Blob(this.chunks, { type: "audio/" + this.audioFormat + this.audioCodec });

			this.chunks = [];
			let audioURL = window.URL.createObjectURL(blob);
			downloadLink.href = audioURL;
			this.audioElement.src = audioURL;

			try {
				this.audioElement.srcObject = blob;
			} catch(err) {
				//RRR_error(err + "\nDefaulting to audioElement.srcObject...");
				this.audioElement.srcObject = null;
			}
            this.hasRecorded = true;
          //  this.isRecording = false;
			this.audioElement.muted = false;
			//  downloadLink.innerHTML = 'Download';
			//document.getElementById("downloadButton").disabled = false;
            let name="";
            if (!this.title) {
    			 let rand = Math.floor((Math.random() * 10000000));
    			 name = "audio_" + rand;
            } else {
                name = this.title;
            }
            if (this.addDateToTitle) {
                name += " " + new Date().toDateString();
            }

            this.updateDL(name);
            window.cancelAnimationFrame(this.rafID);
            // this.newRandTitle();
		};

		this.mediaRecorder.onwarning = (e) => {
			RRR_log('RRRecorder Warning: ' + e);
		};
		// Create an AudioNode from the stream.
		this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);

		// Create a new volume meter and connect it.
//		this.meter = new RRVolumeMeter(document.getElementById("RRRecorder"), this.audioContext, this.mediaStreamSource);
//		this.mediaStreamSource.connect(this.meter.processor);
//		visualize(stream);
		// kick off the visual updating
//		this.onLevelChange();
	}
    updateDL(name) {
        if (this.hasRecorded) {
            downloadLink.setAttribute("download", name);
            downloadLink.setAttribute("name", name);
            downloadLink.innerHTML = name;
            downloadLink.title = "Download " + name;
            downloadLink.addEventListener("click", (e) => {
                this.hasDownloaded = true;
            });
        }
    }

	onBtnPlayClicked() {
        // check if recording has been made
        if (!this.mediaRecorder) return false;
        if (this.mediaRecorder.state === "recording" || !this.hasRecorded)    return true;

		if (!this.audioElement) this.audioElement = document.getElementById("audioElement");
		this.audioElement.play();
	}

	async onBtnRecordClicked ()  {
		if (!this.audioElement){
            this.audioElement = document.getElementById("audioElement");
        }
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            this.mediaRecorder.pause();
            return false;
        }
        if (this.hasRecorded && !this.hasDownloaded) {
            let oc = window.confirm(WARNING_MESSAGE);
            if (!oc) { // don't record because user wants chance to download...
                return false;
            }
        }
        this.hasDownloaded = false;
        this.hasRecorded = false;
        downloadLink.innerHTML = "Download";
        downloadLink.removeAttribute("href");
        downloadLink.title = "Recording will become available to download here";
        this.startRecording(this.source);
	}

    onLevelChange(_time) {
        // clear the background
       // this.canvasContext.clearRect(0, 0, WIDTH, HEIGHT);

        // check if we're currently clipping
       // if (this.meter.checkClipping())
       //     this.canvasContext.fillStyle = "red";
       //  else
       //     this.canvasContext.fillStyle = "green";

        // console.log(meter.volume);

        // draw a bar based on the current volume
        //this.canvasContext.fillRect(0, 0, this.meter.getVolume() * WIDTH * 1.4, HEIGHT);

        // set up the next visual callback
        //this.rafID = window.requestAnimationFrame(this.onLevelChange.bind(this));
    }
}

/*
 *
 */
 function visualize(source, stream) {
  //var source = audioCtx.createMediaStreamSource(stream);

  var analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  var bufferLength = analyser.frequencyBinCount;
  var dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);
  //analyser.connect(audioCtx.destination);

  draw();

  function draw() {
    WIDTH = canvas.width;
    HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    var sliceWidth = WIDTH * 1.0 / bufferLength;
    var x = 0;

    for (var i = 0; i < bufferLength; i++) {

      var v = dataArray[i] / 128.0;
      var y = v * HEIGHT/2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();
  }
}
