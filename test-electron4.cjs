console.log('process.type:', process.type);
console.log('process.versions.electron:', process.versions.electron);

// In newer Electron, use the electron internal require
const { app, BrowserWindow } = require('@electron/remote') || {};
console.log('remote app:', typeof app);
