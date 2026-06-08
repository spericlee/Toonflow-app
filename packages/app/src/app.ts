import "./env";
import "./err";
import express, { Request, Response, NextFunction } from "express";
import { Server } from "socket.io";
import http from "node:http";
import logger from "morgan";
import cors from "cors";
import buildRoute from "@/core";
import fs from "fs";
import u from "@/utils";
import jwt from "jsonwebtoken";
import socketInit from "@/socket/index";

const app = express();
const server = http.createServer(app);

export default async function startServe() {
  const startTime = Date.now();

  const io = new Server(server, { cors: { origin: "*" } });
  socketInit(io);

  if (process.env.NODE_ENV == "dev") await buildRoute();

  app.use(logger("dev"));
  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // 源码部署开启静态页面
  if (process.env.NODE_ENV === "dev" || process.env.NODE_ENV === "prod") {
    const webDir = u.getPath("build", "web");
    app.use("/web", express.static(webDir, { acceptRanges: false }));
  } else {
    console.warn("当前环境为electron，未启用/web静态资源服务");
  }

  //静态资源
  const ossDir = u.getPath("data", "oss");
  if (!fs.existsSync(ossDir)) fs.mkdirSync(ossDir, { recursive: true });
  app.use("/oss", express.static(ossDir, { acceptRanges: false }));

  // 权限验证中间件
  app.use(async (req, res, next) => {
    if (process.env.NODE_ENV === "electron") return next();
    else {
      const tokenKey = u.db.setting.findByKey("tokenKey")?.value;
      if (!tokenKey) return res.status(444).send({ message: "服务器秘钥未配置，请联系管理员" });
      // 从 header 或 query 参数获取 token
      const rawToken = req.headers.authorization || (req.query.token as string) || "";
      const token = rawToken.replace("Bearer ", "");
      // 白名单路径
      if (req.path === "/api/login/login") return next();
      if (!token) return res.status(401).send({ message: "未提供token" });
      try {
        const decoded = jwt.verify(token, tokenKey as string);
        (req as any).user = decoded;
        next();
      } catch (err) {
        return res.status(401).send({ message: "无效的token" });
      }
    }
  });

  const router = await import("@/router");
  await router.default(app);

  // 404 处理
  app.use((_, res, next: NextFunction) => res.status(404).send({ message: "API 404 Not Found" }));

  // 错误处理
  app.use((err: any, _: Request, res: Response, __: NextFunction) => {
    res.locals.message = err.message;
    res.locals.error = err;
    console.error(err);
    res.status(err.status || 500).send(err);
  });

  const listenPort = Number(process.env.PORT ?? 10588);
  return await new Promise((resolve) => {
    server.listen(listenPort, async () => {
      const address = server.address();
      const realPort = typeof address === "string" ? address : address?.port;
      console.log(`[服务启动成功]: http://localhost:${realPort}`);
      console.log(`[启动耗时]: ${(Date.now() - startTime).toFixed(2)}ms`);
      resolve(realPort);
    });
  });
}

// 支持await关闭
export function closeServe(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close((err?: Error) => {
        if (err) return reject(err);
        console.log("[服务已关闭]");
        resolve();
      });
    } else {
      resolve();
    }
  });
}

if (process.env.NODE_ENV !== "electron") {
  startServe();
} else {
  startServe().then((port) => {
    process.send?.({ type: "ready", port });
  });
}
