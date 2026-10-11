/**
 * 存储抽象：本地磁盘 / Cloudflare R2（S3 兼容 API）/ Backblaze B2（S3 兼容 API）三后端。
 * 对象 key 前缀决定物理后端（与当前选择的存储模式无关，保证历史文件永远可达/可删）：
 * - 无前缀：本地磁盘（Node 版 DiskR2；storage_mode=local 时新上传落这里）
 * - b2/ 前缀：Backblaze B2（storage_mode=b2 时新上传自动加该前缀）
 * - r2/ 前缀：Cloudflare R2 远端桶（storage_mode=r2 时新上传自动加该前缀）
 */
import type { SiteSettings } from "./settings";

const B2_PREFIX = "b2/";
const R2_PREFIX = "r2/";

/** 判断 key 是否位于 B2（b2/ 前缀） */
export function isB2Key(key: string): boolean {
  return key.startsWith(B2_PREFIX);
}

/** 判断 key 是否位于远端 R2（r2/ 前缀；无前缀的是本地磁盘对象） */
export function isRemoteR2Key(key: string): boolean {
  return key.startsWith(R2_PREFIX);
}

/** 按存储模式返回新上传对象的 key 前缀 */
export function storagePrefix(mode: string): "" | "b2/" | "r2/" {
  if (mode === "b2") return B2_PREFIX;
  if (mode === "r2") return R2_PREFIX;
  return "";
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

/** S3 兼容凭证（B2 与 R2 共用） */
export interface S3Creds {
  endpoint: string;
  bucket: string;
  keyId: string;
  secret: string;
  region: string;
  label: string; // 错误提示用（"B2" / "R2"）
}

function b2Creds(s: SiteSettings): S3Creds | null {
  const endpoint = (s.b2_endpoint || "").trim().replace(/\/+$/, "");
  const bucket = (s.b2_bucket || "").trim();
  if (!endpoint || !bucket || !s.b2_key_id || !s.b2_app_key) return null;
  return { endpoint, bucket, keyId: s.b2_key_id, secret: s.b2_app_key, region: b2Region(endpoint), label: "B2" };
}

function r2Creds(s: SiteSettings): S3Creds | null {
  const endpoint = (s.r2_endpoint || "").trim().replace(/\/+$/, "");
  const bucket = (s.r2_bucket || "").trim();
  if (!endpoint || !bucket || !s.r2_key_id || !s.r2_secret_key) return null;
  // R2 SigV4 签名固定使用 region=auto
  return { endpoint, bucket, keyId: s.r2_key_id, secret: s.r2_secret_key, region: "auto", label: "R2" };
}

/**
 * 发送带 AWS SigV4 签名的 S3 兼容请求（path-style：/<bucket>/<key>）。
 * PUT 使用 UNSIGNED-PAYLOAD 流式上传（不整读文件，兼容大视频）；
 * GET/DELETE/HEAD 使用空载荷哈希。GET 可透传 Range 头（视频拖拽）。
 */
async function s3Fetch(
  creds: S3Creds,
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  key: string,
  body?: StorageBody,
  contentType?: string,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const { endpoint, bucket, keyId, secret, region } = creds;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`${endpoint}/${encodeURIComponent(bucket)}/${encodedKey}`);
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

  const kDate = await hmac("AWS4" + secret, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = await hmacHex(kSigning, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${signedNames.join(";")}, Signature=${signature}`;

  // Node(undici)：body 为 ReadableStream 时必须显式声明 duplex:"half"，
  // 否则抛 "duplex option is required when sending a body"；Workers 运行时无需此选项。
  const isNode =
    typeof (globalThis as { process?: { versions?: { node?: string } } }).process
      ?.versions?.node === "string";
  const fetchInit: RequestInit & { duplex?: "half" } = {
    method,
    headers: { ...headers, Authorization: authorization },
    body,
  };
  if (isNode && body && typeof (body as ReadableStream<Uint8Array>).getReader === "function") {
    fetchInit.duplex = "half";
  }

  const resp = await fetch(url.toString(), fetchInit);
  return resp;
}

/** 写入对象：按 key 前缀路由到 B2 / 远端 R2，无前缀写入本地磁盘适配器 */
export async function putObject(
  r2: R2Bucket,
  s: SiteSettings,
  key: string,
  body: StorageBody,
  contentType: string
): Promise<void> {
  const creds = isB2Key(key) ? b2Creds(s) : isRemoteR2Key(key) ? r2Creds(s) : null;
  if (creds) {
    const resp = await s3Fetch(creds, "PUT", key, body, contentType);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`${creds.label} 上传失败（HTTP ${resp.status}）：${text.slice(0, 200)}`);
    }
  } else {
    await r2.put(key, body, { httpMetadata: { contentType } });
  }
}

/** 删除单个对象：b2/ 走 B2，r2/ 走远端 R2，其余走本地磁盘 */
export async function deleteObject(r2: R2Bucket, s: SiteSettings, key: string): Promise<void> {
  const creds = isB2Key(key) ? b2Creds(s) : isRemoteR2Key(key) ? r2Creds(s) : null;
  if (creds) {
    const resp = await s3Fetch(creds, "DELETE", key);
    if (!resp.ok && resp.status !== 404) {
      const text = await resp.text().catch(() => "");
      throw new Error(`${creds.label} 删除失败（HTTP ${resp.status}）：${text.slice(0, 200)}`);
    }
  } else {
    await r2.delete(key);
  }
}

/** 批量删除：本地磁盘合并一次删，B2/R2 逐个删（失败静默） */
export async function deleteObjects(r2: R2Bucket, s: SiteSettings, keys: string[]): Promise<void> {
  const remoteKeys = keys.filter(k => isB2Key(k) || isRemoteR2Key(k));
  const localKeys = keys.filter(k => !isB2Key(k) && !isRemoteR2Key(k));
  // 本地磁盘适配器逐个删（DiskR2 已兼容数组，逐个调用也保证其它适配器无数组重载时不丢删除）
  await Promise.all(localKeys.map(k => r2.delete(k).catch(() => {})));
  await Promise.all(remoteKeys.map(k => deleteObject(r2, s, k).catch(() => {})));
}

/** 探测对象是否存在（头像缓存检查用）：远端前缀走 S3 HEAD，否则本地磁盘 head */
export async function headObject(r2: R2Bucket, s: SiteSettings, key: string): Promise<boolean> {
  const creds = isB2Key(key) ? b2Creds(s) : isRemoteR2Key(key) ? r2Creds(s) : null;
  if (creds) {
    const resp = await s3Fetch(creds, "HEAD", key);
    return resp.status === 200;
  }
  return (await r2.head(key)) !== null;
}

/**
 * 从远端 S3 兼容桶读取对象流（私有桶代理用）：返回 fetch Response，对象不存在返回 null。
 * @param range 客户端 Range 头原样透传（S3 支持，视频拖拽必需）
 */
export async function getS3Object(
  creds: S3Creds,
  key: string,
  range?: string
): Promise<Response | null> {
  const resp = await s3Fetch(creds, "GET", key, undefined, undefined, range ? { range } : undefined);
  if (resp.status === 404) return null;
  if (!resp.ok && resp.status !== 206) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${creds.label} 读取失败（HTTP ${resp.status}）：${text.slice(0, 200)}`);
  }
  return resp;
}

/** B2 私有桶对象代理读取 */
export async function getB2Object(s: SiteSettings, key: string, range?: string): Promise<Response | null> {
  const creds = b2Creds(s);
  if (!creds) throw new Error("B2 配置不完整（endpoint/bucket/keyId/appKey）");
  return getS3Object(creds, key, range);
}

/** 远端 R2 私有桶对象代理读取 */
export async function getR2Object(s: SiteSettings, key: string, range?: string): Promise<Response | null> {
  const creds = r2Creds(s);
  if (!creds) throw new Error("R2 配置不完整（endpoint/bucket/keyId/secretKey）");
  return getS3Object(creds, key, range);
}

/** 取当前可用的远端凭证（/media 代理按 key 前缀调用） */
export function remoteCreds(s: SiteSettings, key: string): S3Creds | null {
  if (isB2Key(key)) return b2Creds(s);
  if (isRemoteR2Key(key)) return r2Creds(s);
  return null;
}

/** 测试 S3 兼容存储：写入并删除一个探针对象，验证凭证/桶/读写权限 */
async function testS3Storage(creds: S3Creds, prefix: string): Promise<{ ok: boolean; msg: string }> {
  const key = `${prefix}.moments-test-${crypto.randomUUID()}`;
  try {
    const put = await s3Fetch(creds, "PUT", key, "ok", "text/plain");
    if (!put.ok) {
      const text = await put.text().catch(() => "");
      return { ok: false, msg: `${creds.label} 写入失败（HTTP ${put.status}）：${text.slice(0, 200)}` };
    }
    const del = await s3Fetch(creds, "DELETE", key);
    if (!del.ok && del.status !== 404) {
      const text = await del.text().catch(() => "");
      return { ok: false, msg: `${creds.label} 删除失败（HTTP ${del.status}）：${text.slice(0, 200)}` };
    }
    return { ok: true, msg: `${creds.label} 连接正常：读写探针对象成功` };
  } catch (e) {
    return { ok: false, msg: `${creds.label} 连接失败：` + (e instanceof Error ? e.message : String(e)) };
  }
}

/** 测试 B2 配置 */
export async function testB2Storage(s: SiteSettings): Promise<{ ok: boolean; msg: string }> {
  const creds = b2Creds(s);
  if (!creds) return { ok: false, msg: "B2 配置不完整（endpoint/bucket/keyId/appKey）" };
  return testS3Storage(creds, B2_PREFIX);
}

/** 测试 R2 配置 */
export async function testR2Storage(s: SiteSettings): Promise<{ ok: boolean; msg: string }> {
  const creds = r2Creds(s);
  if (!creds) return { ok: false, msg: "R2 配置不完整（endpoint/bucket/keyId/secretKey）" };
  return testS3Storage(creds, R2_PREFIX);
}
