// Check for global electron API
console.log('process.type:', process.type);
console.log('process._linkedBinding:', typeof process._linkedBinding);

// Check if there's a global electron object
console.log('global electron:', typeof global.electron);
console.log('global.Electron:', typeof global.Electron);

// Check for electron-specific global symbols
for (const key of Object.getOwnPropertyNames(global).sort()) {
  if (key.toLowerCase().includes('electron') || key === 'app') {
    console.log(`global.${key}:`, typeof global[key]);
  }
}

// Check process.features
try { console.log('process.features.electron:', process.features.electron); } catch(e) {}

// Check process.versions
console.log('process.versions.electron:', process.versions.electron);
console.log('process.versions.chrome:', process.versions.chrome);

// Check native module access
try {
  const bindings = process.binding('natives');
  const electronKeys = Object.keys(bindings).filter(k => k.startsWith('electron/'));
  console.log('electron native keys:', electronKeys);
} catch(e) {
  console.log('natives error:', e.message);
}

// Check if we can get app via another built-in
for (const name of ['electron_app', 'app', 'electron_browser', 'browser']) {
  try {
    console.log(`${name}:`, typeof require(name));
  } catch(e) {
    console.log(`${name}: ${e.message.slice(0,50)}`);
  }
}
