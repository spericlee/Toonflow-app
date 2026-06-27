import electron from 'electron';
console.log('default export type:', typeof electron);
console.log('default export:', typeof electron === 'string' ? electron.slice(0,80) : Object.keys(electron));

import { app, BrowserWindow, dialog, screen, shell, ipcMain, Menu, Notification, Tray, clipboard, nativeImage, protocol, session, systemPreferences, powerMonitor, powerSaveBlocker, globalShortcut, net, contextBridge, desktopCapturer } from 'electron';
console.log('named export - app:', typeof app);
console.log('named export - BrowserWindow:', typeof BrowserWindow);
console.log('named export - ipcMain:', typeof ipcMain);
console.log('named export - dialog:', typeof dialog);
console.log('named export - screen:', typeof screen);
console.log('named export - shell:', typeof shell);
console.log('named export - Menu:', typeof Menu);
console.log('named export - Notification:', typeof Notification);
console.log('named export - Tray:', typeof Tray);
