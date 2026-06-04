import path from "path";
import fs from "fs";

const rootDir = process.cwd();
const tempDir = path.resolve(rootDir, "data", "temp");
fs.rmSync(tempDir, { recursive: true, force: true });

fs.rmSync(path.resolve(rootDir, "electron-builder.yml"));
