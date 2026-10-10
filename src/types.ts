/** 全局绑定与通用响应类型 */

import type { AiBinding } from "./ai";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  /** Cloudflare Workers AI（评论 @AI 回复） */
  AI: AiBinding;
  /** 站主解锁密码（本地 .dev.vars / 线上 wrangler secret） */
  ADMIN_PASSWORD: string;
  SITE_NAME: string;
}

export type HonoEnv = { Bindings: Env };

export interface OkResponse<T> {
  code: 200;
  message: string;
  data: T;
}

export interface FailResponse {
  code: number;
  message: string;
  data: null;
}
