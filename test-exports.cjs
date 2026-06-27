// Try various subpath imports
const paths = [
  'electron/main',
  'electron/sandbox',
  'electron/renderer',
  'electron/common',
  'electron/browser',
  'electron/preload',
];
for (const p of paths) {
  try {
    const m = require(p);
    console.log(`${p}:`, typeof m, typeof m === 'object' ? Object.keys(m).slice(0,5) : String(m).slice(0,60));
  } catch(e) {
    console.log(`${p}: FAIL - ${e.message.slice(0,60)}`);
  }
}
