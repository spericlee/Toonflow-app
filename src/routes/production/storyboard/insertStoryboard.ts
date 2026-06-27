import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    prompt: z.string(),
    duration: z.number(),
    state: z.string(),
    videoDesc: z.string(),
    shouldGenerateImage: z.number(),
    src: z.string().nullable(),
    scriptId: z.number(),
    projectId: z.number(),
    targetId: z.number().optional(),
    targetIndex: z.number().optional(),
    reason: z.string().optional(),
    newTrack: z.boolean().optional(),
  }),
  async (req, res) => {
    const { prompt, duration, state, src, scriptId, projectId, videoDesc, shouldGenerateImage, targetId, targetIndex, reason, newTrack } = req.body;

    let insertIndex: number;
    let track: string;
    let trackId: number;

    if (targetId != null) {
      const targetStoryboard = await u.db("o_storyboard").where("id", targetId).where("scriptId", scriptId).first();
      if (!targetStoryboard) return res.status(400).send(error("目标分镜不存在"));

      insertIndex = targetStoryboard.index ?? 0;
      track = newTrack ? `track_${Date.now()}` : (targetStoryboard.track ?? `track_${Date.now()}`);
      trackId = newTrack ? Date.now() : (targetStoryboard.trackId ?? Date.now());

      await u.db("o_storyboard")
        .where("scriptId", scriptId)
        .where("projectId", projectId)
        .where("index", ">=", insertIndex)
        .increment("index", 1);
    } else if (targetIndex != null) {
      insertIndex = targetIndex;
      track = `track_${Date.now()}`;
      trackId = Date.now();

      await u.db("o_storyboard")
        .where("scriptId", scriptId)
        .where("projectId", projectId)
        .where("index", ">=", insertIndex)
        .increment("index", 1);
    } else {
      const lastStoryboard = await u.db("o_storyboard")
        .where("scriptId", scriptId)
        .where("projectId", projectId)
        .orderBy("index", "desc")
        .first();
      insertIndex = (lastStoryboard?.index ?? -1) + 1;
      track = `track_${Date.now()}`;
      trackId = Date.now();
    }

    const [id] = await u.db("o_storyboard").insert({
      prompt,
      duration: String(duration),
      state,
      filePath: u.replaceUrl(src),
      scriptId,
      projectId,
      track,
      trackId,
      videoDesc,
      shouldGenerateImage: src ? 1 : 0,
      index: insertIndex,
      createTime: Date.now(),
      ...(reason ? { reason } : {}),
    });

    if (targetId != null && !newTrack) {
      const trackRows = await u.db("o_storyboard")
        .where("track", track)
        .where("scriptId", scriptId)
        .select("duration");
      const trackDuration = trackRows.reduce((sum: number, row: any) => sum + Number(row.duration ?? 0), 0);
      await u.db("o_videoTrack").where("id", trackId).update({
        duration: trackDuration,
      });
    } else {
      await u.db("o_videoTrack").insert({
        id: trackId,
        scriptId,
        projectId,
        duration,
      });
    }

    return res.status(200).send(success({ id }));
  },
);