const natives = process.binding('natives');
const nodeInit = natives['electron/js2c/node_init'];
console.log('node_init length:', nodeInit.length);

// Look for how it handles 'electron' require
if (nodeInit) {
  // Find where it handles module resolution
  const lines = nodeInit.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('electron') || lines[i].includes('_load') || lines[i].includes('_resolveFilename')) {
      console.log(`line ${i}: ${lines[i].slice(0, 150)}`);
    }
  }
}
