/**
 * /media/* —— R2 / B2 私有桶对象的流式输出。
 * 支持 HTTP Range（MP4 拖拽必需）、不可变长缓存、扩展名兜底 MIME。
 * b2/ 前缀对象（Backblaze B2 私有桶）通过 SigV4 签名拉取代理。
 */
import type { Context } from "hono";
import { fail } from "./respond";
import type { HonoEnv } from "./types";
import { isB2Key, getB2Object } from "./storage";
import { getSettings } from "./settings";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  lrc: "text/plain; charset=utf-8",
};

function extMime(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/** 从 URL 路径解析受保护的对象 key（拒绝越权路径） */
function resolveKey(pathname: string): string | null {
  if (!pathname.startsWith("/media/")) return null;
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice("/media/".length));
  } catch {
    return null;
  }
  if (!key || key.startsWith("/") || key.includes("..") || key.includes("\\")) return null;
  // B2 私有桶代理：b2/ 前缀下只允许上传/头像目录
  if (isB2Key(key)) {
    const sub = key.slice("b2/".length);
    if (sub.startsWith("uploads/") || sub.startsWith("avatars/")) return key;
    return null;
  }
  // R2：只允许访问上传/表情/音乐/头像目录
  if (!key.startsWith("uploads/") && !key.startsWith("emoji/") && !key.startsWith("music/") && !key.startsWith("avatars/")) return null;
  return key;
}

const IMMUTABLE = "public, max-age=31536000, immutable";

/** 站点 Logo 在 R2 中的固定对象 key；换 Logo 只需覆盖该对象（无需改代码） */
export const SITE_LOGO_KEY = "site/logo.png";

/**
 * /logo.png —— 站点 Logo 固定短链输出（favicon/品牌头像/友链头像等外部引用用）。
 * Logo 可能更换，不用 immutable：浏览器 1h + 边缘 1 天，ETag 兜底协商缓存。
 */
export async function serveSiteLogo(c: Context<HonoEnv>): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(c.req.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const obj = await c.env.R2.get(SITE_LOGO_KEY);
  if (!obj) return fail(c, "资源不存在", 404);
  const headers = baseHeaders(obj, SITE_LOGO_KEY);
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  headers.set("Content-Length", String(obj.size));
  const res = new Response(obj.body, { status: 200, headers });
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

export async function serveMedia(c: Context<HonoEnv>): Promise<Response> {
  const key = resolveKey(new URL(c.req.url).pathname);
  if (!key) return fail(c, "资源不存在", 404);

  const rangeHeader = c.req.header("range") ?? c.req.header("Range");
  const m = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null;

  // B2 私有桶对象：SigV4 签名代理拉取（Range 原样透传，S3 支持）
  if (isB2Key(key)) return serveB2Media(c, key, rangeHeader ?? undefined);

  // 后缀范围 bytes=-N
  if (m && m[1] === "" && m[2] !== "") {
    const suffix = Number(m[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return new Response("Invalid Range", { status: 416, headers: { "Content-Range": "bytes */0" } });
    }
    const obj = await c.env.R2.get(key, { range: { suffix } });
    if (!obj) return fail(c, "资源不存在", 404);
    return rangeResponse(obj, key);
  }

  // 普通范围 bytes=start-end / bytes=start-
  if (m && m[1] !== "") {
    const start = Number(m[1]);
    const end = m[2] !== "" ? Number(m[2]) : undefined;
    if (!Number.isFinite(start) || start < 0 || (end !== undefined && (end < start || !Number.isFinite(end)))) {
      return new Response("Invalid Range", { status: 416, headers: { "Content-Range": "bytes */0" } });
    }
    const obj = await c.env.R2.get(
      key,
      end !== undefined ? { range: { offset: start, length: end - start + 1 } } : { range: { offset: start } }
    );
    if (!obj) return fail(c, "资源不存在", 404);
    return rangeResponse(obj, key);
  }

  // 无 Range：整对象 —— 先查 Cloudflare 边缘缓存（命中不调用 Worker，节省请求额度）
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(c.req.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const obj = await c.env.R2.get(key);
  if (!obj) return fail(c, "资源不存在", 404);
  const headers = baseHeaders(obj, key);
  headers.set("Content-Length", String(obj.size));
  const res = new Response(obj.body, { status: 200, headers });
  // R2 响应体只能读一次，clone 后异步写入边缘缓存
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

function baseHeaders(obj: R2ObjectBody | R2Object, key: string): Headers {
  const headers = new Headers();
  const ct = obj.httpMetadata?.contentType;
  headers.set("Content-Type", ct && ct !== "application/octet-stream" ? ct : extMime(key));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", IMMUTABLE);
  headers.set("ETag", obj.httpEtag);
  if (obj.httpMetadata?.contentEncoding) headers.set("Content-Encoding", obj.httpMetadata.contentEncoding);
  return headers;
}

/** 206 响应（R2 范围读取后 obj.range 描述实际区间） */
function rangeResponse(obj: R2ObjectBody, key: string): Response {
  const size = obj.size;
  let start = 0;
  let end = size - 1;
  const r = obj.range as { suffix: number } | { offset?: number; length?: number } | undefined;
  if (r) {
    if ("suffix" in r) {
      start = Math.max(0, size - r.suffix);
      end = size - 1;
    } else {
      start = r.offset ?? 0;
      end = typeof r.length === "number" ? start + r.length - 1 : size - 1;
    }
  }
  end = Math.min(end, size - 1);
  const headers = baseHeaders(obj, key);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(obj.body, { status: 206, headers });
}

/** B2 私有桶对象代理：SigV4 GET 拉流，无 Range 请求写边缘缓存减少 B2 访问 */
async function serveB2Media(c: Context<HonoEnv>, key: string, range?: string): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(c.req.url, { method: "GET" });

  if (!range) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const s = await getSettings(c.env.DB);
  if (!(s.b2_endpoint && s.b2_bucket && s.b2_key_id && s.b2_app_key)) {
    return fail(c, "B2 存储未配置，无法访问该资源", 502);
  }

  let resp: Response | null;
  try {
    resp = await getB2Object(s, key, range);
  } catch (e) {
    return fail(c, "B2 读取失败：" + (e instanceof Error ? e.message : String(e)), 502);
  }
  if (!resp) return fail(c, "资源不存在", 404);

  const headers = new Headers();
  const ct = resp.headers.get("content-type");
  headers.set("Content-Type", ct && ct !== "application/xml" && ct !== "application/octet-stream" ? ct : extMime(key));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", IMMUTABLE);
  const len = resp.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  const cr = resp.headers.get("content-range");
  if (cr) headers.set("Content-Range", cr);
  const etag = resp.headers.get("etag");
  if (etag) headers.set("ETag", etag);

  const res = new Response(resp.body, { status: resp.status, headers });
  // 整对象响应写入边缘缓存（206 不缓存）
  if (resp.status === 200 && !range) {
    c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
  }
  return res;
}
