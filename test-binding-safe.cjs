// Try the exact binding names from browser_init
const bindingNames = [
  'electron_browser_app',
  'electron_common_command_line',
  'electron_browser_window',
  'electron_browser_web_contents',
  'electron_browser_dialog',
  'electron_common_native_image',
  'electron_browser_menu',
  'electron_browser_notification',
  'electron_browser_power_monitor',
  'electron_browser_power_save_blocker',
  'electron_browser_protocol',
  'electron_browser_session',
  'electron_browser_system_preferences',
  'electron_browser_tray',
  'electron_common_clipboard',
  'electron_common_screen',
  'electron_common_shell',
  'electron_main'
];

for (const name of bindingNames) {
  try {
    const v = process._linkedBinding(name);
    console.log(`${name}: OK, type=${typeof v}`);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      console.log(`  keys (${keys.length}): ${keys.slice(0, 8).join(', ')}`);
    }
  } catch(e) {
    // Skip - just note if it fails
    if (e.message && !e.message.includes('No such binding')) {
      console.log(`${name}: ERROR - ${e.message.slice(0, 60)}`);
    }
  }
}
