import { app, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";

let baseUrl = "http://192.168.2.49:50188";

let mainWindow: BrowserWindow | null = null;
let port = 0;
let closeServeFn = undefined as (() => Promise<void>) | undefined;

function startServe(): Promise<void> {
  return new Promise(async (resolve) => {
    const baseDir = app.isPackaged ? app.getAppPath() : process.cwd();
    const serveEntry = path.join(baseDir, "build", "server", "app.cjs");
    if (!fs.existsSync(serveEntry)) {
      throw new Error(`后端入口不存在: ${serveEntry}`);
    }
    const mod = require(serveEntry);
    closeServeFn = mod.closeServe;
    port = await mod.default(true);
    resolve();
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegrationInWorker: true,
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
  startServe().then(() => {
    mainWindow?.webContents.send("serve-ready", { port });
  });

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
