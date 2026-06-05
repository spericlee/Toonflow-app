import fs from "fs";
import path from "path";
import YAML from "yaml";
import * as dp from "@pnpm/dependency-path";
import { build as electronBuild, createTargets, Platform, Arch } from "electron-builder";
import type { Configuration } from "app-builder-lib";
import { compile, rootDir, lockFile, externalDeps } from "./dist";

const builderYmlFile = path.resolve(rootDir, "electron-builder.yml");

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

function collectExternalTree(seeds: readonly string[]) {
  const lock = YAML.parse(fs.readFileSync(lockFile, "utf8")) as Lockfile;
  const importer = lock.importers?.["."] ?? {};
  const rootDeps = { ...importer.dependencies, ...importer.devDependencies };
  const snapshots = lock.snapshots ?? {};

  const names = new Set<string>();
  const visited = new Set<string>();

  const visit = (depPath: string) => {
    if (visited.has(depPath)) return;
    visited.add(depPath);

    const { name } = dp.parse(depPath);
    if (name) names.add(name);

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

  const result = [...names].sort();
  console.log(`📦 共收集 ${result.length} 个 external 依赖`);
  return result;
}

function resolveElectronVersion() {
  const electronPkg = path.resolve(rootDir, "packages/app/node_modules/electron/package.json");
  const { version } = JSON.parse(fs.readFileSync(electronPkg, "utf8")) as { version: string };
  return version;
}

function createBuilderConfig(externals: string[]): Configuration {
  return {
    appId: "net.toonflow.solo",
    productName: "ToonFlow",
    copyright: "Copyright © 2026",
    electronVersion: resolveElectronVersion(),
    asar: false,
    directories: { output: "pack" },
    files: [
      "build/**/*",
      "!pack/**/*",
      "scripts/web/**/*",
      "env/**/*",
      "package.json",
      "!node_modules/**/*",
      ...externals.map((name) => `node_modules/${name}/**/*`),
    ],
    asarUnpack: externals.map((name) => `**/node_modules/${name}/**`),
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

  console.log("\n📝 生成 electron-builder.yml...");
  const externals = collectExternalTree(externalDeps);
  const content = `# AUTO-GENERATED by scripts/pack.ts. DO NOT EDIT.\n${YAML.stringify(createBuilderConfig(externals))}`;
  fs.writeFileSync(builderYmlFile, content, "utf8");

  await runElectronBuilder(platforms, archs);

  console.log("\n🧹 清理临时文件...");
  fs.rmSync(path.resolve(rootDir, "data/temp"), { recursive: true, force: true });
  fs.rmSync(builderYmlFile, { force: true });
}

pack().catch((error) => {
  console.error("❌ 打包失败:", error);
  process.exit(1);
});
