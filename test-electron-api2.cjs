// Check if we can use electron's internal require
const Module = require('module');

// Electron patches Module._resolveFilename for built-in modules
// The prefix is 'electron/' in the natives
try {
  const el = require('electron/js2c/browser_init');
  console.log('browser_init type:', typeof el);
} catch(e) {
  console.log('browser_init error:', e.message);
}

// Try the actual electron API key
try {
  const el = require('electron');
  console.log('electron require returns:', typeof el, String(el).slice(0,80));
} catch(e) {
  console.log('electron require error:', e.message);
}

// Check if electron's own require function is available
// In newer electron, there's a special require for built-in modules
try {
  // electron_browser_app, electron_browser_window etc.
  const keys = Object.keys(process).filter(k => k.includes('electron') || k.includes('binding'));
  console.log('process electron keys:', keys);
} catch(e) {
  console.log('process keys error:', e.message);
}

// Try electron built-in bindings
try {
  for (const key of ['electron_browser_app', 'electron_browser_window', 'electron_app', 'electron_browser']) {
    try {
      const v = process._linkedBinding(key);
      console.log(`${key}:`, typeof v);
    } catch(e) {
      console.log(`${key}:`, e.message);
    }
  }
} catch(e) {
  console.log('linked binding error:', e.message);
}

console.log('process.type:', process.type);
