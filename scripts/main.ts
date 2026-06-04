import { app, BrowserWindow, globalShortcut } from "electron";
import fs from "fs";
import path from "path";

let baseUrl = "http://localhost:50188";

let mainWindow: BrowserWindow | null = null;

function copyFiles() {
  
}

function startServe(): Promise<void> {
  return new Promise((resolve) => {
    const serveDir = path.join(app.getPath("userData"), "data", "serve", "app.jsc");
    console.log("%c Line:14 🍣 serveDir", "background:#2eafb0", serveDir);
    if (!fs.existsSync(serveDir)) copyFiles();
    const mod = require(serveDir);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      const wc = mainWindow?.webContents;
      if (wc?.isDevToolsOpened()) {
        wc.closeDevTools();
      } else {
        wc?.openDevTools({ mode: "detach" });
      }
      event.preventDefault();
    }
  });

  const url = baseUrl + "/#/loading";

  mainWindow.loadURL(url);

  mainWindow.on("closed", () => (mainWindow = null));
}

app.whenReady().then(() => {
  createWindow();
  startServe().then(() => {});

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
