const Module = require('module');

// Monkey-patch to see what happens during resolution
const orig = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, opts) {
  const result = orig.call(this, request, parent, isMain, opts);
  if (request === 'electron' || request.includes('electron')) {
    console.log(`resolve: "${request}" -> "${result}" from ${parent.filename}`);
  }
  return result;
};

// Now try requiring electron
try {
  const electron = require('electron');
  console.log('electron type:', typeof electron);
  if (typeof electron === 'string') {
    console.log('electron is path string:', electron);
  }
} catch(e) {
  console.log('error:', e.message);
}
