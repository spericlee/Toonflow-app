// Use vm to execute the browser_init bundle and extract API
const vm = require('vm');
const natives = process.binding('natives');
const browserInitSrc = natives['electron/js2c/browser_init'];

// Create a sandbox with the necessary globals
const sandbox = {
  require: require,
  process: process,
  console: console,
  Buffer: Buffer,
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval,
  global: global,
  module: { exports: {} },
  exports: {},
  __dirname: __dirname,
};

try {
  vm.runInNewContext(browserInitSrc, sandbox, { filename: 'electron/js2c/browser_init' });
  console.log('executed browser_init successfully');
  console.log('sandbox module exports:', Object.keys(sandbox.module.exports).slice(0,10));
} catch(e) {
  console.log('error:', e.message.slice(0,200));
}
