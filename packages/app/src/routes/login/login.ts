import express from "express";
import u from "@/utils";
import jwt from "jsonwebtoken";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/lib/middleware";
import { z } from "zod";
const router = express.Router();
import { md5 } from "js-md5";

export function setToken(payload: string | object, expiresIn: string | number, secret: string): string {
  if (!payload || typeof secret !== "string" || !secret) {
    throw new Error("参数不合法");
  }
  return (jwt.sign as any)(payload, secret, { expiresIn });
}

// 登录
export default router.post(
  "/",
  validateFields({
    username: z.string(),
    password: z.string(),
  }),
  async (req, res) => {
    const { username, password } = req.body;
    if (process.env.NODE_ENV !== "electron") {
      const tokenKey = u.db.setting.findByKey("tokenKey");
      return res
        .status(200)
        .send(success({ token: "Bearer " + setToken({ id: 1, username }, "180Days", tokenKey?.value as string), username }, "登录成功"));
    }

    const data = u.db.users.findByUsername(username);
    if (!data) return res.status(400).send(error("登录失败"));
    const tokenKey = u.db.setting.findByKey("tokenKey");

    if (data!.password == md5(password + tokenKey?.value) && data!.username == username) {
      const token = setToken(
        {
          id: data!.id,
          username: data!.username,
        },
        "180Days",
        tokenKey?.value as string,
      );

      return res.status(200).send(success({ token: "Bearer " + token, username: data!.username, id: data!.id }, "登录成功"));
    } else {
      return res.status(400).send(error("用户名或密码错误"));
    }
  },
);
