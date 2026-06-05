import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import * as dp from "@pnpm/dependency-path";
import { build as electronBuild, createTargets, Platform, Arch } from "electron-builder";
import type { Configuration } from "app-builder-lib";
import { generateNotices } from "./license";

process.env.NODE_ENV = "electron";

const rootDir = process.cwd();
const appFile = path.resolve(rootDir, "build/server/app.cjs");
const mainFile = path.resolve(rootDir, "build/electron/main.cjs");
const builderYmlFile = path.resolve(rootDir, "electron-builder.yml");
const lockFile = path.resolve(rootDir, "pnpm-lock.yaml");
const packageFile = path.resolve(rootDir, "package.json");

const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8")) as { version: string };

const externalDeps = ["electron", "sharp"] as const;

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

const baseConfig: esbuild.BuildOptions = {
  bundle: true,
  minify: false,
  format: "cjs",
  platform: "node",
  target: "esnext",
  tsconfig: "./tsconfig.json",
  alias: { "@": "./src" },
  external: [...externalDeps],
  sourcemap: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  },
};

function parseArgs(argv: string[]) {
  const args = new Set(argv.slice(2));
  const platforms = Object.entries(platformFlags)
    .filter(([flag]) => args.has(flag))
    .map(([, platform]) => platform);
  const archs = Object.entries(archFlags)
    .filter(([flag]) => args.has(flag))
    .map(([, arch]) => arch);
  const pack = process.env.PACK === "1" || args.has("--pack") || platforms.length > 0 || archs.length > 0;
  return { pack, platforms, archs };
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

function createBuilderConfig(externals: string[]): Configuration {
  return {
    appId: "net.toonflow.solo",
    productName: "ToonFlow",
    copyright: "Copyright © 2026",
    asar: false,
    directories: { output: "dist" },
    files: [
      "build/**/*",
      "scripts/web/**/*",
      "env/**/*",
      "package.json",
      "!node_modules/**/*",
      ...externals.map((name) => `node_modules/${name}/**/*`),
    ],
    asarUnpack: externals.map((name) => `**/node_modules/${name}/**`),
    extraResources: [{ from: "Data", to: "Data", filter: ["**/*", "!db2.sqlite", "!logs/**", "!oss/**"] }],
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

async function packApp(platforms: Platform[], archs: Arch[]) {
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

async function buildApp() {
  const { pack, platforms, archs } = parseArgs(process.argv);

  fs.mkdirSync(path.dirname(appFile), { recursive: true });
  fs.mkdirSync(path.dirname(mainFile), { recursive: true });

  console.log("🔨 开始构建...\n");
  await Promise.all([
    esbuild.build({ ...baseConfig, entryPoints: ["src/app.ts"], outfile: appFile }),
    esbuild.build({ ...baseConfig, entryPoints: ["scripts/main.ts"], outfile: mainFile }),
  ]);
  console.log("✅ 构建完成");

  console.log("\n📝 生成 electron-builder.yml...");
  const externals = collectExternalTree(externalDeps);
  const content = `# AUTO-GENERATED by scripts/build.ts. DO NOT EDIT.\n${YAML.stringify(createBuilderConfig(externals))}`;
  fs.writeFileSync(builderYmlFile, content, "utf8");

  if (!pack) return;

  await packApp(platforms, archs);

  console.log("\n🧹 清理临时文件...");
  fs.rmSync(path.resolve(rootDir, "Data/temp"), { recursive: true, force: true });
  fs.rmSync(builderYmlFile, { force: true });

  console.log("\n📄 生成依赖声明 NOTICES.txt...");
  await generateNotices();
}

buildApp().catch((error) => {
  console.error("❌ 构建失败:", error);
  process.exit(1);
});
