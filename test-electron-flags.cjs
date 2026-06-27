// Check what happens with different launch methods
console.log('ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);
console.log('ELECTRON_NO_ATTACH_CONSOLE:', process.env.ELECTRON_NO_ATTACH_CONSOLE);

// Check if electron has registered any built-in modules
const Module = require('module');
const builtinModules = Module.builtinModules || [];
console.log('builtinModules count:', builtinModules.length);
const electronBuiltins = builtinModules.filter(m => m.includes('electron') || m === 'app');
console.log('electron builtins:', electronBuiltins);

// Try internal module cache
try {
  const internalModuleReadJSON = process.binding('fs').internalModuleReadJSON;
  console.log('internalModuleReadJSON exists');
} catch(e) {}

// Check for any electron globals on process
for (const key of Object.keys(process)) {
  if (key.toLowerCase().includes('electron') || key.startsWith('_')) {
    console.log(`process.${key}:`, typeof process[key]);
  }
}
