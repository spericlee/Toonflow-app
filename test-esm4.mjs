import electron from 'electron';
console.log('constructor:', electron.constructor.name);
console.log('typeof:', typeof electron);

// Check all properties including non-enumerable
const props = Object.getOwnPropertyNames(electron);
console.log('ownProps:', props.slice(0,20));

// Check for specific APIs
console.log('app:', typeof electron.app);
console.log('BrowserWindow:', typeof electron.BrowserWindow);
console.log('dialog:', typeof electron.dialog);
console.log('ipcMain:', typeof electron.ipcMain);
console.log('screen:', typeof electron.screen);
console.log('shell:', typeof electron.shell);

// Maybe it's a namespace-like object with getters?
const desc = Object.getOwnPropertyDescriptor(electron, 'app');
console.log('app descriptor:', desc ? (desc.get ? 'getter' : 'value:' + typeof desc.value) : 'none');
