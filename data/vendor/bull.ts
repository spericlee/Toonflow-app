/**
 * Toonflow AI供应商模板
 * @version 2.0
 */

// ============================================================
// 类型定义
// ============================================================

type VideoMode =
  | "singleImage" //单图参考
  | "startEndRequired" //首尾帧（两张都得有）
  | "endFrameOptional" //首尾帧（尾帧可选）
  | "startFrameOptional" //首尾帧（首帧可选）
  | "text" //文本
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[]; //多参考（数字代表限制数量）

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string; //唯一ID，作为文件名存储用户磁盘上，禁止符号
  version: string; //版本号，格式为x.y，需遵守语义化版本控制
  name: string; //供应商名称
  author: string; //作者
  description?: string; //描述，支持Markdown格式
  icon?: string; //图标，仅支持Base64格式，建议尺寸为128x128像素
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

// ============================================================
// 全局声明
// ============================================================

declare const axios: any; // HTTP请求库
declare const logger: (msg: string) => void; // 日志函数
declare const jsonwebtoken: any; // JWT处理库
declare const zipImage: (base64: string, size: number) => Promise<string>; // 图片压缩函数，返回有头base64字符串
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>; // 图片分辨率调整函数，返回有头base64字符串
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>; // 图片合成函数，返回有头base64字符串
declare const urlToBase64: (url: string) => Promise<string>; // URL转Base64函数，返回有头base64字符串
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>; // 轮询函数，fn为异步函数，interval为轮询间隔，timeout为超时时间，返回fn的结果
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const createZhipu: any;
declare const createQwen: any;
declare const createAnthropic: any;
declare const createOpenAICompatible: any;
declare const createXai: any;
declare const createMinimax: any;
declare const createGoogleGenerativeAI: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel) => any; //文本模型
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>; //图片模型，返回有头base64字符串
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>; //视频模型，返回有头base64字符串
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>; //（暂未开放）语音模型，返回有头base64字符串
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>; //检查更新函数，返回是否有更新和最新版本号和更公告（支持Markdown格式）
  updateVendor?: () => Promise<string>; //更新函数，返回最新的代码文本
};

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "bull",
  version: "2.0",
  author: "Toonflow",
  name: "local",
  description: "## OpenAI标准格式接口，可修改请求地址并手动添加模型。",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true },
    { key: "baseUrl", label: "请求地址", type: "url", required: true, placeholder: "示例：https://api.openai.com/v1" },
  ],
  inputValues: { apiKey: "", baseUrl: "https://api.openai.com/v1" },
  models: [{ name: "GPT-4o", modelName: "gpt-4o", type: "text", think: false }],
};

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  return createOpenAI({ baseURL: vendor.inputValues.baseUrl, apiKey }).chat(model.modelName);
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const baseUrl = vendor.inputValues.baseUrl.replace(/\/+$/, "");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");

  const [w, h] = config.aspectRatio.split(":").map(Number);
  const sizeTable: Record<string, Record<string, string>> = {
    "1K": {
      "1:1": "1024x1024",
      "4:3": "1152x864",
      "3:4": "864x1152",
      "16:9": "1280x720",
      "9:16": "720x1280",
      "3:2": "1248x832",
      "2:3": "832x1248",
      "21:9": "1512x648",
    },
    "2K": {
      "1:1": "2048x2048",
      "4:3": "2304x1728",
      "3:4": "1728x2304",
      "16:9": "2848x1600",
      "9:16": "1600x2848",
      "3:2": "2496x1664",
      "2:3": "1664x2496",
    },
    "4K": {
      "1:1": "4096x4096",
      "4:3": "4608x3456",
      "3:4": "3456x4608",
      "16:9": "5696x3200",
      "9:16": "3200x5696",
      "3:2": "4992x3328",
      "2:3": "3328x4992",
    },
  };
  const size = sizeTable[config.size]?.[config.aspectRatio] || "1024x1024";

  const hasReferences = config.referenceList && config.referenceList.length > 0;

  if (hasReferences) {
    const images = config.referenceList.map((ref) => ref.base64);

    logger(`[bull] 开始图生图: model=${model.modelName}, prompt=${config.prompt}, referenceCount=${images.length}`);

    const body: Record<string, any> = {
      model: model.modelName,
      prompt: config.prompt,
      image: images.length === 1 ? images[0] : images,
      n: 1,
      size,
      response_format: "b64_json",
    };

    const resp = await axios.post(`${baseUrl}/images/edits`, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = resp.data;
    if (data.data && data.data[0]) {
      const result = data.data[0];
      if (result.b64_json) return `data:image/png;base64,${result.b64_json}`;
      if (result.url) return await urlToBase64(result.url);
    }
    throw new Error("图片生成失败：未返回有效结果");
  }

  logger(`[bull] 开始文生图: model=${model.modelName}, size=${size}, prompt=${config.prompt}`);
  const body: Record<string, any> = {
    model: model.modelName,
    prompt: config.prompt,
    n: 1,
    size,
    response_format: "b64_json",
  };

  const resp = await axios.post(`${baseUrl}/images/generations`, body, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = resp.data;
  if (!data || !data.data || !data.data[0]) {
    throw new Error("图片生成失败：未返回有效结果");
  }

  const result = data.data[0];
  if (result.b64_json) {
    return `data:image/png;base64,${result.b64_json}`;
  }
  if (result.url) {
    return await urlToBase64(result.url);
  }
  throw new Error("图片生成失败：返回结果中无图片数据");
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const baseUrl = vendor.inputValues.baseUrl.replace(/\/+$/, "");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");

  const imageRefs = (config.referenceList ?? []).filter((r) => r.type === "image").map((r) => r.base64);
  const videoRefs = (config.referenceList ?? []).filter((r) => r.type === "video").map((r) => r.base64);
  const audioRefs = (config.referenceList ?? []).filter((r) => r.type === "audio").map((r) => r.base64);

  const activeMode = config.mode as string | string[];

  let image: string | undefined;
  if (Array.isArray(activeMode)) {
    image = imageRefs[0];
  } else if (activeMode === "singleImage") {
    image = imageRefs[0];
  } else if (activeMode === "startEndRequired" || activeMode === "endFrameOptional" || activeMode === "startFrameOptional") {
    image = imageRefs[0];
  }

  const body: Record<string, any> = {
    model: model.modelName,
    prompt: config.prompt,
    n: 1,
    response_format: "b64_json",
  };

  if (image) body.image = image;
  if (config.duration) body.duration = config.duration;

  logger(`[bull] 开始视频生成: model=${model.modelName}`);
  const resp = await axios.post(`${baseUrl}/video/generations`, body, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 600000,
  });

  const data = resp.data;
  if (!data) throw new Error("视频生成失败：未返回有效结果");

  if (data.data && data.data[0]) {
    const result = data.data[0];
    if (result.b64_json) return `data:video/mp4;base64,${result.b64_json}`;
    if (result.url) return await urlToBase64(result.url);
    if (result.video) return await urlToBase64(result.video);
  }

  if (data.video) return await urlToBase64(data.video);
  if (data.url) return await urlToBase64(data.url);
  if (data.output) return await urlToBase64(data.output);

  if (data.id) {
    const taskId = data.id;
    logger(`[bull] 视频任务已提交: ${taskId}`);
    const pollResult = await pollTask(async () => {
      const queryResp = await axios.get(`${baseUrl}/video/generations/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const queryData = queryResp.data;
      const status = queryData.status ?? queryData.state ?? "";
      if (status === "completed" || status === "SUCCESS" || status === "success" || status === "succeeded") {
        const output = queryData.output ?? queryData.data ?? queryData.result ?? "";
        return { completed: true, data: typeof output === "string" ? output : output?.video ?? output?.url ?? output?.b64_json ?? "" };
      }
      if (status === "FAILURE" || status === "failed" || status === "FAILED") {
        return { completed: true, error: queryData.error ?? "视频生成失败" };
      }
      return { completed: false };
    }, 5000, 600000);
    if (pollResult.error) throw new Error(pollResult.error);
    if (!pollResult.data) throw new Error("视频生成失败：结果为空");
    return await urlToBase64(pollResult.data);
  }

  throw new Error("视频生成失败：无法识别的响应格式");
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  return "";
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.0", notice: "## 新版本更新公告" };
};

const updateVendor = async (): Promise<string> => {
  return "";
};

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

// 这行代码用于确保当前文件被识别为模块，避免全局变量冲突
export {};

/**
 * ============================================================
 * AI 代码生成指南
 * ============================================================
 *
 * 【概述】
 * 本文件是 Toonflow AI 供应商适配模板。AI 在生成新供应商适配代码时，
 * 必须严格遵守以下规则，并要求用户提供目标平台的 curl 调用示例或 API 文档信息作为输入依据。
 *
 * 【前置要求】
 * 在生成代码前，请向用户索要以下信息（至少其一）：
 *   1. 目标 API 的 curl 请求示例（包含请求地址、Headers、Body 结构、响应结构）
 *   2. 目标 API 的官方文档链接或文档截图/文本内容
 *   3. 需要适配的模型类型（text / image / video / tts）及其能力说明
 * 没有足够信息时，应主动追问，不要凭空编造 API 结构。
 *
 * 【代码规则】
 *
 * 1. 禁止引入任何外部包
 *    不可使用 import / require，仅能使用本文件「全局声明」区域中已声明的方法和对象，
 *    包括：axios、logger、jsonwebtoken、zipImage、zipImageResolution、mergeImages、
 *    urlToBase64、pollTask，以及 createOpenAI、createDeepSeek、createZhipu、createQwen、
 *    createAnthropic、createOpenAICompatible、createXai、createMinimax、
 *    createGoogleGenerativeAI 等 AI SDK 工厂函数。
 *
 * 2. 禁止在 exports.* 函数外部声明离散的全大写常量
 *    错误示例：const API_URL = "https://..."; const MAX_RETRY = 3;
 *    如果确实需要可配置的常量值，必须将其声明在 vendor.inputValues 中，
 *    通过 vendor.inputValues.xxx 访问，让用户可在界面上配置。
 *    如果是纯逻辑内部使用的临时变量，应内联在对应的 exports.* 函数体内部，使用小驼峰命名。
 *
 * 3. 逻辑尽量聚合在 exports.* 对应的函数内部
 *    每个适配函数（textRequest / imageRequest / videoRequest / ttsRequest）
 *    应自包含，将请求构造、发送、轮询、结果解析等逻辑写在函数体内，避免拆分出大量外部辅助函数。
 *    如果多个函数确实存在公共逻辑（如签名计算、Token 生成、请求头构造），
 *    可提取为文件内的小驼峰命名函数，放在「适配器函数」区块之前的「辅助工具」区块中，
 *    且不可使用全大写命名。
 *
 * 4. 命名规范
 *    所有变量、函数一律使用小驼峰命名（camelCase），禁止使用 UPPER_SNAKE_CASE。
 *
 * 5. 不需要重新声明类型
 *    本文件顶部已完整定义了所有接口和类型（VendorConfig、ImageConfig、VideoConfig、
 *    TTSConfig、TextModel、ImageModel、VideoModel、TTSModel、ReferenceList、PollResult 等），
 *    AI 生成代码时直接使用即可，不要重复声明。
 *
 * 6. 返回值规范
 *    - textRequest(model)：返回 AI SDK 的 chat model 实例（通过 createOpenAI 等工厂函数创建）。
 *    - imageRequest(config, model)：返回有头 base64 字符串（如 "data:image/png;base64,..."）。
 *      config.referenceList 为 Extract<ReferenceList, { type: "image" }>[] 类型，
 *      每个引用条目均为 base64 形式（sourceType 固定为 "base64"）。
 *    - videoRequest(config, model)：返回有头 base64 字符串（如 "data:video/mp4;base64,..."）。
 *      config.referenceList 为 ReferenceList[] 类型，可包含 image / video / audio 三种引用，
 *      每个引用条目均为 base64 形式（sourceType 固定为 "base64"）。
 *      config.mode 为当前激活的视频模式数组，需根据 mode 决定如何使用 referenceList。
 *    - ttsRequest(config, model)：返回有头 base64 字符串（如 "data:audio/mp3;base64,..."）。
 *      config.referenceList 为 Extract<ReferenceList, { type: "audio" }>[] 类型（音频参考）。
 *    当 API 返回的是 URL 而非二进制数据时，使用 urlToBase64(url) 转换。
 *
 * 7. ReferenceList 与 VideoMode 说明
 *    ReferenceList 是统一的多媒体引用类型，每个条目包含：
 *      - type: "image" | "audio" | "video"（媒体类型）
 *      - sourceType: "base64"（当前模板固定为 base64）
 *      - base64（对应的数据）
 *
 *    VideoMode 定义了视频模型支持的输入模式：
 *      - "text"：纯文本生成视频
 *      - "singleImage"：单张首帧图片
 *      - "startEndRequired"：首尾帧（两张都必须提供）
 *      - "endFrameOptional"：首尾帧（尾帧可选）
 *      - "startFrameOptional"：首尾帧（首帧可选）
 *      - 数组形式如 ["imageReference:9", "videoReference:3", "audioReference:3"]：
 *        多模态参考模式，数字表示该类型的最大数量限制。
 *
 *    在 videoRequest 中，config.mode 表示当前选择的模式，需根据其值决定：
 *      - 如何从 config.referenceList 中提取对应类型的引用
 *      - 如何构造 API 请求体中的图片/视频/音频参数
 *
 * 8. 异步任务处理
 *    对于视频生成等需要轮询的异步任务，使用全局的 pollTask 函数：
 *    const result = await pollTask(async () => {
 *      const resp = await axios.get(...);
 *      if (resp.data.status === "SUCCESS") return { completed: true, data: resp.data.url };
 *      if (resp.data.status === "FAILED") return { completed: true, error: resp.data.message };
 *      return { completed: false };
 *    }, 5000, 600000); // 每5秒轮询，10分钟超时
 *    if (result.error) throw new Error(result.error);
 *    return await urlToBase64(result.data!);
 *
 * 9. 错误处理
 *    在每个函数开头校验必需参数（如 API Key），缺失时使用 throw new Error("...") 抛出。
 *    API 请求失败时，从响应中提取有意义的错误信息抛出，不要吞掉异常。
 *
 * 10. 日志输出
 *     在关键步骤使用 logger("...") 输出日志（如"开始提交任务"、"任务ID: xxx"、"轮询中..."），
 *     便于调试。
 *
 * 11. vendor 配置填写
 *     - id：纯英文小写，作为文件名使用，禁止特殊符号和空格。
 *     - version：语义化版本格式 "x.y"。
 *     - inputs：根据目标 API 所需的认证信息配置（API Key、Secret、请求地址等）。
 *     - models：根据目标平台支持的模型列表填写，注意正确设置 type 和各模型特有字段。
 *       - VideoModel 的 mode 对应 API 支持的输入模式（参见规则 7 的 VideoMode 说明）。
 *       - VideoModel 的 audio 字段：true（始终生成音频）、false（不生成）、"optional"（用户可选）。
 *       - VideoModel 的 durationResolutionMap 对应各时长下可选的分辨率。
 *       - VideoModel 的 associationSkills 可选，用于描述模型的特殊能力。
 *       - ImageModel 的 mode 对应 API 支持的生图模式（"text" 纯文本、"singleImage" 单图参考、"multiReference" 多图参考）。
 *       - TTSModel 的 voices 对应可选的音色列表。
 *
 * 12. 图片处理
 *     - 需要压缩图片体积时使用 zipImage(base64, maxSizeKB)。
 *     - 需要调整图片分辨率时使用 zipImageResolution(base64, width, height)。
 *     - 需要将多张图片拼合为一张时使用 mergeImages(base64Arr, maxSize)。
 *     - 以上函数均接收和返回有头 base64 字符串。
 *
 * 13. 文件结构
 *     生成的代码必须保持本模板的整体结构：
 *     类型定义区 → 全局声明区 → 供应商配置区 → [辅助工具区（可选）] → 适配器函数区 → 导出区
 *     不要打乱顺序，不要删除已有的结构注释分隔线。
 *     辅助工具区用于放置多个适配器函数共享的小驼峰命名辅助函数（如 getHeaders、getBaseUrl）。
 *
 * 14. 导出规范
 *     必须导出以下字段（通过 exports.xxx = xxx 赋值）：
 *       - exports.vendor（必须）
 *       - exports.textRequest（必须）
 *       - exports.imageRequest（必须）
 *       - exports.videoRequest（必须）
 *       - exports.ttsRequest（必须）
 *       - exports.checkForUpdates（可选）
 *       - exports.updateVendor（可选）
 *     未实现的适配器函数保留空实现（return ""），不可省略导出。
 *     文件末尾必须包含 export {}; 以确保文件被识别为模块。
 *
 * 【生成流程】
 * 当用户请求生成新的供应商适配时：
 *   1. 确认用户已提供 curl 示例或 API 文档。
 *   2. 分析 API 的认证方式、端点地址、请求/响应结构。
 *   3. 基于本模板结构，填充 vendor 配置和对应的适配器函数。
 *   4. 根据当前模板的 ReferenceList 定义，按 base64 形式构造和消费 referenceList。
 *   5. 仅实现用户需要的模型类型，未用到的函数保留空实现（return ""）。
 *   6. 生成完整可用的代码，确保无语法错误、无遗漏导出。
 */
