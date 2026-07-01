import express from "express";
import u from "@/utils";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { ReferenceList } from "@/utils/ai";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    videoId: z.number(),
    model: z.string(),
    mode: z.string(),
    resolution: z.string(),
    audio: z.boolean().optional(),
  }),
  async (req, res) => {
    const { projectId, scriptId, videoId, model, mode, resolution, audio } = req.body;

    let modeData: any = [];
    if (Array.isArray(mode)) {
      modeData = mode;
    } else if (typeof mode === "string" && mode.startsWith("[") && mode.endsWith("]")) {
      try {
        modeData = JSON.parse(mode);
      } catch (e) {}
    }

    const ratio = await u.db("o_project").select("videoRatio").where("id", projectId).first();
    const oldVideo = await u.db("o_video").where("id", videoId).first();
    if (!oldVideo) {
      return res.status(404).send(success("视频记录不存在"));
    }

    const track = await u.db("o_videoTrack").where("id", oldVideo.videoTrackId).first();

    const videoPath = `/${projectId}/video/${uuidv4()}.mp4`;
    const [newVideoId] = await u.db("o_video").insert({
      filePath: videoPath,
      time: Date.now(),
      state: "生成中",
      scriptId,
      projectId,
      videoTrackId: oldVideo.videoTrackId,
    });

    res.status(200).send(success({ videoId: newVideoId, trackId: oldVideo.videoTrackId }));

    const storyboardList = await u
      .db("o_storyboard")
      .where({ scriptId, projectId, trackId: oldVideo.videoTrackId })
      .orderBy("index", "asc");

    const images: { path: string; sources: string }[] = [];
    for (const sb of storyboardList) {
      if (sb.filePath) {
        images.push({ path: sb.filePath, sources: "storyBoard" });
      }
      const assetLinks = await u
        .db("o_assets2Storyboard")
        .leftJoin("o_assets", "o_assets2Storyboard.assetId", "o_assets.id")
        .leftJoin("o_image", "o_image.id", "o_assets.imageId")
        .where("o_assets2Storyboard.storyboardId", sb.id)
        .select("o_image.filePath", "o_image.type");
      for (const al of assetLinks) {
        if (al.filePath) {
          images.push({ path: al.filePath, sources: al.type || "assets" });
        }
      }
    }

    const base64 = await Promise.all(
      images.map(async (item) => {
        if (!item) return null;
        return { base64: await u.oss.getImageBase64(item.path), type: item.sources == "audio" ? "audio" : "image" };
      }),
    );

    const relatedObjects = { projectId, videoId: newVideoId, scriptId, retryFrom: videoId, type: "视频" };

    const generateWithRetry = async (retryCount = 0): Promise<void> => {
      const aiVideo = u.Ai.Video(model);
      try {
        await aiVideo.run(
          {
            prompt: track?.prompt || "",
            referenceList: base64.filter(Boolean) as ReferenceList[],
            mode: modeData.length > 0 ? modeData : mode,
            duration: track?.duration || 5,
            aspectRatio: (ratio?.videoRatio as "16:9" | "9:16") || "16:9",
            resolution,
            audio,
          },
          {
            projectId,
            taskClass: "视频生成",
            describe: "根据提示词生成视频(重试)",
            relatedObjects: JSON.stringify(relatedObjects),
          },
        );
        await aiVideo.save(videoPath);
        await u.db("o_video").where("id", newVideoId).update({ state: "生成成功" });
      } catch (error: any) {
        const errMsg = u.error(error).message || "";
        if (errMsg.includes("timeout") && retryCount < 2) {
          await new Promise((r) => setTimeout(r, 10000 * (retryCount + 1)));
          return generateWithRetry(retryCount + 1);
        }
        await u.db("o_video").where("id", newVideoId).update({
          state: "生成失败",
          errorReason: errMsg,
        });
      }
    };
    generateWithRetry();
  },
);
