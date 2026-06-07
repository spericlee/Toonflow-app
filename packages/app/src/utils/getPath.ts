import path from "path";
import isPathInside from "is-path-inside";

export default (type: "data" | "build", ...paths: string[]) => {
  let basePath: string;
  if (type === "data") basePath = process.env.DATADIR;
  else if (type === "build") basePath = process.env.BUILDDIR;
  else throw new Error("未知路径类型");
  if (!basePath) throw new Error(`环境变量 ${type === "data" ? "DATADIR" : "BUILDDIR"} 未设置`);
  const fileName = paths.length > 0 ? path.join(...paths) : "";
  if (!fileName) return basePath;
  const dbPath = path.resolve(basePath, ...(Array.isArray(fileName) ? fileName : [fileName]));
  if (!isPathInside(dbPath, basePath) && dbPath !== basePath) throw new Error("路径逃逸错误，路径必须在数据目录内");
  return dbPath;
};
