try {
  const electronMain = require('electron/main');
  console.log('electron/main type:', typeof electronMain);
  console.log('electron/main is obj:', typeof electronMain === 'object');
  if (typeof electronMain === 'object') {
    console.log('keys:', Object.keys(electronMain).slice(0, 15));
    console.log('app:', typeof electronMain.app);
    console.log('BrowserWindow:', typeof electronMain.BrowserWindow);
  }
} catch(e) {
  console.log('electron/main error:', e.message.slice(0, 100));
}

try {
  const electronRenderer = require('electron/renderer');
  console.log('electron/renderer:', typeof electronRenderer);
} catch(e) {
  console.log('electron/renderer error:', e.message.slice(0, 100));
}

try {
  const electronCommon = require('electron/common');
  console.log('electron/common:', typeof electronCommon);
} catch(e) {
  console.log('electron/common error:', e.message.slice(0, 100));
}
