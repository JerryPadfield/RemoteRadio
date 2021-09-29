/**
 *
 *
 *
 *
 */
//<div class="controls">
//  <input type="range" value="0" step="1" min="0" max="12" id="RR_range" />
//  <span class="value" id="RR_maximize-db">6</span> <span class="unit">dB</span>
//  <div id="RR_reduction"></div>
//</div>

const SHOW_REDUCTION = true;
const MIN_RANGE = -30;
const MAX_RANGE = 20;

class RRLimiter {

    reset() {
        this.gain = 0;
        this.range.disabled = true;
        //this.source=null;
        //delete this.source;
    }
    setAudioSource(context, source, connectToOutput=true, dest=null){
      if (!this.source) {
        this.source = context.createMediaElementSource(source);
        this.createAudioChain(context, connectToOutput, dest);
      }
      
      this.range.disabled = false;
    }

    setAudioNodeSource(context, source, connectToOutput=true, dest=null){
      if (!this.source) {
        this.source = source; //context.createMediaElementSource(source);
        this.createAudioChain(context, connectToOutput, dest);
      }
      
      this.range.disabled = false;
    }
    getAudioSource() { return this.source; } // LOSE THI!!!!!!!\
    
    set threshold(t) {
        this.limiter.threshold.value = t;
    }

    talkback() {
        if (!this.limiter) {
            //console.log("No limiter");
            return;
        }
        if (!this.talkingBack) {
            this.limiter.disconnect(remoteBussGain);
            this.limiter.disconnect(outputBuss);
            this.talkingBack = true;
        } else {
            this.limiter.connect(remoteBussGain);
            this.limiter.connect(outputBuss);
            this.talkingBack = false;
        }
    }
    createAudioChain(context, connectToOutput=true, dest){
        this.preGain = context.createGain();
        this.preGain.gain.value = this.dbToGain(-6);
        this.limiter = context.createDynamicsCompressor();
        this.limiter.threshold.value = -0.1;    // this is the pitfall, leave some headroom
        this.limiter.knee.value = 0.0;          // brute force
        this.limiter.ratio.value = 20.0;        // max compression
        this.limiter.attack.value = 0.005;      // 5ms attack
        this.limiter.release.value = 0.050;     // 50ms release
        this.source.connect(this.preGain);
        this.preGain.connect(this.limiter);

        if (connectToOutput) {
            this.limiter.connect(outputBuss /*context.destination */);
        }
        //console.log(mixedAudio);
        if (!dest) {
            this.limiter.connect(/* mixedAudio */ recorderBuss);
            if (!talkingBack) this.limiter.connect (remoteBussGain);
        }
        else {
            this.limiter.connect(dest);
            // FUDGE!
            if (!talkingBack) this.limiter.connect(remoteBussGain);
        }

  //    this.range=document.getElementById("RR_range");
        window.requestAnimationFrame(this.showReduction.bind(this));
    }

    setStreamSource(context, stream, connectToOutput=true, dest=null){
        this.source = context.createMediaStreamSource(stream);
        this.createAudioChain(context, connectToOutput, dest);
        this.range.disabled = false;
    }

    // create a limiter
    // pass in baseaudiocontext & audio element 
    constructor(parent){
        // create HTML
                this.talkingBack = false;
        let d = document.createElement("div");
        d.classList.add("controls");
        this.range = document.createElement("input");
        this.range.type  = "range";
        this.range.value = 0;
        this.range.step  = 1;
        this.range.min   = MIN_RANGE;
        this.range.max   = 12;
        this.range.setAttribute("id", "RR_range" + Date.now());
        this.range.addEventListener("input", (e) => this.onRangeInput(e));
        this.range.addEventListener("click", function(e) {e.stopPropagation();});
        this.range.addEventListener("dblclick", (e) => this.onRangeDblClick(e));
        this.range.disabled = true;
        d.appendChild(this.range);
        this.label = document.createElement("span");
        this.label.classList.add("value");
        this.label.setAttribute("id", "RR_maximize-db"+Date.now());
	    this.label.textContent = this.range.value;
        d.appendChild(this.label);
        if (SHOW_REDUCTION) {
            this.reduction = document.createElement("div");
            this.reduction.classList.add("RR_reduction");
            d.appendChild(this.reduction);
        }
        if (parent) { 
            parent.appendChild(d);
        }
    }
    // when double clicked reset to no gain
    onRangeDblClick(e) {
        this.gain = 0;
    }
    onRangeInput(e) {
        //console.log(e);
        let v = e.target.value;
        this.maximize(v);
    }
    dbToGain(db) {
        return Math.exp(db*Math.log(10.0)/20.0);
    }
    maximize(v) {
        if (this.preGain) {
    	    if (v <= MIN_RANGE) v = -120;
                this.gain = v;
	   }
    }

    set gain(v) {
        // knock off 6dB - KLUDGE
        if (this.preGain) {
            this.preGain.gain.setValueAtTime(this.dbToGain(v-6), theAudioContext.currentTime);
        }
        this.label.textContent = Math.round(v);
        this.range.value = v;
    }
    get gain() {
        if (this.preGain)
            return this.preGain.gain.value;
    }
    showReduction() {
        if (SHOW_REDUCTION) {
            this.reduction.style.marginRight = (100-(this.dbToGain(this.limiter.reduction)*100))+"%";
            window.requestAnimationFrame(this.showReduction.bind(this));  
        }
    }
}

// export class RRLimiter