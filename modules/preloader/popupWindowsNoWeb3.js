/**
@module preloader PopupWindows
*/

require('./include/common')('popupWindow');
const { ipcRenderer, remote, webFrame } = require('electron');
const divan = require('./include/divanAPI.js');
const dbSync = require('../dbSync.js');
require('./include/setBasePath')('interface');
require('./include/openExternal.js');


// receive data in from SendData
ipcRenderer.on('uiAction_sendData', (e, data) => {
    Session.set('data', data);
});

window.divan = divan();
window.divanMode = remote.getGlobal('mode');
window.dirname = remote.getGlobal('dirname');
window.dbSync = dbSync;
window.ipc = ipcRenderer;
