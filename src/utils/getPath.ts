import path from "path";
import isPathInside from "is-path-inside";

export default (fileName?: string[] | string) => {
  const basePath =
    process.env.NODE_ENV === "electron" ? path.join(require("electron").app.getPath("userData"), "data") : path.join(process.cwd(), "data");

  if (!fileName) return basePath;

  const dbPath = path.resolve(basePath, ...(Array.isArray(fileName) ? fileName : [fileName]));

  if (!isPathInside(dbPath, basePath) && dbPath !== basePath) {
    throw new Error("路径逃逸错误，路径必须在数据目录内");
  }

  return dbPath;
};
