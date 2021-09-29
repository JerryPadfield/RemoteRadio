/*
 * Audio Player class
 *
 *
 *
 */
//import { RRLimiter } from 'RRLimiter.js'

var blob = window.URL || window.webkitURL;
const DEFAULT_TEXT = "Click to load";
const MAX_PLAYERS = 12;

class RRSampler {
 
    // static _numPlayers=0;  // static property breaks Safari completely when declared this way
    static get numPlayers()  { return RRSampler._numPlayers; }
    static set numPlayers(a) { RRSampler._numPlayers = a; }
 
    set gain(v) {
        if (this.file)
            this.lim.gain = v;
    }
    get gain() {
        return this.lim.gain.value;
    }
    getSrc(src) {
        return fetch(src)
            .then(function(response) {
                return response.arrayBuffer()
            });
    }

    handleDragDrop() {
        this.div.addEventListener("drop", (evt) => this.onDrop(evt));
        this.div.addEventListener("dragenter", (evt) => this.onDragEnter(evt));
        this.div.addEventListener("dragover", (evt) => this.onDragOver(evt));        
    }
    createHTML() {
        this.div = document.createElement("div");
        this.div.classList.add("RRSampler");
        this.div.title = "Blue = file loaded, Green = playing, Red = less than 10 seconds left";
        this.div.setAttribute("id", "RRSampler_"+this.id);
        this.div.insertAdjacentElement('afterBegin', this.audio);
        this.div.addEventListener("click", (evt) => this.onClick(evt));
        var p = document.createElement("p");
        var p2 = document.createElement("p");
        this.timeText=document.createTextNode(createHMS(0)+"/"+createHMS(0));
        this.filenameText = document.createTextNode((this.file?this.file:DEFAULT_TEXT));
        p.appendChild(this.timeText);
        p2.appendChild(this.filenameText);
        this.div.appendChild(p);
        this.div.appendChild(p2);
        this.ejectButton = document.createElement("button");
        this.ejectButton.innerText="^";
        this.ejectButton.setAttribute("class", "RREjectButton");
        this.ejectButton.addEventListener("click", (e) => this.eject(e));
        this.ejectButton.disabled=true;
        this.ejectButton.title="Eject currently loaded file";
        this.div.insertAdjacentElement("beforeEnd", this.ejectButton);
        document.getElementById("samplers").appendChild(this.div);
    } 
    onAudioFinished() {
        this.stop();
    }
    onDrop(e) {
        e.preventDefault();
        const data = e.dataTransfer.files;
        this.filePicked(data);
    }

    talkback() {
        this.lim.talkback();
    }
    constructor(fn=null, ds=null) {
        if (RRSampler.numPlayers++ >= MAX_PLAYERS) {
            throw "Too many players";
            return;
        }
        this.time = 0;
        this.timerId = null;
        this.file = null;
        this.destination = null; // destination for audio
        this.isPlaying = false;
        this.track = null;

        this.id = RRSampler.numPlayers; //Date.now();
        this.file = fn;
        this.fname = fn;
        this.destination = ds;
        this.audio = new Audio();
        this.audio.addEventListener("ended", (e) => this.onAudioFinished(e))
        this.input = null;
        this.fileReader = null;
        this.createHTML();
        this.handleDragDrop();
        this.lim = new RRLimiter(this.div);

        if (this.file) this.audio.src = this.file;
        this.analyser = null;
    }

    eject(e) {
        this.stop();
        this.file = null;
        this.fname = null;
        if (this.audio) {
            this.audio.removeAttribute('src');
        }
        //this.filenameText.data=DEFAULT_TEXT;
        this.div.classList.remove("RRSampler_loaded");
        this.ejectButton.disabled=true;
        this.setInfo(createHMS(0)+"/"+createHMS(0));
        event.stopPropagation();
        this.lim.reset();
    }
    // triggered when user wants to load a new file
    filePicked(files=null) {
        // check if loaded/playing and return if so...
        if (this.file!==null) {
            statusReport("Audio file already loaded. Please eject first...");
            return;
        }
        let f = null;
        if (this.input) 
            f = this.input.files[0];
        else f = files[0];
        //RRDebug(f.webkitRelativePath);
        if (!f) return;
        let ext = f.name.match(/\.([^\.]+)$/);
        if (ext.length > 0) {
            ext = ext[1];
        } else { // no extension
            ext = null;
        }
        switch (ext) {
            case 'wav':
            case 'mp3':
            case 'ogg':
            case 'm4a':
            case 'weba':
            case 'aiff':
            case 'flac':
            case 'webm':
            case 'opus':
            case 'au':
            case 'aac':
            case 'wma':
            case 'oga':
            case null: // try it anyway?
            // case 'mid': // won't play
                break;
            default:
                alert('Only audio files allowed...');
                return;
        }

        // allow user to play in page
        let fu = blob.createObjectURL(f);
        //console.log(f+", "+fu);
        this.file = fu;
        this.audio.src = this.file;
        this.fname = f.name;
        this.div.classList.add("RRSampler_loaded");
        if (this.lim) {
            this.lim.setAudioSource(theAudioContext, this.audio);
        }
        // when file is loaded set the duration info
        // - can't do this until file is first durationchange event
        this.audio.ondurationchange = (evt) => {
            this.ejectButton.disabled=false;
        	this.setInfo(createHMS(0)+"/"+createHMS(Math.round(this.audio.duration)));
        };
    }

    onDragEnter(e) {
        e.preventDefault();
    }
    onDragOver(e) {
        e.preventDefault();
    }
    onClick() {
        if (this.file) {
            if (!this.isPlaying) {
                this.play();
            }
            else {
                this.stop();
            }
        } else { // load a file from disk
            this.input = document.createElement("input");
            this.input.setAttribute("type", "file");
            this.input.accept = "audio/*";
            let ev = document.createEvent("MouseEvents");
            ev.initEvent("click", true, true);
            this.input.addEventListener("change", () => this.filePicked());
            this.input.dispatchEvent(ev); // opening dialog
            return false;
        }
    }

    play() {
        if (this.isPlaying) return;
 
        this.audio.play();
        this.isPlaying = true;
        this.timerID = window.setInterval(() => this.showInfo(), 1000);
        this.div.classList.replace("RRSampler_loaded", "RRSampler_playing");
    }
    stop() {
        if (!this.isPlaying) return;
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        clearInterval(this.timerID); this.timerID=null;
        this.setInfo(createHMS(0)+"/"+createHMS(Math.round(this.audio.duration)));
        this.div.classList.replace("RRSampler_playing", "RRSampler_loaded");
    }
	setInfo(str) {
		this.timeText.data = str;
		this.filenameText.data = (this.fname?this.fname:DEFAULT_TEXT);
	}
    showInfo(){ // update audio info
        let tac = this.audio.currentTime;
        this.setInfo(createHMS(tac)+ "/"+createHMS(Math.round(this.audio.duration)));
    }
}
// replace this with static declaration in class body when Safari implements it correctly
RRSampler._numPlayers = 0;

class RRPlayer extends RRSampler {
    createHTML() {
        this.div = document.createElement("div");
        this.div.classList.add("RRPlayer");
        this.div.setAttribute("id", "RRPlayer_"+this.id);
        this.div.addEventListener("click", (evt) => this.onClick(evt));
        this.div.insertAdjacentElement('afterBegin', this.audio);
        var p = document.createElement("p");
        var p2 = document.createElement("p");
        this.timeText = document.createTextNode(createHMS(0)+"/"+createHMS(0));
        this.filenameText = document.createTextNode((this.file?this.file:DEFAULT_TEXT));
        p.appendChild(this.timeText);
        p2.appendChild(this.filenameText);
        this.div.appendChild(p);
        this.div.appendChild(p2);
        this.ejectButton = document.createElement("button");
        this.ejectButton.innerText="^";
        this.ejectButton.disabled=true;
        this.ejectButton.setAttribute("class", "RREjectButton");
        this.ejectButton.addEventListener("click", (e) => this.eject(e));
        this.div.insertAdjacentElement("beforeEnd", this.ejectButton);
        document.getElementById("songs").appendChild(this.div);
    } 
    constructor(fn=null, ds=null){
        super(fn, ds);
    }
    showInfo() {
        super.showInfo();
            if (this.audio.duration-this.audio.currentTime <= 10) { // track ending in 10 seconds
                this.div.classList.replace("RRSampler_playing", "RRPlayer_ending");
                // send message to all peers that song is ending soon
                sendChatToAll(RRCommand.SONG_ENDING);
        }
    }
    stop(){
        super.stop();
        this.div.classList.replace("RRPlayer_ending", "RRSampler_loaded");
    }
}

/*

class RRAudioMeter {

    audioCtx=null;
    canvas=null;
    canvasCtx=null;

    visualize(source, stream) {
        //var source = audioCtx.createMediaStreamSource(stream);

        var analyser = this.audioCtx.createAnalyser();
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

    constructor(audioContext, clipLevel=0.98, averaging=0.95, clipLag=750) {
        this.audioCtx = audioContext;
        var processor = audioContext.createScriptProcessor(512);
        processor.onaudioprocess = (e) => this.volumeAudioProcess(e);
        processor.clipping = false;
        processor.lastClip = 0;
        processor.volume = 0;
        processor.clipLevel = clipLevel;
        processor.averaging = averaging;
        processor.clipLag = clipLag;

        // this will have no effect, since we don't copy the input to the output,
        // but works around a current Chrome bug.
        processor.connect(audioContext.destination);

        processor.checkClipping =
            function() {
                if (!this.clipping)
                    return false;
                if ((this.lastClip + this.clipLag) < window.performance.now())
                    this.clipping = false;
                return this.clipping;
            };

        processor.shutdown =
            function(){
                this.disconnect();
                this.onaudioprocess = null;
            };
    }
/*
    volumeAudioProcess(event) {
        var buf = event.inputBuffer.getChannelData(0);
        var bufLength = buf.length;
        var sum = 0;
        var x;

    // Do a root-mean-square on the samples: sum up the squares...
    for (var i = 0; i < bufLength; i++) {
        x = buf[i];
        if (Math.abs(x) >= this.clipLevel) {
            this.clipping = true;
            this.lastClip = window.performance.now();
        }
        sum += x * x;
    }

    // ... then take the square root of the sum.
        var rms =  Math.sqrt(sum / bufLength);

    // Now smooth this out with the averaging factor applied
    // to the previous sample - take the max here because we
    // want "fast attack, slow release."
        this.volume = Math.max(rms, this.volume * this.averaging);
    }
*/
//}
