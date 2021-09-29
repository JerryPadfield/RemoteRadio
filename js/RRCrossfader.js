/*
 *
 */
class RRCrossfader {

    constructor(player1, player2){ 
 /*       this.gainNode1 = theAudioContext.createGain();
        ctl1.connect(this.gainNode1);
        this.gainNode2 = theAudioContext.createGain();
        ctl2.connect(this.gainNode2);
        this.mainGain = theAudioContext.createGain();
        this.gainNode1.connect(this.mainGain);
        this.gainNode2.connect(this.mainGain);       
*/
        this.player1 = player1;
        this.player2 = player2;
        this.fader = document.getElementById("crossfader");
        this.fader.oninput = (evt) => this.onChange(evt);
        this.fader.ondblclick = (evt) => this.ondblclick(evt);
    }

    reset() {
        this.fader.value = "0";
        this.player1.gain = 0;
        this.player2.gain = 0;
    }
    ondblclick(evt) {
        this.reset();
        evt.stopPropagation();
    }
    moveLeft(amt=1) {
        this.fader.value -= amt;
        this.update(this.fader.value);
    }
    moveRight(amt=1) {
        //console.log(amt+" "+ this.fader.value);
        this.fader.value++; 	// broken - WHY??? = amt;
        this.update(this.fader.value);
    }
    onChange(evt) {
        let v = evt.target.value;
        //console.log(x);
        this.update(v);
	}
	update(v) {
        var gain1, gain2;
        if (v > 0) { //turn down left deck 
            gain1 = 0 - v;
            gain2 = 0;
        } else {	// turn down right deck
            gain2 = 0 - Math.abs(v);
            gain1 = 0;
        }
        this.player1.gain=gain1;
        this.player2.gain=gain2;
  }
}
