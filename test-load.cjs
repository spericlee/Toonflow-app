const Module = require('module');
const origLoad = Module._load;
Module._load = function(request, parent, isMain) {
  const result = origLoad.apply(this, arguments);
  if (request === 'electron' || request.startsWith('electron/')) {
    console.log(`_load: "${request}" from ${parent ? parent.filename : 'null'}`);
    console.log(`  result type: ${typeof result}`);
    console.log(`  result: ${typeof result === 'string' ? result.slice(0,80) : (typeof result === 'object' ? Object.keys(result).slice(0,5).join(',') : result)}`);
  }
  return result;
};

try {
  const e = require('electron');
  console.log('\n--- Final result ---');
  console.log('type:', typeof e);
  if (typeof e === 'string') console.log('value:', e);
  else if (typeof e === 'object') console.log('keys:', Object.keys(e).slice(0,10));
} catch(e) {
  console.log('error:', e.message);
}
