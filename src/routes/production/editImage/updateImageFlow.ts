import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    edges: z.any(),
    nodes: z.any(),
    flowId: z.number(),
  }),
  async (req, res) => {
    const { edges, nodes, flowId } = req.body;
    let imageToImageModel = "";
    let imageModel = "";
    let projectId = null;
    const storyboard = await u.db("o_storyboard").where("flowId", flowId).select("projectId").first();
    if (storyboard?.projectId) {
      projectId = storyboard.projectId;
    } else {
      const nodeIds = nodes.map((n: any) => n.id).filter(Boolean);
      if (nodeIds.length > 0) {
        const sb = await u.db("o_storyboard").whereIn("id", nodeIds).select("projectId").first();
        if (sb?.projectId) projectId = sb.projectId;
      }
    }
    if (projectId) {
      const project = await u.db("o_project").where("id", projectId).select("imageToImageModel", "imageModel").first();
      imageToImageModel = project?.imageToImageModel || "";
      imageModel = project?.imageModel || "";
    }
    nodes.forEach((node: any) => {
      if (node.type == "upload") {
        node.data.image = node.data.image ? u.replaceUrl(node.data.image) : "";
      }

      if (node.type == "generated") {
        node.data.generatedImage = node.data.generatedImage ? u.replaceUrl(node.data.generatedImage) : "";
        node.data.references.forEach((item: { image: string }) => {
          item.image = item.image ? u.replaceUrl(item.image) : "";
        });
      }
      if (imageToImageModel && (!node.data.model || node.data.model === imageModel)) {
        node.data.model = imageToImageModel;
      } else if (!node.data.model) {
        node.data.model = imageModel;
      }
    });

    await u
      .db("o_imageFlow")
      .where("id", flowId)
      .update({
        flowData: JSON.stringify({ edges, nodes }),
      });
    return res.status(200).send(success());
  },
);
