/*
 * Volume Meter
 *
 * Moved away from using a canvas for performance issues
 * Issues:
 *   + Clipping detection is a bit of a kludge as using bytes is not very accurate
 *   + ?
 */
const CLIP_THRESHOLD = 20;
const MeterMode = {
    PEAK: 0,
    RMS: 1,
};
var canvases=0;
class RRVolumeMeter {

    // d = HTML div to append to
    // audioCtx = audio context
  constructor(d, audioCtx, source, muted=true, dir="vertical") {
    this.clipping = false;
    this.lastClip = 0;
    this.clipLag  = 250;
    this.clipLevel = 250;
    this.mode = MeterMode.RMS;
    this.klipKludge = 0;

    this.analyser = audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.bufferLength = 128; // this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    //this.dataArray = new Float32Array(this.bufferLength);

	source.connect(this.analyser);
  //  this.canvas = document.createElement("canvas");
    this.canvas = document.createElement("div");
    this.canvas.setAttribute("id", "audioCanvas"+canvases++);
    this.canvas.classList.add("audioCanvas");

    //this.canvas.width =  d.offsetWidth - 4;
    //this.canvas.height = d.offsetHeight - 26;

   // this.canvas.style.position = "absolute"
    this.canvas.style.width = d.offsetWidth - 4 +"px";
    this.canvas.style.height = d.offsetHeight - 26 +"px";

    this.height = d.offsetHeight;

    //this.canvasCtx = this.canvas.getContext("2d");
    this.dir = dir;
    if (this.dir === "vertical") {
        //this.canvas.style.opacity = 0.9;
    }
    if (d) {
      d.appendChild(this.canvas);
    }

    this.volume = 0;
    this.averaging = 0.95;
    //this.image = new Image(this.canvas.width, this.canvas.height);
    //this.image.src = "./images/microphone.png";
   // this.image.onload = () => this.draw;
    this.draw();
    this.muted = muted;
    }

	mute() {
		if (!this.muted){
			this.muted=true;
		}
  }
	unmute() {
		this.muted = false;
	}

    disconnect(d) {
        this.analyser.disconnect();
        d.removeChild(this.canvas);
        this.canvas = null;
    }

    dump() {
        console.log(this.dataArray);
    }
    getVolume() {
         this.analyser.getByteFrequencyData(this.dataArray);
        //this.analyser.getFloatFrequencyData(this.dataArray);
        var total =  0;
        if (this.mode == MeterMode.RMS) {
        for (let i = 0; i < this.dataArray.length; i++) {
            let x = this.dataArray[i];
            total += (x*x);
            if (Math.abs(x) >= this.clipLevel) {
                // console.log(this.klipKludge);
                this.klipKludge++;

                if (this.klipKludge > CLIP_THRESHOLD) {
                    this.clipping = true;
                    this.lastClip = window.performance.now();
                }
            }
            }
            let rms = Math.sqrt(total/this.dataArray.length);
            return Math.max(rms, this.volume * this.averaging);
         }
        else { 
            let peak = Math.max.apply(null, this.dataArray);

            if (peak >= this.clipLevel) {
                //console.log(peak);
                this.klipKludge++;
               if (this.klipKludge > CLIP_THRESHOLD) {
                this.clipping = true;
                this.lastClip = window.performance.now();
              }
            }
            return peak;
        }
    }

    get isClipping() {
        if (!this.clipping)
            return false;
        if ((this.lastClip + this.clipLag) < window.performance.now()) {
            this.clipping = false;
            this.klipKludge = 0;
        }
        return this.clipping;
    }

  draw() {
    /*
    if (!this.canvas) return;
    if (this.canvasCtx == null) {
       this.canvasCtx = this.canvas.getContext("2d");
    }

    let w = this.canvas.width;
    let h = this.canvas.height;

    requestAnimationFrame(this.draw.bind(this));

    this.volume = this.getVolume();
    // console.log(this.volume);
    // draw a bar based on the current volume
    if (!this.muted)
        this.canvasCtx.fillStyle = "green";
    else
        this.canvasCtx.fillStyle = "lightGrey";
    this.canvasCtx.fillRect(0, 0, w, h);
    let v = Math.round(this.volume);
    //console.log(v);
    const SCALE = 256; //1;
    let ratio = (v/SCALE)*h*1.4;

    if (this.dir == "horizontal")
        ratio = (v/SCALE)*w*1.41;

    if (this.mode == MeterMode.PEAK)
        ratio/= 1.4;
    // console.log(ratio);
    this.canvasCtx.fillStyle = "yellow";
    if (this.isClipping) {
         this.canvasCtx.fillStyle = "red";
    //    let m="#ff" + Math.max(0, 256-this.klipKludge).toString(16) + "00";
    //    console.log(m);
        
    //    this.canvasCtx.fillStyle = m;
    }
    //this.canvasCtx.fillStyle = 'hsl(' + 256-Math.round(v/2.5) + ', 50, 50)';
    //this.canvasCtx.fillStyle = 'rgb(' + Math.round(v*2) + ', 255, 0)';
    if (this.dir == "vertical") 
        this.canvasCtx.fillRect(0, (h - ratio), w, ratio);
    else this.canvasCtx.fillRect(0, 0, ratio, h);
    this.canvasCtx.strokeText("Vol:" + v, 10, 10);

    if (this.dir=="vertical") this.canvasCtx.drawImage(this.image, 0, 0, w, h);
    */
    if (!this.canvas)
        return;
    this.volume = this.getVolume();
    //RRDebug(this.volume);
    if (this.muted)
        this.canvas.style.color = "lightGrey";
    else {
        if (this.isClipping) {
            this.canvas.classList.add("Clipping");
        }
        else  {
            this.canvas.classList.remove("Clipping");
        }
    }
    if (this.dir === "vertical") {
        let height = (this.volume/256);
        height = height * 100;
        if (this.mode == MeterMode.RMS)
            height *= 1.4;
        //console.log(height);
        let pc = Math.round(height);
        this.canvas.style.height = pc + "%";
        this.canvas.style.top = 98-pc + "%";
    }
    else { // horizontal
        let w = this.volume/256;
        w = w * 100;
            if (this.mode == MeterMode.RMS)
                w*=1.4;
        this.canvas.style.width = Math.round(w) + "%";
    }
    window.requestAnimationFrame(this.draw.bind(this));
  }
}
