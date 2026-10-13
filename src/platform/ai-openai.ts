/**
 * AI 绑定的 OpenAI 兼容实现（DeepSeek / 通义千问 / vLLM 等）
 * 业务侧 ai.ts 只调用 ai.run(model, { messages, max_tokens, temperature })，
 * 并已兼容 OpenAI chat.completion 返回结构，故这里直接转发 /chat/completions。
 * 未配置 AI_BASE_URL/AI_API_KEY 时不创建实例，业务按 !env.AI 自动禁用功能。
 */
import type { AiBinding } from "../ai";

export interface OpenAiAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class OpenAiAi implements AiBinding {
  constructor(private readonly cfg: OpenAiAiConfig) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(_model: string, inputs: any): Promise<any> {
    const res = await fetch(this.cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + this.cfg.apiKey,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        messages: inputs.messages ?? [],
        max_tokens: inputs.max_tokens ?? 512,
        temperature: inputs.temperature ?? 0.7,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI provider ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }
}
