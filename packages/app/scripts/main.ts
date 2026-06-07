import { app, BrowserWindow } from "electron";
import { fork, ChildProcess } from "child_process";
import os from "os";
import http from "http";
import httpProxy from "http-proxy";
import path from "path";

const cpus = process.env.NODE_ENV === "dev" ? 1 : os.cpus().length;

const baseUrl = "http://192.168.2.49:50188";

let mainWindow: BrowserWindow | null = null;
const workers: ChildProcess[] = [];
const workerPorts: number[] = [];

// 负载均衡代理监听到的端口（随机可用端口）
let proxyPort = 0;

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

/**
 * 启动 http-proxy 负载均衡器：
 * - 监听一个随机可用端口，将请求分发到各 worker。
 * - 普通 HTTP 请求使用轮询（round-robin）。
 * - socket.io（含 WebSocket upgrade）使用基于客户端的粘性会话，
 *   保证同一连接的 polling / upgrade 始终命中同一个 worker。
 */
function startProxy(ports: number[]): Promise<number> {
  return new Promise((resolve, reject) => {
    workerPorts.splice(0, workerPorts.length, ...ports);

    const proxy = httpProxy.createProxyServer({ ws: true, xfwd: true });
    proxy.on("error", (err, _req, res) => {
      console.error("[代理错误]", err?.message ?? err);
      const socketLike = res as any;
      if (socketLike && typeof socketLike.writeHead === "function" && !socketLike.headersSent) {
        socketLike.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        socketLike.end("Bad Gateway");
      } else if (socketLike && typeof socketLike.destroy === "function") {
        socketLike.destroy();
      }
    });

    // 轮询计数器
    let rrIndex = 0;
    const nextPort = (): number => workerPorts[rrIndex++ % workerPorts.length];

    // socket.io 粘性映射：客户端标识 -> worker 端口
    const stickyMap = new Map<string, number>();
    const stickyPort = (key: string): number => {
      let port = stickyMap.get(key);
      if (port === undefined || !workerPorts.includes(port)) {
        port = nextPort();
        stickyMap.set(key, port);
      }
      return port;
    };

    const isSocketIO = (url?: string): boolean => !!url && url.startsWith("/socket.io/");
    const clientKey = (req: http.IncomingMessage): string =>
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";

    const server = http.createServer((req, res) => {
      const port = isSocketIO(req.url) ? stickyPort(clientKey(req)) : nextPort();
      proxy.web(req, res, { target: `http://127.0.0.1:${port}` });
    });

    // WebSocket 升级请求（socket.io 的 transport=websocket）始终走粘性
    server.on("upgrade", (req, socket, head) => {
      const port = stickyPort(clientKey(req));
      proxy.ws(req, socket, head, { target: `http://127.0.0.1:${port}` });
    });

    server.on("error", reject);
    server.listen(0, "0.0.0.0", () => {
      const address = server.address();
      proxyPort = typeof address === "object" && address ? address.port : 0;
      console.log(`[代理] 负载均衡已启动 http://0.0.0.0:${proxyPort} -> [${workerPorts.join(", ")}]`);
      resolve(proxyPort);
    });
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: "../../assets/logo.ico",
    webPreferences: {
      contextIsolation: false,
      backgroundThrottling: false,
      experimentalFeatures: true,
      webgl: true,
      scrollBounce: true,
      webviewTag: true,
      v8CacheOptions: "bypassHeatCheckAndEagerCompile",
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
  mainWindow.on("closed", () => (mainWindow = null));
}

// GPU 加速
app.commandLine.appendSwitch("--enable-gpu-rasterization");
app.commandLine.appendSwitch("--enable-zero-copy");
app.commandLine.appendSwitch("--ignore-gpu-blocklist");
app.commandLine.appendSwitch("--enable-oop-rasterization");
// 禁用不需要的功能，减少启动开销
app.commandLine.appendSwitch("--disable-spell-checking");
app.commandLine.appendSwitch("--disable-background-networking");

app.whenReady().then(() => {
  createWindow();
  mainWindow?.webContents.executeJavaScript(`localStorage.setItem('electron', "1");`);
  mainWindow?.loadURL(`${baseUrl}/#/loading`);

  startServe()
    .then((ports) => startProxy(ports))
    .then((port) => {
      console.log(`[主进程] 服务就绪，负载均衡端口：${port}`);
      const inject = () => {
        mainWindow?.webContents.executeJavaScript(
          `localStorage.setItem('server-port', '${port}'); window.dispatchEvent(new CustomEvent('server-ready', { detail: { port: '${port}' } }));`
        );
      };

      if (mainWindow?.webContents.isLoading()) {
        mainWindow.webContents.once("did-finish-load", inject);
      } else {
        inject();
      }
    });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  mainWindow?.webContents.executeJavaScript(`localStorage.removeItem('electron');`);
  workers.forEach((worker) => worker.kill());
  if (process.platform !== "darwin") {
    app.quit();
  }
});
