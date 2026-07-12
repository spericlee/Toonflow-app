import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    imageToImageModel: z.string(),
  }),
  async (req, res) => {
    const { projectId, imageToImageModel } = req.body;
    await u.db("o_project").where("id", projectId).update({ imageToImageModel });
    res.status(200).send(success({ message: "更新图生图模型成功" }));
  },
);