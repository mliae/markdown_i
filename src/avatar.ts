/**
 * 评论头像本地缓存：QQ → Gravatar → 随机头像 API，全部下载存进 R2 avatars/ 目录。
 * 按邮箱 md5 命名，同一邮箱稳定复用；刷新缓存时强制重拉覆盖。
 */
import type { SiteSettings } from "./settings";
import { keyToSrc } from "./db";
import { headObject, putObject } from "./storage";

const MAX_BYTES = 5 * 1024 * 1024; // 单张头像上限 5MB

/* ---------------- md5（Gravatar 与 R2 key 都需要）---------------- */
function md5cycle(x: number[], k: number[]) {
  let [a, b, c, d] = x;
  a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
  a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
  a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
  a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
  x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
}
function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}
function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
function add32(a: number, b: number) { return (a + b) & 0xffffffff; }

function md5hex(str: string): string {
  const utf8 = decodeURIComponent(encodeURIComponent(str));
  const n = utf8.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i: number;
  for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(utf8.substring(i - 64, i)));
  utf8.substring(i - 64);
  const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let j = 0;
  for (i = i - 64; i < n; j++) tail[j >> 2] |= utf8.charCodeAt(i++) << ((j % 4) << 3);
  tail[j >> 2] |= 0x80 << ((j % 4) << 3);
  if (j > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
  tail[14] = n * 8;
  md5cycle(state, tail);
  let hex = "";
  for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) hex += ((state[i] >> (j << 3)) & 0xff).toString(16).padStart(2, "0");
  return hex;
}
function md5blk(s: string) {
  const md5blks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 64; i += 4) {
    md5blks[i >> 2] =
      s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
  }
  return md5blks;
}

/* ---------------- 头像获取 ---------------- */

interface ImgBytes { bytes: ArrayBuffer; type: string; ext: string; }

function extFromType(ct: string): string {
  if (/png/i.test(ct)) return "png";
  if (/gif/i.test(ct)) return "gif";
  if (/webp/i.test(ct)) return "webp";
  if (/svg/i.test(ct)) return "svg";
  return "jpg";
}

/** 单个头像源请求超时（毫秒）：海外边缘拉国内源经常静默丢包，必须快速放弃 */
const FETCH_TIMEOUT_MS = 3500;

async function fetchBytes(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<ImgBytes | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) {
      // 部分接口（如 apihz）返回 JSON：{code,msg}，msg 是图片地址
      try {
        const data = (await res.json()) as { code?: number; msg?: string };
        if (data && data.code === 200 && /^https?:\/\//i.test(data.msg || "")) {
          return fetchBytes(data.msg!);
        }
      } catch { /* 不是合法 JSON，忽略 */ }
      return null;
    }
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return null;
    if (!/image|octet-stream/i.test(ct) && !/\.(jpe?g|png|gif|webp|svg|bmp)(\?|$)/i.test(url)) return null;
    return { bytes: buf, type: ct.split(";")[0] || "image/jpeg", ext: extFromType(ct) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** QQ 头像 */
function qqAvatarUrl(qq: string): string {
  return `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(qq)}&s=100`;
}

/** Gravatar 镜像列表，依次尝试，d=404 时无头像返回 404 便于降级 */
const GRAVATAR_MIRRORS = [
  "https://gravatar.loli.net/avatar/",
  "https://sdn.geekzu.org/avatar/",
  "https://cravatar.cn/avatar/",
  "https://www.gravatar.com/avatar/",
];

/** 按链路拉取头像图片：QQ → Gravatar → 随机 API；返回图片二进制或 null */
async function fetchAvatarImage(email: string, qq: string, s: SiteSettings): Promise<ImgBytes | null> {
  // ① QQ
  if (qq) {
    const img = await fetchBytes(qqAvatarUrl(qq));
    if (img) return img;
  }
  // ② Gravatar
  if (email) {
    const h = md5hex(email.toLowerCase().trim());
    for (const base of GRAVATAR_MIRRORS) {
      const img = await fetchBytes(`${base}${h}?d=404&s=120&r=g`);
      if (img) return img;
    }
  }
  // ③ 随机头像 API（后台可配，多行自动切换，支持 {imgtype} 占位）
  const imgtype = /^\d{1,2}$/.test(s.random_avatar_imgtype) ? s.random_avatar_imgtype : "9";
  const lines = (s.random_avatar_api || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const url = line.replace(/\{imgtype\}/gi, imgtype);
    const img = await fetchBytes(url);
    if (img) return img;
  }
  return null;
}

/** 邮箱 → 头像文件名（不含扩展）；B2 模式自动加 b2/ 前缀便于路由与删除 */
export function avatarBaseName(email: string, storageMode = "r2"): string {
  const prefix = storageMode === "b2" ? "b2/avatars/" : "avatars/";
  return `${prefix}${md5hex(email.toLowerCase().trim())}`;
}

export interface EnsureResult { src: string; cached: boolean; }

/**
 * 确保某邮箱的头像已存入存储（R2 或 B2），返回可访问 src。
 * @param force 为 true 时跳过缓存、强制重新拉取覆盖（刷新缓存用）
 */
export async function ensureAvatar(
  r2: R2Bucket,
  s: SiteSettings,
  email: string,
  qq: string,
  force = false
): Promise<EnsureResult | null> {
  const mail = (email || (qq ? `${qq}@qq.com` : "")).trim().toLowerCase();
  if (!mail) return null;
  const base = avatarBaseName(mail, s.storage_mode);

  if (!force) {
    // 已缓存：探测可能的扩展名（jpg/png/gif/webp/svg）
    for (const ext of ["jpg", "png", "gif", "webp", "svg"]) {
      const exists = await headObject(r2, s, `${base}.${ext}`);
      if (exists) return { src: keyToSrc(`${base}.${ext}`, s.r2_domain, s.b2_domain), cached: true };
    }
  }

  const img = await fetchAvatarImage(mail, qq, s);
  if (!img) return null;
  const key = `${base}.${img.ext}`;
  await putObject(r2, s, key, img.bytes, img.type);
  return { src: keyToSrc(key, s.r2_domain, s.b2_domain), cached: false };
}

/**
 * 头像补偿任务（cron 周期调用）：
 * 扫描近 3 天内、头像拉取失败（avatar_url 为空）的评论重新拉取。
 * 海外边缘访问国内头像 API 偶发超时，隔几分钟重试成功率很高；
 * avatar_tries 达到上限后放弃，避免无限消耗第三方 API 配额。
 */
export async function backfillMissingAvatars(
  r2: R2Bucket,
  db: D1Database,
  s: SiteSettings
): Promise<{ checked: number; fixed: number }> {
  // B2 模式每条评论的 HEAD 探测也走外网子请求且占并发连接，批量更小；R2 绑定操作不计子请求
  const limit = s.storage_mode === "b2" ? 3 : 5;
  const rows = await db
    .prepare(
      `SELECT id, email, qq FROM comments
       WHERE is_ai = 0 AND avatar_url = '' AND (email <> '' OR qq <> '')
         AND avatar_tries < 5
         AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')
       ORDER BY id DESC LIMIT ?`
    )
    .bind(limit)
    .all<{ id: number; email: string; qq: string }>();

  const list = rows.results ?? [];
  let fixed = 0;

  const handleOne = async (r: { id: number; email: string; qq: string }): Promise<void> => {
    let src = "";
    try {
      // ensureAvatar 内部仍按 QQ → Gravatar → 随机 API 优先级串行拉取
      const res = await ensureAvatar(r2, s, r.email, r.qq || "");
      if (res) src = res.src;
    } catch { /* 单条失败不影响其他评论 */ }
    // 无论成败都 +1 尝试次数；成功写入头像地址，失败保持空等待下一轮
    await db
      .prepare(`UPDATE comments SET avatar_url = ?, avatar_tries = avatar_tries + 1 WHERE id = ?`)
      .bind(src, r.id)
      .run();
    if (src) fixed++;
  };

  if (s.storage_mode === "b2") {
    // B2 HEAD 探测占用外网并发连接（免费版同时仅 6 条），串行处理
    for (const r of list) await handleOne(r);
  } else {
    // R2 模式无外网并发压力，并发处理压缩耗时
    await Promise.all(list.map(handleOne));
  }

  return { checked: list.length, fixed };
}
