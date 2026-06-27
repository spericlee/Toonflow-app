// Electron 40 requires different approach for built-in modules
// Try to find the real electron API

// Method 1: Check if 'electron' resolves differently via electron's internal loader
const Module = require('module');
const origResolve = Module._resolveFilename;

// Method 2: Electron bundles its API in the binary
try {
  const http = require('http');
  console.log('http ok');
} catch(e) {}

// Method 3: Check node_modules/electron from electron's perspective
const path = require('path');
const electronPkg = path.join(process.cwd(), 'node_modules/electron');
console.log('cwd:', process.cwd());
console.log('electron pkg dir:', electronPkg);

// Method 4: In Electron 40, try electron built-in
try {
  // Some versions expose via this pattern
  const el = require(path.join(electronPkg, 'dist', 'resources', 'electron.api'));
  console.log('electron api:', typeof el);
} catch(e) {
  console.log('no electron.api file');
}

// Method 5: Check for electron built-in require
try {
  // In Electron main process, sometimes you can use
  const { app } = require('original-fs') ? {} : {};
} catch(e) {}

// Method 6: Process bindings
try {
  const bindings = process.binding('natives');
  console.log('natives keys:', Object.keys(bindings).filter(k => k.includes('electron')).slice(0,5));
} catch(e) {
  console.log('process.binding error:', e.message);
}

console.log('Done');
