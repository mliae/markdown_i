import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { OkResponse } from "./types";

/** 成功响应（对齐 Jxe 的 {code,message,data} 信封，前端统一取 .data） */
export function ok<T>(c: Context, data: T, message = "ok", status: ContentfulStatusCode = 200) {
  const body: OkResponse<T> = { code: 200, message, data };
  return c.json(body, status);
}

/** 失败响应 */
export function fail(c: Context, message: string, status: ContentfulStatusCode = 400) {
  return c.json({ code: status, message, data: null }, status);
}
