const natives = process.binding('natives');
const src = natives['electron/js2c/browser_init'];

// Find the export/require patterns for 'electron'
const lines = src.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('electron/app') || line.includes('"electron"') || line.includes("'electron'")) {
    console.log(`line ${i}: ${line.slice(0, 200)}`);
  }
}
