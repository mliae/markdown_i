/**
 * 存储抽象：Cloudflare R2 与 Backblaze B2（S3 兼容 API）双后端。
 * - storage_mode=r2：上传写入 R2（默认；历史文件继续留在 R2）
 * - storage_mode=b2：新上传写入 B2，对象 key 统一加 b2/ 前缀，
 *   便于 keyToSrc 路由到 B2 公开域名、mediaKeyFrom 提取 key、删除时区分后端。
 */
import type { SiteSettings } from "./settings";

const B2_PREFIX = "b2/";

/** 判断 key 是否位于 B2（b2/ 前缀） */
export function isB2Key(key: string): boolean {
  return key.startsWith(B2_PREFIX);
}

/** 从 B2 S3 端点解析 region：https://s3.<region>.backblazeb2.com → <region> */
export function b2Region(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname.toLowerCase();
    const m = /^s3\.([^.]+)\.backblazeb2\.com$/.exec(host);
    if (m) return m[1];
  } catch { /* 忽略非法 URL */ }
  return "us-west-004";
}

const encoder = new TextEncoder();

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const keyData = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

async function hmacHex(key: ArrayBuffer | string, data: string): Promise<string> {
  const buf = await hmac(key, data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** 存储写入支持的数据体（R2 与 S3 均可流式传输的类型） */
type StorageBody = string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream | null;

/**
 * 发送带 AWS SigV4 签名的 S3 兼容请求（path-style：/<bucket>/<key>）。
 * PUT 使用 UNSIGNED-PAYLOAD 流式上传（不整读文件，兼容大视频）；
 * GET/DELETE/HEAD 使用空载荷哈希。GET 可透传 Range 头（视频拖拽）。
 */
async function b2Fetch(
  s: SiteSettings,
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  key: string,
  body?: StorageBody,
  contentType?: string,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const endpoint = (s.b2_endpoint || "").trim().replace(/\/+$/, "");
  const bucket = (s.b2_bucket || "").trim();
  if (!endpoint || !bucket || !s.b2_key_id || !s.b2_app_key) {
    throw new Error("B2 配置不完整（endpoint/bucket/keyId/appKey）");
  }

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`${endpoint}/${encodeURIComponent(bucket)}/${encodedKey}`);
  const region = b2Region(endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash =
    method === "PUT" ? "UNSIGNED-PAYLOAD" : await sha256Hex("");

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (method === "PUT" && contentType) headers["content-type"] = contentType;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  const signedNames = Object.keys(headers).sort();
  const canonicalHeaders =
    signedNames.map(n => `${n}:${headers[n].trim()}`).join("\n") + "\n";
  const canonicalRequest = [
    method,
    url.pathname,
    url.search || "",
    canonicalHeaders,
    signedNames.join(";"),
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac("AWS4" + s.b2_app_key, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = await hmacHex(kSigning, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${s.b2_key_id}/${scope}, SignedHeaders=${signedNames.join(";")}, Signature=${signature}`;

  return fetch(url.toString(), {
    method,
    headers: { ...headers, Authorization: authorization },
    body,
  });
}

/** 写入对象：B2 模式下传到 B2（key 需带 b2/ 前缀），否则写入 R2 */
export async function putObject(
  r2: R2Bucket,
  s: SiteSettings,
  key: string,
  body: StorageBody,
  contentType: string
): Promise<void> {
  if (s.storage_mode === "b2") {
    const resp = await b2Fetch(s, "PUT", key, body, contentType);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`B2 上传失败（HTTP ${resp.status}）：${text.slice(0, 200)}`);
    }
  } else {
    await r2.put(key, body, { httpMetadata: { contentType } });
  }
}

/** 删除单个对象：b2/ 前缀走 B2，否则走 R2 */
export async function deleteObject(r2: R2Bucket, s: SiteSettings, key: string): Promise<void> {
  if (isB2Key(key)) {
    const resp = await b2Fetch(s, "DELETE", key);
    if (!resp.ok && resp.status !== 404) {
      const text = await resp.text().catch(() => "");
      throw new Error(`B2 删除失败（HTTP ${resp.status}）：${text.slice(0, 200)}`);
    }
  } else {
    await r2.delete(key);
  }
}

/** 批量删除：R2 合并一次删，B2 逐个删（失败静默） */
export async function deleteObjects(r2: R2Bucket, s: SiteSettings, keys: string[]): Promise<void> {
  const b2Keys = keys.filter(isB2Key);
  const r2Keys = keys.filter(k => !isB2Key(k));
  if (r2Keys.length) await r2.delete(r2Keys).catch(() => {});
  await Promise.all(b2Keys.map(k => deleteObject(r2, s, k).catch(() => {})));
}

/** 探测对象是否存在（头像缓存检查用）：b2/ 前缀走 B2 HEAD，否则 R2 head */
export async function headObject(r2: R2Bucket, s: SiteSettings, key: string): Promise<boolean> {
  if (isB2Key(key)) {
    const resp = await b2Fetch(s, "HEAD", key);
    return resp.status === 200;
  }
  return (await r2.head(key)) !== null;
}

/**
 * 从 B2 读取对象流（私有桶代理用）：返回 fetch Response，对象不存在返回 null。
 * @param range 客户端 Range 头原样透传（S3 支持，视频拖拽必需）
 */
export async function getB2Object(s: SiteSettings, key: string, range?: string): Promise<Response | null> {
  const resp = await b2Fetch(s, "GET", key, undefined, undefined, range ? { range } : undefined);
  if (resp.status === 404) return null;
  if (!resp.ok && resp.status !== 206) {
    const text = await resp.text().catch(() => "");
    throw new Error(`B2 读取失败（HTTP ${resp.status}）：${text.slice(0, 200)}`);
  }
  return resp;
}

/** 测试 B2 配置：写入并删除一个探针对象，验证凭证/桶/读写权限 */
export async function testB2Storage(s: SiteSettings): Promise<{ ok: boolean; msg: string }> {
  const key = `${B2_PREFIX}.moments-test-${crypto.randomUUID()}`;
  try {
    const put = await b2Fetch(s, "PUT", key, "ok", "text/plain");
    if (!put.ok) {
      const text = await put.text().catch(() => "");
      return { ok: false, msg: `B2 写入失败（HTTP ${put.status}）：${text.slice(0, 200)}` };
    }
    const del = await b2Fetch(s, "DELETE", key);
    if (!del.ok && del.status !== 404) {
      const text = await del.text().catch(() => "");
      return { ok: false, msg: `B2 删除失败（HTTP ${del.status}）：${text.slice(0, 200)}` };
    }
    return { ok: true, msg: "B2 连接正常：读写探针对象成功" };
  } catch (e) {
    return { ok: false, msg: "B2 连接失败：" + (e instanceof Error ? e.message : String(e)) };
  }
}