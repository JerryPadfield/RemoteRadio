//
//
//
//
//
var theAudioContext;

class Deck {
    time=0;
    timerId=null;
    file = null;
    destinationStream=null;
    isPlaying=false;
    gainNode=null;

    onAudioFinished(){
        this.stop();
    }
    constructHTML(){
        this.div=document.createElement("div");
        this.div.setAttribute("class", "RRDeck");
        this.div.addEventListener("click", (evt) => this.onClick(evt));
        this.div.addEventListener("mouseenter", (evt) => this.onMouseEnter(evt));
        this.div.addEventListener("mouseleave", (evt) => this.onMouseLeave(evt));
        this.audio=document.createElement("audio");
        this.audio.addEventListener("ended", (e) => this.onAudioFinished(e))
        this.div.insertAdjacentElement('afterBegin', this.audio);
        this.text=document.createTextNode("File:"+(this.file?this.file:"Click to load"));
        this.div.appendChild(this.text);
        document.getElementById("main").appendChild(this.div);
    }
    constructor(ds=null){
        this.file=null;
        this.destinationStream=ds;
        this.input=null;
    }
    filePicked(){
        let f=this.input.files[0];
        let fu=blob.createObjectURL(f);
        console.log(f+", "+fu);
        this.file = fu;
        this.audio.src=this.file;
        this.text.data=(f.name);
        //console.log(selectedFile);
    }
    onClick(){
        if (this.file) {
            //console.log("Clicked:"+ this.id);
            if (!this.isPlaying) {
                this.play();
            }
            else {
                this.stop();
             }
        }  else {
            this.input = document.createElement("input");
            this.input.setAttribute("type", "file");
            // add onchange handler if you wish to get the file :)
            let ev=document.createEvent("MouseEvents");
            ev.initEvent("click", true, true);
            this.input.addEventListener("change", () => this.filePicked());
            this.input.dispatchEvent(ev); // opening dialog
            return false;
        }
    }
    onMouseEnter(e){
        if (!this.isPlaying)
            this.div.style.backgroundColor = "lightblue";
        else
             this.div.style.backgroundColor = "lightgreen";           
    }
    onMouseLeave(e){
        if (!this.isPlaying)
            this.div.style.backgroundColor = "blue";
        else
            this.div.style.backgroundColor = "green";

    }
    play(){
        this.audio.play();
        this.isPlaying=true;
        this.div.style.backgroundColor = "green";
    }
    stop(){
        this.audio.pause();
        this.audio.currentTime=0;
        this.isPlaying=false;
        this.div.style.backgroundColor = "blue";
      }
}
class Decks {
    leftDeck = null;
    rightDeck = null;
    constructor(){
        leftDeck  = new Deck();
        rightDeck = new Deck();

    }
    crossFade(){
        
    }
}