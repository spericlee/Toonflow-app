import { app, BrowserWindow } from "electron";
import { fork, ChildProcess } from "child_process";
import path from "path";

const cpus = 10;
const baseUrl = "http://192.168.2.49:50188";

let mainWindow: BrowserWindow | null = null;
const workers: ChildProcess[] = [];

function startServe(): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const baseDir = app.isPackaged ? app.getAppPath() : path.resolve(process.cwd(), "../../");
    const serveEntry = path.join(baseDir, "build", "server", "app.cjs");
    const workerCount = Math.max(1, cpus - 1);
    const ports: number[] = [];
    for (let i = 0; i < workerCount; i++) {
      const worker = fork(serveEntry, [], {
        execPath: process.execPath,
        env: {
          ...process.env,
          NODE_ENV: "electron",
          WORKER_ID: String(i),
          PORT: "0",
          DATADIR: path.join(app.getPath("userData"), "data"),
          ELECTRON_RUN_AS_NODE: "1",
        },
        stdio: ["inherit", "inherit", "inherit", "ipc"],
      });
      worker.on("message", (msg: { type: string; port: number }) => {
        if (msg?.type === "ready") {
          ports.push(msg.port);
          // 所有 worker 都就绪后 resolve
          if (ports.length === workerCount) {
            resolve(ports);
          }
        }
      });
      worker.on("error", (err) => {
        console.error(`Worker ${i} error:`, err);
        reject(err);
      });
      workers.push(worker);
    }
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

  mainWindow.loadURL(baseUrl + "/#/loading");
  mainWindow.on("closed", () => (mainWindow = null));
}

app.whenReady().then(() => {
  createWindow();

  startServe()
    .then((port) => {
      console.log(`[主进程] 服务就绪，端口：${port}`);
    })
    .catch((err) => {
      console.error("[主进程] 服务启动失败：", err);
    });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  workers.forEach((worker) => worker.kill());
  if (process.platform !== "darwin") {
    app.quit();
  }
});
