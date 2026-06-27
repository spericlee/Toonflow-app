const electron = require('electron');
console.log('electron type:', typeof electron);
console.log('is obj:', typeof electron === 'object');
if (typeof electron === 'object') {
  console.log('has app:', 'app' in electron);
  console.log('app type:', typeof electron.app);
  if (electron.app) {
    console.log('app.getName():', electron.app.getName());
  }
} else {
  console.log('electron is string:', electron);
}
