// Based on the research, Electron 40 should support require('electron')
// Let's check if there's a timing/initialization issue

console.log('=== Electron Diagnostics ===');
console.log('process.type:', process.type);
console.log('process.versions.electron:', process.versions.electron);
console.log('process.versions.node:', process.versions.node);

// Try to access the API via different paths
const Module = require('module');
console.log('Module._resolveFilename:', typeof Module._resolveFilename);

// Check if electron's module is being registered at runtime
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, opts) {
  const resolved = origResolve.call(this, request, parent, isMain, opts);
  if (request.startsWith('electron')) {
    console.log(`Resolved "${request}" -> "${resolved}"`);
  }
  return resolved;
};

// After setting up the hook, try require('electron')
try {
  const e = require('electron');
  console.log('electron after hook:', typeof e, typeof e === 'string' ? e : 'object');
} catch(e) {
  console.log('electron error:', e.message.slice(0,80));
}
