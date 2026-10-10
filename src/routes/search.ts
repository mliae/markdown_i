/**
 * 站内搜索路由（前缀 /api/search）
 * 公开：GET /?q=关键词  跨表 LIKE 搜索：已发布文章 + 说说 + 已通过友链
 */
import { Hono } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import { keyToSrc } from "../db";
import { getSettings } from "../settings";

const app = new Hono<HonoEnv>();

const MAX = 15; // 每组最多返回条数

/** 取文本片段，便于结果列表展示 */
function snippet(text: string, q: string, len = 90): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= len) return t;
  const idx = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
  const start = idx > 20 ? idx - 20 : 0;
  return (start > 0 ? "…" : "") + t.slice(start, start + len) + "…";
}

app.get("/", async c => {
  const q = (c.req.query("q") || "").trim();
  if (!q) return fail(c, "请输入搜索关键词", 400);
  if (q.length > 50) return fail(c, "关键词过长", 400);

  const s = await getSettings(c.env.DB);
  const r2 = s.r2_domain;
  const b2 = s.b2_domain;
  const like = `%${q}%`;

  // 已发布文章：标题 / 摘要 / 正文
  const postRows = (
    await c.env.DB.prepare(
      `SELECT id, slug, title, excerpt, cover, created_at FROM posts
       WHERE status = 'published' AND (title LIKE ? OR excerpt LIKE ? OR content_md LIKE ?)
       ORDER BY created_at DESC LIMIT ?`
    )
      .bind(like, like, like, MAX)
      .all<{ id: number; slug: string; title: string; excerpt: string; cover: string; created_at: string }>()
  ).results;
  const posts_more = postRows.length >= MAX;
  const posts = postRows.map(p => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: snippet(p.excerpt || p.title, q),
    cover: p.cover ? keyToSrc(p.cover, r2, b2) : "",
    created_at: p.created_at,
  }));

  // 说说：内容 / 位置
  const momentRows = (
    await c.env.DB.prepare(
      `SELECT id, content, location, created_at FROM moments
       WHERE content LIKE ? OR location LIKE ?
       ORDER BY created_at DESC LIMIT ?`
    )
      .bind(like, like, MAX)
      .all<{ id: number; content: string; location: string; created_at: string }>()
  ).results;
  const moments_more = momentRows.length >= MAX;
  const moments = momentRows.map(m => ({
    id: m.id,
    content: snippet(m.content, q, 120),
    location: m.location || "",
    created_at: m.created_at,
  }));

  // 已通过友链：名称 / 描述
  const friendRows = (
    await c.env.DB.prepare(
      `SELECT id, name, url, description, avatar, category FROM friends
       WHERE status = 'approved' AND (name LIKE ? OR description LIKE ?)
       ORDER BY sort_order ASC, id DESC LIMIT ?`
    )
      .bind(like, like, MAX)
      .all<{ id: number; name: string; url: string; description: string; avatar: string; category: string }>()
  ).results;
  const friends_more = friendRows.length >= MAX;
  const friends = friendRows.map(f => ({
    id: f.id,
    name: f.name,
    url: f.url,
    description: snippet(f.description, q, 60),
    avatar: f.avatar ? keyToSrc(f.avatar, r2, b2) : "",
    category: f.category || "",
  }));

  const total = posts.length + moments.length + friends.length;
  return ok(c, { query: q, total, posts, moments, friends, posts_more, moments_more, friends_more });
});

export default app;
