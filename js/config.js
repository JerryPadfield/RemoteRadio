//
// config.js - stores the default configurations and loads the saved configurations (if any)
//
//
//
// Variables
const DEFAULT_CONFIG = {
  bitrate: 128,               // streaming bitrate 
  sampleSize: 16,             // not used...
  micDeviceId: null,          // mic ID on local machine if already previously successfully selected
  speakerDeviceId: null,      // ouput device (To be implemented...)
  headphoneWarningShown: false, // whether we've notified end user about wearing headphones when monitoring mic
  stereo: 1,
  remoteStudioID: null,       // remember last remote studio ID
};

var Config;
// load default values is stored on local machine...
if (localStorage.getItem("Config")!=null){
  Config = JSON.parse(localStorage.getItem("Config"));
}
else {
  Config = DEFAULT_CONFIG;
  saveStorage();
}

// called to save the variables
function saveStorage() {
	localStorage.setItem("Config", JSON.stringify(Config));
}
