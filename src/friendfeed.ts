/**
 * 友圈（/friends）抓取核心：
 * - 零依赖 RSS 2.0 / Atom 正则解析（Workers CPU 受限，不上 XML 解析库）
 * - 每源 5s 超时；摘要去 HTML 截 120 字；配图最多 9 张
 * - upsert（friend_id+link 唯一）后修剪库存 12 篇/源，结果写回 friends.feed_status
 * - 头像缓存进 R2：站点 favicon（首页 <link rel=icon> → /favicon.ico）→ QQ 邮箱 qlogo
 */
import { keyToSrc } from "./db";
import { putObject } from "./storage";
import { getSettings, type SiteSettings } from "./settings";
import type { HonoEnv } from "./types";

type Bindings = HonoEnv["Bindings"];

export interface FriendFeedRow {
  id: number;
  name: string;
  url: string;
  email: string;
  avatar: string;
  feed_url: string;
  feed_tag: string;
}

export interface FriendPostRow {
  id: number;
  friend_id: number;
  title: string;
  excerpt: string;
  link: string;
  images: string; // JSON 数组字符串
  published_at: string;
  clicks: number;
}

const MAX_FEED_BYTES = 2 * 1024 * 1024; // 订阅源上限 2MB
const MAX_IMG_BYTES = 2 * 1024 * 1024; // 头像上限 2MB
const FEED_TIMEOUT_MS = 5000;
const AVATAR_TIMEOUT_MS = 3500;
export const FRIENDS_POST_LIMIT = 12; // 每源库存上限
const MAX_IMAGES = 9;
const MAX_ITEMS = 20; // 单次解析只取前 20 条（库存 12 足够）

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/* ==================== 文本工具 ==================== */

/** 剥离 CDATA 包裹 */
function cdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

/** 解码常见 HTML 实体（feed 标题/摘要高频） */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const n = parseInt(h, 16);
      try { return String.fromCodePoint(n); } catch { return ""; }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      const n = parseInt(d, 10);
      try { return String.fromCodePoint(n); } catch { return ""; }
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'");
}

/** 去 HTML 标签 → 纯文本摘要 */
function stripHtml(html: string): string {
  return decodeEntities(
    cdata(html)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** 取标签文本（大小写不敏感，剥 CDATA/实体） */
function tagText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(cdata(m[1])).trim() : "";
}

/** 相对 URL → 绝对 URL；非法/非 http(s) 返回空 */
function absUrl(raw: string, base: string): string {
  const v = (raw || "").trim();
  if (!v || v.startsWith("data:")) return "";
  try {
    const u = new URL(v, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

/** 从 HTML 内容提取图片（img src），绝对化、去重、最多 9 张 */
function extractImages(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) && out.length < MAX_IMAGES) {
    const u = absUrl(decodeEntities(m[1]), base);
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

/** 解析时间为 ISO 字符串；失败返回空串 */
function parseDate(raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

/* ==================== RSS / Atom 解析 ==================== */

export interface ParsedFeedItem {
  title: string;
  link: string;
  excerpt: string;
  images: string[];
  published_at: string;
}

/** RSS 2.0 <item> 解析 */
function parseRssItem(block: string, base: string): ParsedFeedItem | null {
  const title = tagText(block, "title").slice(0, 200);
  const link = absUrl(tagText(block, "link") || tagText(block, "guid"), base);
  if (!link) return null;
  // 正文：content:encoded 优先于 description。
  // 先剥 CDATA 再解码实体——RSS 正文常把 HTML 实体编码存储（&lt;section&gt;），
  // 必须先解码出真实标签，下面的图片提取与 stripHtml 才能生效
  const content = decodeEntities(cdata(
    (block.match(/<content:encoded(?:\s[^>]*)?>([\s\S]*?)<\/content:encoded>/i)?.[1] ?? "") ||
    (block.match(/<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i)?.[1] ?? "")
  ));
  const excerpt = stripHtml(content).slice(0, 120);
  // 配图：enclosure / media:content / media:thumbnail / 正文 img
  const images: string[] = [];
  const push = (u: string) => {
    const a = absUrl(u, base);
    if (a && !images.includes(a) && images.length < MAX_IMAGES) images.push(a);
  };
  const encRe = /<enclosure[^>]*>/gi;
  let m;
  while ((m = encRe.exec(block))) {
    const tag = m[0];
    const type = /type=["']([^"']*)["']/i.exec(tag)?.[1] || "";
    const url = /url=["']([^"']+)["']/i.exec(tag)?.[1] || "";
    if (url && (/image/i.test(type) || /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i.test(url))) push(url);
  }
  const mediaRe = /<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["'][^>]*>/gi;
  while ((m = mediaRe.exec(block))) push(m[1]);
  extractImages(content, base).forEach(push);
  const published_at =
    parseDate(tagText(block, "pubDate")) ||
    parseDate(block.match(/<dc:date(?:\s[^>]*)?>([\s\S]*?)<\/dc:date>/i)?.[1] ?? "") ||
    parseDate(tagText(block, "published")) ||
    parseDate(tagText(block, "updated"));
  return { title, link, excerpt, images, published_at };
}

/** Atom <entry> 解析 */
function parseAtomEntry(block: string, base: string): ParsedFeedItem | null {
  const title = tagText(block, "title").slice(0, 200);
  // link：rel=alternate 优先，否则第一个带 href 的 link
  let link = "";
  const linkRe = /<link[^>]*>/gi;
  let m;
  let firstHref = "";
  while ((m = linkRe.exec(block))) {
    const tag = m[0];
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1] || "";
    if (!href) continue;
    if (!firstHref) firstHref = href;
    const rel = /rel=["']([^"']*)["']/i.exec(tag)?.[1] || "alternate";
    if (rel === "alternate") { link = href; break; }
  }
  link = absUrl(link || firstHref, base);
  if (!link) return null;
  const content = decodeEntities(cdata(
    (block.match(/<content(?:\s[^>]*)?>([\s\S]*?)<\/content>/i)?.[1] ?? "") ||
    (block.match(/<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary>/i)?.[1] ?? "")
  ));
  const excerpt = stripHtml(content).slice(0, 120);
  const images = extractImages(content, base);
  const published_at = parseDate(tagText(block, "published")) || parseDate(tagText(block, "updated"));
  return { title, link, excerpt, images, published_at };
}

/** 解析订阅源 XML：自动识别 RSS / Atom，返回前 20 条（按源内原始顺序） */
export function parseFeed(xml: string, base: string): ParsedFeedItem[] {
  const out: ParsedFeedItem[] = [];
  const seen = new Set<string>();
  const push = (it: ParsedFeedItem | null) => {
    if (!it || seen.has(it.link) || out.length >= MAX_ITEMS) return;
    seen.add(it.link);
    out.push(it);
  };
  const rssRe = /<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi;
  let m;
  while ((m = rssRe.exec(xml)) && out.length < MAX_ITEMS) push(parseRssItem(m[0], base));
  if (!out.length) {
    const atomRe = /<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi;
    while ((m = atomRe.exec(xml)) && out.length < MAX_ITEMS) push(parseAtomEntry(m[0], base));
  }
  return out;
}

/** 从站点首页 HTML 探测 RSS/Atom 地址（<link rel="alternate" type="application/rss+xml|atom+xml">） */
export function detectFeedFromHtml(html: string, base: string): string {
  const re = /<link[^>]*>/gi;
  let m;
  let fallback = "";
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (!/rel=["'][^"']*alternate[^"']*["']/i.test(tag)) continue;
    const type = /type=["']([^"']*)["']/i.exec(tag)?.[1] || "";
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1] || "";
    if (!href) continue;
    if (/rss/i.test(type)) return absUrl(href, base);
    if (/atom|xml|json/i.test(type) && !fallback) fallback = absUrl(href, base);
  }
  return fallback;
}

/**
 * 常见订阅路径兜底探测：首页未声明 <link rel=alternate> 时逐个尝试
 * /feed/、/feed、/feed.xml、/rss.xml 等常见路径。
 * 同时试当前路径前缀（如 /blog 子目录安装的博客会试 /blog/atom.xml）。
 * 有些站点对不存在路径也返回 200（SPA 兜底 HTML），必须实际解析出条目才算命中。
 * 并行请求（各 4s 超时），按路径优先级返回第一个有效源；全部失败返回空串。
 */
const COMMON_FEED_PATHS = ["/feed/", "/feed", "/feed.xml", "/rss.xml", "/rss", "/atom.xml", "/index.xml"];

export async function probeCommonFeedPaths(siteUrl: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(siteUrl);
  } catch {
    return "";
  }
  const path = u.pathname.replace(/\/+$/, ""); // 去尾部斜杠
  const dir = path.replace(/\/[^/]*$/, ""); // 上一级目录
  const prefixes = [...new Set([path, dir, ""])];
  const candidates = prefixes.flatMap(pre => COMMON_FEED_PATHS.map(p => pre + p));
  const hits = await Promise.all(
    candidates.map(async p => {
      const full = u.origin + p;
      const text = await fetchText(full, 4000, "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*");
      if (!text) return "";
      return parseFeed(text, full).length ? full : "";
    })
  );
  return hits.find(Boolean) || "";
}

/* ==================== 网络抓取 ==================== */

/** 带超时的文本抓取；超限/失败返回 null */
async function fetchText(url: string, timeoutMs: number, accept: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      // Accept-Encoding 限定 gzip：Workers 自动解压 gzip，但不保证解压 br，
      // 防止个别源站无视 UA 强塞 brotli 导致拿到乱码无法解析
      headers: { "User-Agent": UA, Accept: accept, "Accept-Encoding": "gzip" },
    });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared && declared > MAX_FEED_BYTES) return null;
    const text = await res.text();
    if (text.length > MAX_FEED_BYTES) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface ImgBytes { bytes: ArrayBuffer; type: string; ext: string; }

function extFromType(ct: string, url: string): string {
  if (/png/i.test(ct) || /\.png(\?|#|$)/i.test(url)) return "png";
  if (/gif/i.test(ct) || /\.gif(\?|#|$)/i.test(url)) return "gif";
  if (/webp/i.test(ct) || /\.webp(\?|#|$)/i.test(url)) return "webp";
  if (/svg/i.test(ct) || /\.svg(\?|#|$)/i.test(url)) return "svg";
  if (/x-icon|vnd\.microsoft\.icon/i.test(ct) || /\.ico(\?|#|$)/i.test(url)) return "ico";
  return "jpg";
}

/** 抓取图片二进制（头像用）；非图片/超限返回 null */
async function fetchImageBytes(url: string): Promise<ImgBytes | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AVATAR_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_IMG_BYTES) return null;
    if (!/image|icon|octet-stream/i.test(ct) && !/\.(jpe?g|png|gif|webp|svg|ico)(\?|#|$)/i.test(url)) return null;
    return { bytes: buf, type: ct || "image/jpeg", ext: extFromType(ct, url) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ==================== 头像缓存 ==================== */

/**
 * 头像为空时尽力补齐：站点 favicon（首页 link rel=icon → /favicon.ico）→ QQ 邮箱 qlogo。
 * 成功则写入 R2 friends/{id}.{ext}（B2 模式 b2/friends/ 前缀）并更新 friends.avatar。
 */
async function ensureFriendAvatar(env: Bindings, s: SiteSettings, f: FriendFeedRow): Promise<void> {
  if (f.avatar) return; // 已有自定义头像或已缓存
  let img: ImgBytes | null = null;
  // ① 站点 favicon
  const home = await fetchText(f.url, FEED_TIMEOUT_MS, "text/html,application/xhtml+xml");
  if (home) {
    let href = "";
    const iconRe = /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi;
    let m;
    while ((m = iconRe.exec(home))) {
      const hm = /href=["']([^"']+)["']/i.exec(m[0]);
      if (hm?.[1]) { href = hm[1]; break; }
    }
    const iconUrl = absUrl(href, f.url) || absUrl("/favicon.ico", f.url);
    if (iconUrl) img = await fetchImageBytes(iconUrl);
  }
  // ② QQ 邮箱 → qlogo
  if (!img) {
    const qq = /^(\d{5,11})@qq\.com$/i.exec((f.email || "").trim())?.[1] || "";
    if (qq) img = await fetchImageBytes(`https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`);
  }
  if (!img) return;
  const prefix = s.storage_mode === "b2" ? "b2/friends/" : "friends/";
  const key = `${prefix}${f.id}.${img.ext}`;
  try {
    await putObject(env.R2, s, key, img.bytes, img.type);
    await env.DB.prepare(`UPDATE friends SET avatar = ? WHERE id = ?`).bind(key, f.id).run();
  } catch (e) {
    console.error(`[friends-fetch] avatar put failed id=${f.id}:`, e);
  }
}

/* ==================== 抓取主流程 ==================== */

/** 抓单个友站：拉 feed → 解析 → upsert → 修剪 12 篇 → 补头像。返回写 feed_status 的摘要 */
async function fetchOneFriend(env: Bindings, s: SiteSettings, f: FriendFeedRow): Promise<string> {
  const xml = await fetchText(f.feed_url, FEED_TIMEOUT_MS, "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*");
  if (!xml) return "抓取失败：订阅源无法访问或超时";
  const items = parseFeed(xml, f.feed_url);
  if (!items.length) {
    // 诊断：把实际收到的内容特征写进 feed_status，方便区分防护拦截页 / 乱码 / 非订阅源内容
    const head = xml.slice(0, 400);
    const text = stripHtml(head).replace(/\s+/g, " ").trim().slice(0, 40);
    const hint = /<html[\s>]/i.test(head)
      ? `收到 HTML 页面（疑似站点防护拦截）：${text}`
      : text ? `内容无法识别：${text}` : "内容无法识别（非文本响应）";
    return `解析失败：未发现文章条目（${hint}）`;
  }

  const now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO friend_posts (friend_id, title, excerpt, link, images, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, COALESCE(NULLIF(?,''), ?), ?, ?)
     ON CONFLICT(friend_id, link) DO UPDATE SET
       title = excluded.title,
       excerpt = excluded.excerpt,
       images = excluded.images,
       published_at = CASE WHEN excluded.published_at <> '' THEN excluded.published_at ELSE friend_posts.published_at END,
       updated_at = excluded.updated_at`
  );
  await env.DB.batch(
    items.map(it =>
      stmt.bind(f.id, it.title, it.excerpt, it.link, JSON.stringify(it.images), it.published_at, now, now, now)
    )
  );
  // 修剪库存：每源只留最新 12 篇
  await env.DB.prepare(
    `DELETE FROM friend_posts WHERE friend_id = ? AND id NOT IN
       (SELECT id FROM friend_posts WHERE friend_id = ? ORDER BY published_at DESC, id DESC LIMIT ${FRIENDS_POST_LIMIT})`
  )
    .bind(f.id, f.id)
    .run();
  // 头像补齐（尽力而为，失败不影响抓取结果）
  await ensureFriendAvatar(env, s, f);
  return "ok";
}

/**
 * 抓取一轮：
 * - 指定 friendId：只抓该源（后台「立即抓取」）
 * - 否则按 kv 游标跨轮轮转，每轮最多 limit 个源（默认 10）
 */
export async function runFriendsFetch(
  env: Bindings,
  opts: { friendId?: number; limit?: number } = {}
): Promise<{ fetched: number; ok: number; results: { id: number; status: string }[] }> {
  const s = await getSettings(env.DB);
  const friends: FriendFeedRow[] = [];

  if (opts.friendId) {
    const f = await env.DB.prepare(
      `SELECT id, name, url, email, avatar, feed_url, feed_tag FROM friends WHERE id = ? AND feed_url <> ''`
    )
      .bind(opts.friendId)
      .first<FriendFeedRow>();
    if (f) friends.push(f);
  } else {
    const limit = Math.max(1, Math.min(50, opts.limit ?? 10));
    const curRow = await env.DB.prepare(`SELECT value FROM kv_store WHERE key = 'friends_fetch_cursor'`).first<{ value: string }>();
    const cursor = parseInt(curRow?.value || "0", 10) || 0;
    const selectSql = `SELECT id, name, url, email, avatar, feed_url, feed_tag FROM friends
       WHERE status = 'approved' AND feed_enabled = 1 AND feed_url <> ''`;
    let rows = (
      await env.DB.prepare(`${selectSql} AND id > ? ORDER BY id ASC LIMIT ?`).bind(cursor, limit).all<FriendFeedRow>()
    ).results ?? [];
    if (!rows.length && cursor > 0) {
      // 一轮结束：回到开头重新开始
      rows = (await env.DB.prepare(`${selectSql} ORDER BY id ASC LIMIT ?`).bind(limit).all<FriendFeedRow>()).results ?? [];
    }
    friends.push(...rows);
  }

  const results: { id: number; status: string }[] = [];
  for (const f of friends) {
    let status: string;
    try {
      status = await fetchOneFriend(env, s, f);
    } catch (e) {
      status = `抓取异常：${String((e as Error | undefined)?.message || e).slice(0, 80)}`;
    }
    results.push({ id: f.id, status });
    await env.DB.prepare(`UPDATE friends SET feed_status = ? WHERE id = ?`).bind(status, f.id).run();
  }

  // 更新轮转游标为本次最后一个源 id
  if (!opts.friendId && friends.length) {
    const lastId = friends[friends.length - 1].id;
    await env.DB.prepare(
      `INSERT INTO kv_store (key, value, updated_at) VALUES ('friends_fetch_cursor', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
      .bind(String(lastId))
      .run();
  }

  return { fetched: results.length, ok: results.filter(r => r.status === "ok").length, results };
}

/* ==================== 配额交错分页 ==================== */

export interface FriendPostView extends FriendPostRow {
  friend_name: string;
  friend_url: string;
  avatar: string;
  feed_tag: string;
}

/**
 * 源级平滑加权轮询（nginx smooth weighted round-robin）：
 * 以「友站」为单位交错编成一条时间线——只要别的源还有货，同源文章绝不相邻，彻底防霸屏；
 * 权重 = 所在池配额 ÷ 池内源数（后台三池配额继续生效，配额 0 的池整体不展示）；
 * 源内保持发布时间倒序（SQL 已按 published_at DESC, id DESC 排序，分组后源内顺序不变）。
 */
export function quotaInterleave(
  rows: FriendPostView[],
  quotas: { blog: number; community: number; tech: number }
): FriendPostView[] {
  // 按源分组（未知 tag 归入 blog 池），统计各池源数
  const byFriend = new Map<number, { tag: string; items: FriendPostView[] }>();
  for (const r of rows) {
    const tag = quotas[r.feed_tag as keyof typeof quotas] !== undefined ? r.feed_tag : "blog";
    let g = byFriend.get(r.friend_id);
    if (!g) {
      g = { tag, items: [] };
      byFriend.set(r.friend_id, g);
    }
    g.items.push(r);
  }
  const poolSrcCount: Record<string, number> = { blog: 0, community: 0, tech: 0 };
  for (const g of byFriend.values()) poolSrcCount[g.tag]++;
  const weightOf = (fid: number): number => {
    const g = byFriend.get(fid)!;
    const q = quotas[g.tag as keyof typeof quotas] || 0;
    return q > 0 ? q / Math.max(1, poolSrcCount[g.tag]) : 0;
  };

  const cw = new Map<number, number>();
  const out: FriendPostView[] = [];
  let lastFid = -1;
  while (out.length < rows.length) {
    let totalW = 0;
    for (const [fid, g] of byFriend) {
      if (!g.items.length || weightOf(fid) <= 0) continue; // 0 配额源不参与选择
      cw.set(fid, (cw.get(fid) ?? 0) + weightOf(fid));
      totalW += weightOf(fid);
    }
    if (totalW <= 0) break; // 剩余全是 0 配额的池，不展示
    // 硬约束：上一条来源不重复（有其他源可选时让位给次优），
    // 弥补平滑轮询在源耗尽、权重总和变化时可能出现的相邻重复
    let best = -1;
    let bestW = -Infinity;
    let alt = -1;
    let altW = -Infinity;
    for (const [fid, g] of byFriend) {
      if (!g.items.length || weightOf(fid) <= 0) continue;
      const c = cw.get(fid)!;
      if (c > bestW) {
        bestW = c;
        best = fid;
      }
      if (fid !== lastFid && c > altW) {
        altW = c;
        alt = fid;
      }
    }
    const pick = best !== lastFid || alt === -1 ? best : alt;
    if (pick === -1) break;
    cw.set(pick, cw.get(pick)! - totalW);
    out.push(byFriend.get(pick)!.items.shift()!);
    lastFid = pick;
  }
  return out;
}

export const FRIEND_TAG_NAMES: Record<string, string> = { blog: "博客", community: "社区", tech: "技术" };

/** 输出视图：images 解析为数组，头像 key 解析为可访问 URL */
export function serializeFriendPost(r: FriendPostView, r2Domain?: string, b2Domain?: string) {
  let images: string[] = [];
  try {
    const v = JSON.parse(r.images || "[]");
    if (Array.isArray(v)) images = v.map(String).filter(Boolean).slice(0, 9);
  } catch { /* 非法 JSON 按无图处理 */ }
  const avatar = r.avatar
    ? /^https?:\/\//i.test(r.avatar) ? r.avatar : keyToSrc(r.avatar, r2Domain, b2Domain)
    : "";
  return {
    id: r.id,
    friend_id: r.friend_id,
    friend_name: r.friend_name,
    friend_url: r.friend_url,
    avatar,
    tag: r.feed_tag,
    tag_name: FRIEND_TAG_NAMES[r.feed_tag] || FRIEND_TAG_NAMES.blog,
    title: r.title,
    excerpt: r.excerpt,
    link: r.link,
    images,
    published_at: r.published_at,
    clicks: Number(r.clicks ?? 0),
  };
}
