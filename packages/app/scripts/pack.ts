import fs from "fs";
import path from "path";
import YAML from "yaml";
import * as dp from "@pnpm/dependency-path";
import { rebuild } from "@electron/rebuild";
import { build as electronBuild, createTargets, Platform, Arch } from "electron-builder";
import type { Configuration } from "app-builder-lib";
import { compile, rootDir, lockFile, nativeRuntimeDeps, rebuildModules } from "./dist";

const builderYmlFile = path.resolve(rootDir, "electron-builder.yml");
// 隔离的原生模块重建目录：不污染共享的 pnpm store（否则会破坏依赖系统 Node 的 pnpm dev）。
const stagingDir = path.resolve(rootDir, ".native-staging");

type NodeModuleFile = { from: string; to: string; filter: string[] };
type BuildTarget = { platform: NodeJS.Platform; arch: string };
type DepEntry = { name: string; depPath: string };

const platformFlags = {
  "--win": Platform.WINDOWS,
  "--mac": Platform.MAC,
  "--linux": Platform.LINUX,
} as const;

const archFlags = {
  "--x64": Arch.x64,
  "--arm64": Arch.arm64,
  "--ia32": Arch.ia32,
  "--universal": Arch.universal,
} as const;

type Snapshot = {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type ImporterDeps = Record<string, { version: string }>;

type Lockfile = {
  importers?: Record<string, { dependencies?: ImporterDeps; devDependencies?: ImporterDeps }>;
  snapshots?: Record<string, Snapshot>;
};

function parseArgs(argv: string[]) {
  const args = new Set(argv.slice(2));
  const platforms = Object.entries(platformFlags)
    .filter(([flag]) => args.has(flag))
    .map(([, platform]) => platform);
  const archs = Object.entries(archFlags)
    .filter(([flag]) => args.has(flag))
    .map(([, arch]) => arch);
  return { platforms, archs };
}

// Platform.name 为 windows/mac/linux，映射为 Node 的 process.platform 取值。
const platformNameToNode: Record<string, NodeJS.Platform> = {
  windows: "win32",
  mac: "darwin",
  linux: "linux",
};

const archToNode: Partial<Record<Arch, string>> = {
  [Arch.x64]: "x64",
  [Arch.arm64]: "arm64",
  [Arch.ia32]: "ia32",
};

// 解析本次打包的目标平台/架构组合（与 electron-builder 默认行为对齐：未指定时用当前平台/架构）。
function resolveTargets(platforms: Platform[], archs: Arch[]): BuildTarget[] {
  const selectedPlatforms = platforms.length > 0 ? platforms : [Platform.current()];
  const selectedArchs = archs.length > 0 ? archs.map((a) => archToNode[a] ?? process.arch) : [process.arch];

  const targets: BuildTarget[] = [];
  for (const platform of selectedPlatforms) {
    const nodePlatform = platformNameToNode[platform.name] ?? process.platform;
    for (const arch of selectedArchs) targets.push({ platform: nodePlatform, arch });
  }
  return targets;
}

// 判断 package.json 的 os/cpu 约束是否匹配某个目标值（支持 "!win32" 这类否定写法）。
function constraintMatches(values: string[] | undefined, target: string): boolean {
  if (!values || values.length === 0) return true;
  const negations = values.filter((v) => v.startsWith("!"));
  if (negations.length > 0) return !negations.some((v) => v.slice(1) === target);
  return values.includes(target);
}

// 仅保留与某个目标平台+架构都匹配的包；无 os/cpu 限制的通用包一律保留。
function matchesAnyTarget(pkgOs: string[] | undefined, pkgCpu: string[] | undefined, targets: BuildTarget[]): boolean {
  if ((!pkgOs || pkgOs.length === 0) && (!pkgCpu || pkgCpu.length === 0)) return true;
  return targets.some((t) => constraintMatches(pkgOs, t.platform) && constraintMatches(pkgCpu, t.arch));
}

function readPkgPlatform(absModuleDir: string): { os?: string[]; cpu?: string[] } {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(absModuleDir, "package.json"), "utf8")) as {
      os?: string[];
      cpu?: string[];
    };
    return { os: pkg.os, cpu: pkg.cpu };
  } catch {
    return {};
  }
}

function collectExternalTree(seeds: readonly string[]) {
  const lock = YAML.parse(fs.readFileSync(lockFile, "utf8")) as Lockfile;
  const importers = lock.importers ?? {};
  // 合并所有 workspace importer 的依赖：原生依赖声明在 packages/app，而非根 importer。
  const rootDeps: ImporterDeps = {};
  for (const importer of Object.values(importers)) {
    Object.assign(rootDeps, importer.dependencies, importer.devDependencies);
  }
  const snapshots = lock.snapshots ?? {};

  // name -> depPath（首个出现的版本），depPath 用于定位 .pnpm 虚拟存储中的真实目录。
  const collected = new Map<string, string>();
  const visited = new Set<string>();

  const visit = (depPath: string) => {
    if (visited.has(depPath)) return;
    visited.add(depPath);

    const { name } = dp.parse(depPath);
    if (name && !collected.has(name)) collected.set(name, depPath);

    const snapshot = snapshots[depPath];
    if (!snapshot) return;

    for (const [depName, ref] of Object.entries({ ...snapshot.dependencies, ...snapshot.optionalDependencies })) {
      const relativePath = dp.refToRelative(ref, depName);
      if (relativePath) visit(relativePath);
    }
  };

  for (const seed of seeds) {
    const ref = rootDeps[seed]?.version;
    const relativePath = ref ? dp.refToRelative(ref, seed) : null;

    if (relativePath) {
      visit(relativePath);
      continue;
    }

    for (const depPath of Object.keys(snapshots)) {
      if (dp.parse(depPath).name === seed) visit(depPath);
    }
  }

  const entries = [...collected.entries()]
    .map(([name, depPath]) => ({ name, depPath }))
    .sort((a, b) => a.name.localeCompare(b.name));
  console.log(`📦 共收集 ${entries.length} 个 external 依赖`);
  return entries;
}

// 将收集到的依赖映射为 electron-builder 的 from/to 文件项：
// 从 pnpm 虚拟存储（node_modules/.pnpm/<encoded>/node_modules/<name>）的真实目录，
// 平铺拷贝到应用内的 node_modules/<name>，使运行时 require 可正常解析。
// - overrides：已重建的原生模块改从 staging 目录取件（ABI 匹配 Electron）。
// - targets：仅保留与目标平台/架构匹配的平台包（如 @img/sharp-*）。
function buildNodeModuleFiles(
  entries: DepEntry[],
  targets: BuildTarget[],
  overrides: Map<string, string>,
): NodeModuleFile[] {
  const files: NodeModuleFile[] = [];
  let skippedByPlatform = 0;
  for (const { name, depPath } of entries) {
    const dirName = dp.depPathToFilename(depPath, 120);
    const storePath = `node_modules/.pnpm/${dirName}/node_modules/${name}`;
    const absStore = path.resolve(rootDir, storePath);
    if (!fs.existsSync(absStore)) {
      // 其他平台/架构的可选包在本机未安装，跳过。
      continue;
    }

    const { os, cpu } = readPkgPlatform(absStore);
    if (!matchesAnyTarget(os, cpu, targets)) {
      skippedByPlatform++;
      continue;
    }

    const override = overrides.get(name);
    const from = override ? path.relative(rootDir, override).split(path.sep).join("/") : storePath;
    files.push({ from, to: `node_modules/${name}`, filter: ["**/*"] });
  }
  console.log(`📦 映射 ${files.length} 个 node_modules 依赖（按目标平台过滤掉 ${skippedByPlatform} 个）`);
  return files;
}

// 针对 Electron 的 ABI 重建原生模块。在隔离的 staging 目录中进行，
// 避免污染共享 pnpm store（store 的产物被 pnpm dev 以系统 Node 加载）。
// 返回 name -> staging 中重建后模块的绝对路径。
// 注：@electron/rebuild 无法跨平台编译，仅能为宝机平台构建。
async function rebuildNativeModules(entries: DepEntry[], targets: BuildTarget[]): Promise<Map<string, string>> {
  const overrides = new Map<string, string>();

  const hostArchs = [...new Set(targets.filter((t) => t.platform === process.platform).map((t) => t.arch))];
  if (hostArchs.length === 0) {
    console.warn(`⚠️ 目标平台与宝机平台(${process.platform})不一致，跳过原生模块源码重建（无法跨平台编译）。`);
    return overrides;
  }
  if (hostArchs.length > 1) {
    console.warn(`⚠️ 检测到多个目标架构 ${hostArchs.join(", ")}，单个 node_modules 无法同时容纳，仅重建：${hostArchs[0]}。`);
  }
  const arch = hostArchs[0];

  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stagingDir, "node_modules"), { recursive: true });
  // 必须在 dependencies 中声明待重建模块：@electron/rebuild 的 module-walker
  // 仅重建 package.json 依赖中列出的模块（即使指定了 onlyModules）。
  fs.writeFileSync(
    path.join(stagingDir, "package.json"),
    JSON.stringify({
      name: "native-staging",
      version: "0.0.0",
      private: true,
      dependencies: Object.fromEntries(rebuildModules.map((m) => [m, "*"])),
    }),
  );

  for (const mod of rebuildModules) {
    const entry = entries.find((e) => e.name === mod);
    if (!entry) continue;
    const dirName = dp.depPathToFilename(entry.depPath, 120);
    const src = path.resolve(rootDir, `node_modules/.pnpm/${dirName}/node_modules/${mod}`);
    if (!fs.existsSync(src)) {
      console.warn(`⚠️ 待重建模块未安装，跳过: ${mod}`);
      continue;
    }
    const dest = path.join(stagingDir, "node_modules", mod);
    fs.cpSync(src, dest, { recursive: true });
    overrides.set(mod, dest);
  }

  if (overrides.size === 0) return overrides;

  console.log(`\n🔧 针对 Electron 重建原生模块（arch=${arch}）: ${[...overrides.keys()].join(", ")}`);
  await rebuild({
    buildPath: stagingDir,
    projectRootPath: stagingDir,
    electronVersion: resolveElectronVersion(),
    arch,
    onlyModules: [...rebuildModules],
    force: true,
  });
  console.log("✅ 原生模块重建完成");
  return overrides;
}

function resolveElectronVersion() {
  const electronPkg = path.resolve(rootDir, "packages/app/node_modules/electron/package.json");
  const { version } = JSON.parse(fs.readFileSync(electronPkg, "utf8")) as { version: string };
  return version;
}

function createBuilderConfig(nodeModuleFiles: NodeModuleFile[]): Configuration {
  return {
    appId: "net.toonflow.solo",
    productName: "ToonFlow",
    copyright: "Copyright © 2026",
    electronVersion: resolveElectronVersion(),
    asar: false,
    // 原生模块已由本脚本针对 Electron ABI 重建并从 staging 取件，禁用 electron-builder 重复重建。
    npmRebuild: false,
    directories: { output: "pack" },
    files: [
      "build/**/*",
      "!pack/**/*",
      "scripts/web/**/*",
      "env/**/*",
      "package.json",
      "!node_modules/**/*",
      ...nodeModuleFiles,
    ],
    extraResources: [{ from: "data", to: "data", filter: ["**/*", "!db2.sqlite", "!logs/**", "!oss/**"] }],
    win: {
      target: ["nsis"],
      icon: "./scripts/logo.ico",
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      perMachine: true,
      artifactName: "${productName}-${version}-win-${arch}-setup.${ext}",
      unicode: true,
      deleteAppDataOnUninstall: false,
    },
    mac: {
      target: ["dmg"],
      icon: "./scripts/logo.icns",
      category: "public.app-category.developer-tools",
      artifactName: "${productName}-${version}-mac-${arch}.${ext}",
    },
    linux: {
      target: ["AppImage"],
      icon: "./scripts/logo.png",
      category: "Development",
      artifactName: "${productName}-${version}-linux-${arch}.${ext}",
    },
  };
}

async function runElectronBuilder(platforms: Platform[], archs: Arch[]) {
  let targets: ReturnType<typeof createTargets> | undefined;

  if (archs.length > 0) {
    targets = new Map();
    const selectedPlatforms = platforms.length > 0 ? platforms : [Platform.current()];
    for (const platform of selectedPlatforms) {
      for (const [targetName, archMap] of platform.createTarget(null, ...archs)) {
        targets.set(targetName, archMap);
      }
    }
  } else if (platforms.length > 0) {
    targets = createTargets(platforms);
  }

  const platformLabel = platforms.length > 0 ? platforms.map((p) => p.name).join(", ") : "当前平台";
  const archLabel = archs.length > 0 ? `，架构：${archs.map((a) => Arch[a]).join(", ")}` : "";
  console.log(`\n📦 开始打包（${platformLabel}${archLabel}）...\n`);

  await electronBuild({ targets });
  console.log("\n✅ 打包完成");
}

async function pack() {
  const { platforms, archs } = parseArgs(process.argv);

  // 打包前先编译，确保 build/ 下产物为最新。
  await compile();

  const targets = resolveTargets(platforms, archs);
  console.log(`\n🎯 目标：${targets.map((t) => `${t.platform}-${t.arch}`).join(", ")}`);

  console.log("\n📝 生成 electron-builder.yml...");
  const externals = collectExternalTree(nativeRuntimeDeps);
  const overrides = await rebuildNativeModules(externals, targets);
  const nodeModuleFiles = buildNodeModuleFiles(externals, targets, overrides);
  const content = `# AUTO-GENERATED by scripts/pack.ts. DO NOT EDIT.\n${YAML.stringify(createBuilderConfig(nodeModuleFiles))}`;
  fs.writeFileSync(builderYmlFile, content, "utf8");

  await runElectronBuilder(platforms, archs);

  console.log("\n🧹 清理临时文件...");
  fs.rmSync(path.resolve(rootDir, "data/temp"), { recursive: true, force: true });
  fs.rmSync(builderYmlFile, { force: true });
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

pack().catch((error) => {
  console.error("❌ 打包失败:", error);
  process.exit(1);
});
