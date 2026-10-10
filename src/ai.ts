/**
 * Cloudflare Workers AI 文本生成封装（评论 @AI 回复用）
 * 绑定：wrangler.jsonc 中 ai.binding = "AI"
 * 模型均为 Cloudflare 自托管的免费 @cf/* 模型，消耗每日免费 neurons 额度。
 */

/** Workers AI 绑定最小类型 */
export interface AiBinding {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run(model: string, inputs: any): Promise<any>;
}

/**
 * 默认文本模型：中文友好的 Cloudflare 托管免费模型。
 * 旧的 @cf/meta/llama-3-8b-instruct 已下架，勿再使用。
 */
export const TEXT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
/** 备用模型：主模型上游偶发错误时重试一次 */
export const TEXT_MODEL_FALLBACK = "@cf/meta/llama-3.2-3b-instruct";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TextGenOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** 推理模型（Qwen3）显式关闭思考，避免思考过程占满短回复的 token 预算 */
  thinking?: boolean;
}

/** 文本对话生成，返回模型输出纯文本 */
export async function generateText(
  ai: AiBinding,
  messages: ChatMessage[],
  opts: TextGenOptions = {}
): Promise<string> {
  const inputs: Record<string, unknown> = {
    messages,
    max_tokens: opts.maxTokens ?? 512,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.thinking === false) {
    inputs.chat_template_kwargs = { enable_thinking: false };
  }
  const result = await ai.run(opts.model ?? TEXT_MODEL, inputs);
  return stripThinking(extractText(result)).trim();
}

/** 兼容多种 Workers AI 文本返回结构：
 *  {response} / {result:{response}} / OpenAI chat.completion / Qwen3 reasoning_content 兜底 */
function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;

  if (typeof r.response === "string" && r.response.trim()) return r.response;
  if (r.result && typeof r.result === "object") {
    const inner = r.result as Record<string, unknown>;
    if (typeof inner.response === "string" && inner.response.trim()) return inner.response;
  }
  const choices = r.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  if (message) {
    for (const key of ["content", "reasoning_content", "reasoning"]) {
      const v = message[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  if (typeof r.result === "string") return r.result;
  return "";
}

/** 剥离推理模型可能输出的 thinking 块 */
function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/^<think(?:ing)?>[\s\S]*$/i, "")
    .trim();
}
