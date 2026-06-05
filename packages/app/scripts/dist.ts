import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

process.env.NODE_ENV = "electron";

// 脚本位于 packages/app/scripts/，向上三级即仓库根目录；
// 切换 cwd 到根目录，确保无论从哪里运行，构建产物都落在根目录。
export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
process.chdir(rootDir);

export const appFile = path.resolve(rootDir, "build/server/app.cjs");
export const mainFile = path.resolve(rootDir, "build/electron/main.cjs");
export const lockFile = path.resolve(rootDir, "pnpm-lock.yaml");
export const packageFile = path.resolve(rootDir, "package.json");

export const externalDeps = ["electron", "sharp"] as const;

const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8")) as { version: string };

const baseConfig: esbuild.BuildOptions = {
  bundle: true,
  minify: false,
  format: "cjs",
  platform: "node",
  target: "esnext",
  tsconfig: path.resolve(rootDir, "packages/app/tsconfig.json"),
  alias: { "@": path.resolve(rootDir, "packages/app/src") },
  external: [...externalDeps],
  sourcemap: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  },
};

// 仅负责编译：将服务端与 Electron 主进程打包到根目录 build/ 下。
export async function compile() {
  fs.mkdirSync(path.dirname(appFile), { recursive: true });
  fs.mkdirSync(path.dirname(mainFile), { recursive: true });

  console.log("🔨 开始编译...\n");
  await Promise.all([
    esbuild.build({ ...baseConfig, entryPoints: [path.resolve(rootDir, "packages/app/src/app.ts")], outfile: appFile }),
    esbuild.build({ ...baseConfig, entryPoints: [path.resolve(rootDir, "packages/app/scripts/main.ts")], outfile: mainFile }),
  ]);
  console.log("✅ 编译完成");
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  compile().catch((error) => {
    console.error("❌ 编译失败:", error);
    process.exit(1);
  });
}
