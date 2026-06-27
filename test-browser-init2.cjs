const natives = process.binding('natives');
const src = natives['electron/js2c/browser_init'];
const lines = src.split('\n');

// Find the export module that handles 'electron'
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Look for module definition of electron exports
  if (line.includes('electron.ts') || line.includes('electron_app') || line.includes('electron_browser')) {
    console.log(`line ${i}: ${line.slice(0, 300)}`);
  }
}
