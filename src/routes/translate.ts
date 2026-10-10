/**
 * 内容按需翻译（P2）
 * 公开：POST /api/translate  { type: post|moment|about, id, lang: zh-TW|en }
 * - 只收内容 ID，不收自由文本，防止被当作免费翻译 API 盗用
 * - 译文按原文哈希永久缓存（content_translations），原文更新自动重译
 * - 同 IP 60 秒窗口限频；简繁本地转换，英文走 Workers AI
 */
import { Hono } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import { isAdmin } from "../auth";
import { getSettings } from "../settings";
import { parseLangs } from "../i18n";
import { toTraditional, toEnglish, toEnglishShort } from "../translate";
import { baiduToEnglish } from "../baidu-translate";

const app = new Hono<HonoEnv>();

const RATE_LIMIT = 15; // 每 IP 每分钟翻译请求上限

interface SourcePost {
  id: number;
  title: string;
  content_md: string;
  status: string;
}
interface SourceMoment {
  id: number;
  content: string;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

interface CachedRow {
  title: string | null;
  content: string;
  engine: string;
  src_hash: string;
}

app.post("/", async c => {
  let body: { type?: unknown; id?: unknown; lang?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const type = String(body.type || "");
  const lang = String(body.lang || "");
  const idRaw = String(body.id ?? "").slice(0, 32);
  if (!["post", "moment", "about"].includes(type)) return fail(c, "不支持的内容类型", 400);
  if (!["zh-TW", "en"].includes(lang)) return fail(c, "不支持的目标语言", 400);

  const s = await getSettings(c.env.DB);
  if (!s.i18n_enabled) return fail(c, "多语言功能未开启", 403);
  if (!s.i18n_content_translate) return fail(c, "内容翻译未开启", 403);
  if (!parseLangs(s).includes(lang as "zh-TW" | "en")) return fail(c, "目标语言未开放", 403);

  // 取原文（标题/正文）；about 取后台 4 个文案字段
  let cid = "site";
  let title = "";
  let content = "";
  let aboutFields: Record<string, string> | null = null;

  if (type === "post") {
    if (!/^\d+$/.test(idRaw)) return fail(c, "文章 ID 非法", 400);
    const row = await c.env.DB.prepare(
      `SELECT id, title, content_md, status FROM posts WHERE id = ?`
    ).bind(Number(idRaw)).first<SourcePost>();
    if (!row) return fail(c, "文章不存在", 404);
    const admin = await isAdmin(c);
    if (row.status !== "published" && !admin) return fail(c, "文章不存在", 404);
    cid = String(row.id);
    title = row.title || "";
    content = row.content_md || "";
  } else if (type === "moment") {
    if (!/^\d+$/.test(idRaw)) return fail(c, "动态 ID 非法", 400);
    const row = await c.env.DB.prepare(
      `SELECT id, content FROM moments WHERE id = ?`
    ).bind(Number(idRaw)).first<SourceMoment>();
    if (!row) return fail(c, "动态不存在", 404);
    cid = String(row.id);
    content = row.content || "";
  } else {
    aboutFields = {
      greeting: s.about_greeting || "",
      greeting_sub: s.about_greeting_sub || "",
      signature: s.about_signature || "",
      bio: s.about_bio || "",
    };
    content = JSON.stringify(aboutFields);
  }
  if (!content.trim() && !title.trim()) return fail(c, "没有可翻译的内容", 400);

  const srcHash = await sha256Hex(title + "\u0001" + content);

  // 缓存命中：哈希一致直接返回
  const cached = await c.env.DB.prepare(
    `SELECT title, content, engine, src_hash FROM content_translations
     WHERE content_type = ? AND content_id = ? AND lang = ?`
  ).bind(type, cid, lang).first<CachedRow>();
  if (cached && cached.src_hash === srcHash) {
    return ok(c, {
      engine: cached.engine,
      cached: true,
      title: cached.title ?? undefined,
      content: cached.content,
      fields: type === "about" ? JSON.parse(cached.content) : undefined,
    });
  }

  // 频控（管理员不受限）：未命中缓存才计费，翻译本身才消耗资源
  const admin = await isAdmin(c);
  const ip = c.req.header("cf-connecting-ip") || "";
  if (!admin && ip) {
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const cnt = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM translate_rate WHERE ip = ? AND created_at > ?`
    ).bind(ip, windowStart).first<{ n: number }>();
    if (Number(cnt?.n ?? 0) >= RATE_LIMIT) return fail(c, "翻译过于频繁，请稍后再试", 429);
  }

  let outTitle: string | null = null;
  let outContent = "";
  let engine = "local";
  try {
    if (lang === "zh-TW") {
      // 本地简繁转换：确定性、零成本
      outTitle = title ? toTraditional(title) : null;
      if (aboutFields) {
        outContent = JSON.stringify({
          greeting: toTraditional(aboutFields.greeting),
          greeting_sub: toTraditional(aboutFields.greeting_sub),
          signature: toTraditional(aboutFields.signature),
          bio: toTraditional(aboutFields.bio),
        });
      } else {
        outContent = toTraditional(content);
      }
    } else {
      // 英文：优先百度翻译（国内直连、快且稳），任一失败回退 Workers AI
      const hasBaidu = !!(s.baidu_translate_appid && s.baidu_translate_key);
      engine = hasBaidu ? "baidu" : "ai";
      /**
       * 单段中译英：百度 → AI 回退。
       * @param text 原文
       * @param long 是否长文（长文走分块翻译，短文本直接单次请求）
       */
      const enText = async (text: string, long: boolean): Promise<string> => {
        const t0 = (text || "").trim();
        if (!t0) return text;
        if (hasBaidu) {
          try {
            return await baiduToEnglish(s.baidu_translate_appid, s.baidu_translate_key, text);
          } catch (e) {
            console.warn("[translate] baidu failed, fallback to Workers AI:", e instanceof Error ? e.message : e);
            engine = "ai";
          }
        }
        if (!c.env.AI) throw new Error("AI binding unavailable");
        return long ? toEnglish(c.env.AI, text) : toEnglishShort(c.env.AI, text);
      };

      if (aboutFields) {
        // 顺序请求：百度标准版 QPS=1，并发会触发 54003 频控
        const greeting = aboutFields.greeting ? await enText(aboutFields.greeting, false) : "";
        const greetingSub = aboutFields.greeting_sub ? await enText(aboutFields.greeting_sub, false) : "";
        const signature = aboutFields.signature ? await enText(aboutFields.signature, false) : "";
        const bio = aboutFields.bio ? await enText(aboutFields.bio, true) : "";
        outContent = JSON.stringify({ greeting, greeting_sub: greetingSub, signature, bio });
      } else {
        if (title) outTitle = await enText(title, false);
        outContent = await enText(content, true);
      }
      if (!outContent.trim() && !(outTitle && outTitle.trim())) {
        return fail(c, "翻译服务暂时不可用，请稍后重试", 502);
      }
    }
  } catch (e) {
    console.warn("[translate] failed:", type, cid, lang, e instanceof Error ? e.message : e);
    return fail(c, "翻译失败，请稍后重试", 502);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO content_translations (content_type, content_id, lang, src_hash, title, content, engine, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(content_type, content_id, lang) DO UPDATE SET
       src_hash = excluded.src_hash, title = excluded.title, content = excluded.content,
       engine = excluded.engine, updated_at = excluded.updated_at`
  ).bind(type, cid, lang, srcHash, outTitle, outContent, engine, now, now).run();

  // 成功才计入频控
  if (!admin && ip) {
    await c.env.DB.prepare(`INSERT INTO translate_rate (ip) VALUES (?)`).bind(ip).run();
  }

  return ok(c, {
    engine,
    cached: false,
    title: outTitle ?? undefined,
    content: outContent,
    fields: aboutFields ? JSON.parse(outContent) : undefined,
  });
});

export default app;
