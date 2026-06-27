const electron = require('electron');
console.log('type:', typeof electron);
console.log('is string:', typeof electron === 'string');
if (typeof electron === 'object') {
  console.log('has app:', 'app' in electron);
} else {
  console.log('value (first 100 chars):', String(electron).slice(0,100));
}
