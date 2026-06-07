import path from "path";

const baseDir = path.resolve(path.dirname(__dirname), "../../");

const env = {
  NODE_ENV: "dev",
  DATADIR: path.join(baseDir, "data"),
  BUILDDIR: path.join(baseDir, "build"),
};

Object.entries(env).forEach(([k, v]) => {
  if (!process.env[k]) process.env[k] = v;
  console.log(`[环境变量：${k} = ${process.env[k]}] 已设置`);
});