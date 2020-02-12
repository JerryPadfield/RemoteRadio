//
// config.js - stores the default configurations and loads the saved configurations (if any)
//
//
//
// Variables
var bitrate = 128;  // streaming bitrate
var defaultDevice = 0;
var isStereo = true;
var sampleSize = 16;
var micMuted = false;

// load variables
if (localStorage.bitrate) {
  bitrate = localStorage.bitrate;
}
if (localStorage.defaultDevice) {
    defaultDevice = localStorage.defaultDevice;
}
if (localStorage.isStereo){
    isStereo = localStorage.isStereo;
}
if (localStorage.sampleSize){
    sampleSize = localStorage.sampleSize;
}
if (localStorage.micMuted){
    sampleSize = localStorage.sampleSize;
}

// called to save the variables
function saveStorage() {
  localStorage.bitrate = bitrate;
  localStorage.defaultDevice = defaultDevice;
  localStorage.isStereo = isStereo;
  localStorage.sampleSize = sampleSize;
  localStorage.micMuted = micMuted;
}
