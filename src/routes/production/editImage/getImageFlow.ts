import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
    projectId: z.number().optional(),
  }),
  async (req, res) => {
    const { id, projectId: reqProjectId } = req.body;
    const imageFlowData = await u.db("o_imageFlow").where("id", id).first();
    let parseFlow: any = null;
    if (imageFlowData?.flowData) {
      parseFlow = JSON.parse(imageFlowData.flowData);
      let imageToImageModel = "";
      let imageModel = "";
      let projectId = reqProjectId;
      if (!projectId) {
        const storyboard = await u.db("o_storyboard").where("flowId", id).select("projectId").first();
        if (storyboard?.projectId) projectId = storyboard.projectId;
      }
      if (projectId) {
        const project = await u.db("o_project").where("id", projectId).select("imageToImageModel", "imageModel").first();
        imageToImageModel = project?.imageToImageModel || "";
        imageModel = project?.imageModel || "";
      }
      await Promise.all(
        parseFlow.nodes.map(async (node: any) => {
          if (node.type === "upload") {
            node.data.image = node.data.image ? await u.oss.getSmallImageUrl(node.data.image) : "";
          } else if (node.type === "generated") {
            node.data.generatedImage = node.data.generatedImage ? await u.oss.getSmallImageUrl(node.data.generatedImage) : "";
            node.data.references = await Promise.all(node.data.references.map(async (item: { image: string }) => {
              return {
                image: await u.oss.getSmallImageUrl(item.image)
              }
            }));
          }
          if (imageToImageModel && (!node.data.model || node.data.model === imageModel)) {
            node.data.model = imageToImageModel;
          } else if (!node.data.model) {
            node.data.model = imageModel;
          }
        }),
      );
    }

    return res.status(200).send(success(parseFlow ? { ...parseFlow, id: imageFlowData?.id } : null));
  },
);
