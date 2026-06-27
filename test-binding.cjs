try {
  // Check if we can use process._linkedBinding to get electron modules
  const bindingNames = process._linkedBinding('electron_common_bindings');
  console.log('common bindings:', typeof bindingNames);
  if (typeof bindingNames === 'object') {
    console.log('keys:', Object.keys(bindingNames).slice(0,20));
  }
} catch(e) {
  console.log('common bindings error:', e.message);
}

// Try to access specific electron bindings
for (const name of ['electron_browser_app', 'electron_app', 'app', 'electron_browser_main']) {
  try {
    const v = process._linkedBinding(name);
    console.log(`${name}:`, typeof v);
    if (typeof v === 'object') {
      console.log(`  keys:`, Object.keys(v).slice(0,5));
    }
  } catch(e) {
    console.log(`${name}: error - ${e.message.slice(0,50)}`);
  }
}
