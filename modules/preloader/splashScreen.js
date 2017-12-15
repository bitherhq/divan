require('./include/common')('splashscreen');
require('./include/web3CurrentProvider.js');
const divan = require('./include/divanAPI.js');
const { ipcRenderer, remote, webFrame } = require('electron');

require('./include/openExternal.js');
require('./include/setBasePath')('interface');

// set appmenu language
ipcRenderer.send('backendAction_setLanguage');

// disable pinch zoom
webFrame.setZoomLevelLimits(1, 1);

window.ipc = ipcRenderer;
window.divan = divan();
window.divanMode = remote.getGlobal('mode');
window.dirname = remote.getGlobal('dirname');
