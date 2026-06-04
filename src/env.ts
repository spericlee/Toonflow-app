// 全局声明环境变量类型
declare global {
  type AppEnv = "dev" | "prod" | "electron" | "docker";
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: AppEnv;
    }
  }
}

// 判断是否为 Electron 环境
const isElectron = typeof process.versions?.electron !== "undefined";
let isPackaged = false;
if (isElectron) {
  const { app } = require("electron");
  isPackaged = app.isPackaged;
}

// 判断是否为 Docker 环境
function isDockerEnv(): boolean {
  try {
    const fs = require("fs");
    if (fs.existsSync("/.dockerenv")) return true;
    const cgroup = fs.readFileSync("/proc/1/cgroup", "utf8");
    return cgroup.includes("docker") || cgroup.includes("containerd");
  } catch {
    return false;
  }
}

// 加载环境变量
function resolveAppEnv(): AppEnv {
  const currentEnv = process.env.NODE_ENV;
  if (currentEnv && (["local", "electron", "docker", "prod"] as AppEnv[]).includes(currentEnv)) {
    return currentEnv;
  }
  if (isElectron) return "electron";
  if (isDockerEnv()) return "docker";
  return "dev";
}
const key = 'NODE_ENV';
if (!process.env[key]) process.env[key] = resolveAppEnv();
console.log(`[环境变量：${process.env[key]}] 已设置`);

export {};
