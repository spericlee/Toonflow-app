// Try accessing the native electron modules via process.binding
try {
  const natives = process.binding('natives');
  // Try to actually load browser_init
  const browserInitSource = natives['electron/js2c/browser_init'];
  if (browserInitSource) {
    console.log('browser_init source length:', browserInitSource.length);
    console.log('browser_init first 200 chars:', browserInitSource.slice(0, 200));
  }
} catch(e) {
  console.log('error:', e.message);
}

// Try the built-in require for electron in newer Node
try {
  // In newer node, internal modules can be loaded
  console.log('internalBinding:', typeof process.internalBinding);
} catch(e) {}

// Try require('node:electron') - new scheme
try {
  const e = require('node:electron');
  console.log('node:electron type:', typeof e);
} catch(e) {
  console.log('node:electron error:', e.message.slice(0,60));
}
