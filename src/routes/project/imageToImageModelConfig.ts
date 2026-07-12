import express from "express";
const router = express.Router();

export default router.get("/", async (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>项目图生图模型配置</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
.container { max-width: 800px; margin: 0 auto; }
h1 { font-size: 20px; margin-bottom: 16px; color: #333; }
.project-card { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.project-name { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #333; }
.model-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.model-row label { min-width: 80px; font-size: 13px; color: #666; }
.model-row select { flex: 1; padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; background: #fff; cursor: pointer; }
.model-row select:focus { border-color: #4096ff; outline: none; }
.status-msg { font-size: 12px; color: #52c41a; margin-left: 8px; }
.btn-save { padding: 4px 16px; background: #1677ff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
.btn-save:hover { background: #4096ff; }
.loading { text-align: center; padding: 40px; color: #999; font-size: 14px; }
.error { color: #ff4d4f; font-size: 13px; margin-top: 8px; }
</style>
</head>
<body>
<div class="container">
  <h1>项目图生图模型配置</h1>
  <p style="font-size:13px;color:#888;margin-bottom:16px;">为每个项目单独指定图生图（分镜面板生成）使用的模型。若不设置，则默认使用项目的图像模型。</p>
  <div id="list" class="loading">加载中...</div>
</div>
<script>
const API = "/api/project";
async function load() {
  const listEl = document.getElementById("list");
  try {
    const [projRes, modelRes] = await Promise.all([
      fetch(API + "/getProject", { method: "POST" }).then(r => r.json()),
      fetch("/api/modelSelect/getModelList", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({type: "image"}) }).then(r => r.json()),
    ]);
    if (projRes.code !== 200) { listEl.innerHTML = '<div class="error">获取项目列表失败</div>'; return; }
    if (modelRes.code !== 200) { listEl.innerHTML = '<div class="error">获取模型列表失败</div>'; return; }
    const projects = projRes.data;
    const models = modelRes.data;
    if (!projects.length) { listEl.innerHTML = '<div class="error">暂无项目</div>'; return; }
    if (!models.length) { listEl.innerHTML = '<div class="error">暂无可用的图像模型，请先在设置中添加模型服务</div>'; return; }

    listEl.innerHTML = projects.map(p => {
      const currentImgModel = p.imageModel || "";
      const currentImg2img = p.imageToImageModel || "";
      return \`<div class="project-card" data-project-id="\${p.id}">
        <div class="project-name">\${p.name || "未命名项目"}</div>
        <div class="model-row">
          <label>文生图模型</label>
          <select disabled><option>\${getModelLabel(models, currentImgModel) || "未设置"}</option></select>
        </div>
        <div class="model-row">
          <label>图生图模型</label>
          <select class="select-i2i" data-project-id="\${p.id}">
            <option value="">默认（使用文生图模型）</option>
            \${models.filter(m => m.value !== currentImgModel.split(":")[1]).map(m => \`<option value="\${m.vendorId}:\${m.value}"\${currentImg2img === m.vendorId + ":" + m.value ? " selected" : ""}>\${m.label || m.value}\${(m.mode||[]).includes("singleImage") ? "（支持图生图）" : ""}</option>\`).join("")}
          </select>
          <button class="btn-save" data-project-id="\${p.id}">保存</button>
          <span class="status-msg" id="status-\${p.id}"></span>
        </div>
      </div>\`;
    }).join("");

    document.querySelectorAll(".btn-save").forEach(btn => {
      btn.addEventListener("click", async () => {
        const projectId = btn.dataset.projectId;
        const select = document.querySelector(\`.select-i2i[data-project-id="\${projectId}"]\`);
        const statusEl = document.getElementById("status-" + projectId);
        const imageToImageModel = select.value;
        btn.disabled = true;
        try {
          const res = await fetch(API + "/updateImageToImageModel", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ projectId: Number(projectId), imageToImageModel }),
          }).then(r => r.json());
          if (res.code === 200) {
            statusEl.textContent = "✓ 已保存";
            setTimeout(() => statusEl.textContent = "", 2000);
          } else {
            statusEl.textContent = "✗ 保存失败";
          }
        } catch(e) {
          statusEl.textContent = "✗ 保存失败";
        }
        btn.disabled = false;
      });
    });
  } catch(e) {
    listEl.innerHTML = \`<div class="error">加载失败：\${e.message}</div>\`;
  }
}
function getModelLabel(models, fullKey) {
  if (!fullKey) return "";
  const [vid, name] = fullKey.split(":");
  const m = models.find(mm => mm.value === name && mm.vendorId === vid);
  return m ? (m.label || m.value) : fullKey;
}
load();
</script>
</body>
</html>`);
});