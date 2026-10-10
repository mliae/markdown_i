/**
 * 友情链接路由
 * 公开：
 *   GET  /api/friends              已上架友站（可按 category 筛选），含统计
 *   POST /api/friends/apply        访客提交友链申请（status=pending，待后台审核）
 *   GET  /api/friends/info?url=    抓取目标站点的 名称/描述/图标（用于表单自动回填）
 *   GET  /api/friends/posts        友圈：友站文章配额交错分页（?page=1）
 *   POST /api/friends/posts/:id/click  友圈：点击热度 +1
 * 管理（/api/admin/friends）：
 *   GET    /                       全部友站（含待审核/已拒绝）
 *   POST   /                       新增（直接上架）
 *   PUT    /:id                    编辑
 *   DELETE /:id                    删除
 *   POST   /:id/approve            审核通过
 *   POST   /:id/reject             拒绝
 *   GET    /detect-feed?url=       探测站点 RSS/Atom 订阅地址
 *   POST   /:id/fetch              立即抓取该友站订阅源
 */
import { Hono } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import { requireAdmin } from "../auth";
import { getSettings } from "../settings";
import { notify } from "../security";
import {
  detectFeedFromHtml,
  probeCommonFeedPaths,
  quotaInterleave,
  runFriendsFetch,
  serializeFriendPost,
  type FriendPostView,
} from "../friendfeed";

const app = new Hono<HonoEnv>();

export interface FriendRow {
  id: number;
  name: string;
  url: string;
  description: string;
  avatar: string;
  category: string;
  email: string;
  sort_order: number;
  status: string;
  last_checked: string;
  feed_url: string;
  feed_enabled: number;
  feed_tag: string;
  feed_status: string;
  last_post_at: string; // 友站最近发文时间（friend_posts 聚合，无订阅源为空）
  last_post_title: string; // 最近发文标题
  last_post_link: string; // 最近发文链接
  created_at: string;
  updated_at: string;
}

/** 友站最近发文聚合（SQLite：MAX() 所在行的裸列值即最新一篇的 title/link） */
const LAST_POST_JOIN = `
  LEFT JOIN (
    SELECT friend_id, title AS last_post_title, link AS last_post_link, MAX(published_at) AS last_post_at
    FROM friend_posts GROUP BY friend_id
  ) lp ON lp.friend_id = f.id`;

const FEED_TAGS = ["blog", "community", "tech"];

function normalizeFeedTag(v: unknown): string {
  const t = String(v ?? "").trim();
  return FEED_TAGS.includes(t) ? t : "blog";
}

function serializeFriend(row: FriendRow) {
  return {
    id: row.id,
    name: row.name ?? "",
    url: row.url ?? "",
    description: row.description ?? "",
    avatar: row.avatar ?? "",
    category: row.category ?? "",
    email: row.email ?? "",
    sort_order: Number(row.sort_order ?? 0),
    status: row.status ?? "approved",
    last_checked: row.last_checked ?? "",
    feed_url: row.feed_url ?? "",
    feed_enabled: Number(row.feed_enabled ?? 0) === 1,
    feed_tag: row.feed_tag ?? "blog",
    feed_status: row.feed_status ?? "",
    last_post_at: row.last_post_at ?? "",
    last_post_title: row.last_post_title ?? "",
    last_post_link: row.last_post_link ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* ==================== 公开接口 ==================== */

/** 友链申请状态公开流水（访客在 /links/apply 查看所有申请审核进度） */
app.get("/all-applications", async c => {
  const statusParam = String(c.req.query("status") || "").trim();
  const validStatuses = ["pending", "approved", "rejected"] as const;
  const status = validStatuses.includes(statusParam as typeof validStatuses[number])
    ? (statusParam as typeof validStatuses[number])
    : "";
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const per_page = Math.max(1, Math.min(50, parseInt(c.req.query("per_page") || "10", 10) || 10));

  // 状态计数（不受 status 过滤影响，tab 栏始终显示全部状态数量）
  const countBatch = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM friends WHERE status = 'pending'"),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM friends WHERE status = 'approved'"),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM friends WHERE status = 'rejected'"),
  ]);
  const counts = {
    all: Number((countBatch[0].results[0] as { n: number })?.n ?? 0)
      + Number((countBatch[1].results[0] as { n: number })?.n ?? 0)
      + Number((countBatch[2].results[0] as { n: number })?.n ?? 0),
    pending: Number((countBatch[0].results[0] as { n: number })?.n ?? 0),
    approved: Number((countBatch[1].results[0] as { n: number })?.n ?? 0),
    rejected: Number((countBatch[2].results[0] as { n: number })?.n ?? 0),
  };

  let where = "";
  const binds: (string | number)[] = [];
  if (status) {
    where = "WHERE status = ?";
    binds.push(status);
  }

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM friends ${where}`
  ).bind(...binds).first<{ n: number }>();
  const total = Number(totalRow?.n ?? 0);
  const has_more = page * per_page < total;

  const rows = (
    await c.env.DB
      .prepare(
        `SELECT id, name, url, description, avatar, category, status, created_at, updated_at
         FROM friends ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
      )
      .bind(...binds, per_page, (page - 1) * per_page)
      .all<FriendRow>()
  ).results;

  // 只返回公开字段（email / feed_url / feed_status 等内部字段不暴露）
  const list = rows.map(r => ({
    id: r.id,
    name: r.name ?? "",
    url: r.url ?? "",
    description: r.description ?? "",
    avatar: r.avatar ?? "",
    category: r.category ?? "",
    status: r.status ?? "pending",
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return ok(c, { list, total, page, per_page, has_more, counts });
});

/** 已上架友站列表 + 统计（友站总数 / 分类数 / 本月新增） */
app.get("/", async c => {
  const category = String(c.req.query("category") || "").trim();
  const s = await getSettings(c.env.DB);

  let where = `WHERE status = 'approved'`;
  const binds: (string | number)[] = [];
  if (category && category !== "全部") {
    where += ` AND category = ?`;
    binds.push(category);
  }
  const list = (
    await c.env.DB
      .prepare(
        `SELECT f.*, lp.last_post_at, lp.last_post_title, lp.last_post_link
         FROM friends f ${LAST_POST_JOIN} ${where} ORDER BY f.sort_order ASC, f.id DESC`
      )
      .bind(...binds)
      .all<FriendRow>()
  ).results.map(serializeFriend);

  // 统计基于全部已上架
  const totalRow = await c.env.DB
    .prepare(`SELECT COUNT(*) AS n FROM friends WHERE status = 'approved'`)
    .first<{ n: number }>();
  const catRow = await c.env.DB
    .prepare(`SELECT COUNT(DISTINCT category) AS n FROM friends WHERE status = 'approved' AND category != ''`)
    .first<{ n: number }>();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const newRow = await c.env.DB
    .prepare(`SELECT COUNT(*) AS n FROM friends WHERE status = 'approved' AND created_at >= ?`)
    .bind(monthStart.toISOString())
    .first<{ n: number }>();

  const categories = String(s.links_categories || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  return ok(c, {
    list,
    stats: {
      total: Number(totalRow?.n ?? 0),
      categories: Number(catRow?.n ?? 0),
      newThisMonth: Number(newRow?.n ?? 0),
    },
    categories,
  });
});

/** 抓取目标站点信息：名称/描述/图标（不写库，仅返回供表单回填） */
app.get("/info", async c => {
  const raw = String(c.req.query("url") || "").trim();
  const info = await fetchSiteInfo(raw);
  if (!info) return fail(c, "无法获取该站点信息，请检查网址或手动填写", 400);
  return ok(c, info);
});

/** 访客提交友链申请 */
app.post("/apply", async c => {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const name = String(body.name ?? "").trim().slice(0, 60);
  const url = normalizeUrl(String(body.url ?? "").trim());
  const description = String(body.description ?? "").trim().slice(0, 300);
  const email = String(body.email ?? "").trim().slice(0, 120);
  const avatar = String(body.avatar ?? "").trim().slice(0, 500);
  const category = String(body.category ?? "").trim().slice(0, 30);

  if (!name) return fail(c, "请填写站点名称", 400);
  if (!url) return fail(c, "请填写正确的站点地址", 400);
  if (!/^https?:\/\//i.test(url)) return fail(c, "站点地址需以 http(s):// 开头", 400);

  const feedUrlRaw = String(body.feed_url ?? "").trim();
  const feed_url = feedUrlRaw ? normalizeUrl(feedUrlRaw) : "";

  const now = new Date().toISOString();
  const info = await fetchSiteInfo(url); // 尽力抓取，失败不阻塞
  const row = await c.env.DB.prepare(
    `INSERT INTO friends (name, url, description, avatar, category, email, sort_order, status, last_checked, feed_url, feed_enabled, feed_tag, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, 0, 'blog', ?, ?) RETURNING *`
  )
    .bind(
      info?.name || name,
      url,
      info?.description || description,
      avatar || info?.avatar || "",
      category,
      email,
      now,
      feed_url || info?.feed_url || "",
      now,
      now
    )
    .first<FriendRow>();

  // Webhook 通知（走「新评论」开关，异步不阻塞）
  const s = await getSettings(c.env.DB);
  c.executionCtx.waitUntil(
    notify(
      s,
      "comment",
      "🔗 新友链申请",
      `站点：${info?.name || name}\n地址：${url}\n描述：${(info?.description || description || "(无)").slice(0, 120)}\n订阅：${feed_url || info?.feed_url || "(未填)"}\n邮箱：${email || "(未填)"}`
    )
  );

  return ok(c, { id: row?.id, status: "pending" }, "已提交，站长审核通过后会出现在友链列表");
});

/* ==================== 友圈公开接口 ==================== */

const FRIENDS_PAGE_SIZE = 10;

/**
 * 友圈文章流：blog/community/tech 三池按配额交错（后台可调），池内跨源轮转防霸榜。
 * 库存硬上限 = 源数 × 12，规模可控，全量取出后在 JS 交错分页，保证各页顺序确定。
 */
app.get("/posts", async c => {
  const s = await getSettings(c.env.DB);
  if (!s.friends_enabled) return fail(c, "友圈功能未启用", 404);
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const rows = (
    await c.env.DB.prepare(
      `SELECT p.id, p.friend_id, p.title, p.excerpt, p.link, p.images, p.published_at, p.clicks,
              f.name AS friend_name, f.url AS friend_url, f.avatar, f.feed_tag
       FROM friend_posts p
       JOIN friends f ON f.id = p.friend_id
       WHERE f.status = 'approved' AND f.feed_enabled = 1
       ORDER BY p.published_at DESC, p.id DESC`
    ).all<FriendPostView>()
  ).results;

  const pct = (v: string, dft: number) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : dft;
  };
  const ordered = quotaInterleave(rows, {
    blog: pct(s.friends_quota_blog, 60),
    community: pct(s.friends_quota_community, 30),
    tech: pct(s.friends_quota_tech, 10),
  });

  const total = ordered.length;
  const list = ordered
    .slice((page - 1) * FRIENDS_PAGE_SIZE, page * FRIENDS_PAGE_SIZE)
    .map(r => serializeFriendPost(r, s.r2_domain, s.b2_domain));
  const res = ok(c, { list, page, page_size: FRIENDS_PAGE_SIZE, total, has_more: page * FRIENDS_PAGE_SIZE < total });
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=120");
  return res;
});

/** 点击热度 +1（前端 sendBeacon 上报，不阻塞跳转） */
app.post("/posts/:id/click", async c => {
  const s = await getSettings(c.env.DB);
  if (!s.friends_enabled) return fail(c, "友圈功能未启用", 404);
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);
  await c.env.DB.prepare(`UPDATE friend_posts SET clicks = clicks + 1 WHERE id = ?`).bind(id).run();
  const row = await c.env.DB.prepare(`SELECT clicks FROM friend_posts WHERE id = ?`).bind(id).first<{ clicks: number }>();
  return ok(c, { id, clicks: Number(row?.clicks ?? 0) });
});

/* ==================== 后台接口 ==================== */

const admin = new Hono<HonoEnv>();

admin.get("/", requireAdmin, async c => {
  const status = String(c.req.query("status") || "").trim();
  let where = "";
  const binds: (string | number)[] = [];
  if (status === "pending" || status === "approved" || status === "rejected") {
    where = "WHERE status = ?";
    binds.push(status);
  }
  const rows = (
    await c.env.DB
      .prepare(`SELECT f.*, lp.last_post_at, lp.last_post_title, lp.last_post_link FROM friends f ${LAST_POST_JOIN} ${where} ORDER BY f.sort_order ASC, f.id DESC`)
      .bind(...binds)
      .all<FriendRow>()
  ).results;
  const pending = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM friends WHERE status = 'pending'`).first<{ n: number }>())?.n ?? 0;
  return ok(c, { list: rows.map(serializeFriend), pending_count: Number(pending) });
});

admin.post("/", requireAdmin, async c => {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const name = String(body.name ?? "").trim().slice(0, 60);
  const url = normalizeUrl(String(body.url ?? "").trim());
  if (!name || !url) return fail(c, "名称和地址必填", 400);
  const now = new Date().toISOString();
  const feedUrl = normalizeUrl(String(body.feed_url ?? "").trim());
  const row = await c.env.DB.prepare(
    `INSERT INTO friends (name, url, description, avatar, category, email, sort_order, status, last_checked, feed_url, feed_enabled, feed_tag, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(
      name,
      url,
      String(body.description ?? "").slice(0, 500),
      String(body.avatar ?? "").slice(0, 500),
      String(body.category ?? "").slice(0, 30),
      String(body.email ?? "").slice(0, 120),
      Number(body.sort_order) || 0,
      now,
      feedUrl,
      body.feed_enabled === false || body.feed_enabled === 0 || body.feed_enabled === "0" ? 0 : 1,
      normalizeFeedTag(body.feed_tag),
      now,
      now
    )
    .first<FriendRow>();
  return ok(c, serializeFriend(row as FriendRow), "已添加");
});

admin.put("/:id", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);
  const existing = await c.env.DB.prepare(`SELECT * FROM friends WHERE id = ?`).bind(id).first<FriendRow>();
  if (!existing) return fail(c, "友站不存在", 404);
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const name = body.name !== undefined ? String(body.name).trim().slice(0, 60) : existing.name;
  const url = body.url !== undefined ? normalizeUrl(String(body.url).trim()) || existing.url : existing.url;
  const description = body.description !== undefined ? String(body.description).slice(0, 500) : existing.description;
  const avatar = body.avatar !== undefined ? String(body.avatar).slice(0, 500) : existing.avatar;
  const category = body.category !== undefined ? String(body.category).slice(0, 30) : existing.category;
  const email = body.email !== undefined ? String(body.email).slice(0, 120) : existing.email;
  const sort_order = body.sort_order !== undefined ? Number(body.sort_order) || 0 : existing.sort_order;
  const feed_url = body.feed_url !== undefined ? normalizeUrl(String(body.feed_url).trim()) : existing.feed_url;
  const feed_tag = body.feed_tag !== undefined ? normalizeFeedTag(body.feed_tag) : existing.feed_tag;
  const feed_enabled =
    body.feed_enabled !== undefined
      ? body.feed_enabled === false || body.feed_enabled === 0 || body.feed_enabled === "0" ? 0 : 1
      : existing.feed_enabled;
  let status = existing.status;
  if (body.status !== undefined && ["pending", "approved", "rejected"].includes(String(body.status))) {
    status = String(body.status);
  }
  await c.env.DB.prepare(
    `UPDATE friends SET name=?, url=?, description=?, avatar=?, category=?, email=?, sort_order=?, status=?, feed_url=?, feed_enabled=?, feed_tag=?, updated_at=? WHERE id=?`
  )
    .bind(name, url, description, avatar, category, email, sort_order, status, feed_url, feed_enabled, feed_tag, new Date().toISOString(), id)
    .run();
  const updated = await c.env.DB.prepare(`SELECT * FROM friends WHERE id = ?`).bind(id).first<FriendRow>();
  return ok(c, serializeFriend(updated as FriendRow), "已更新");
});

admin.delete("/:id", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);
  const existing = await c.env.DB.prepare(`SELECT id FROM friends WHERE id = ?`).bind(id).first<{ id: number }>();
  if (!existing) return fail(c, "友站不存在", 404);
  await c.env.DB.prepare(`DELETE FROM friends WHERE id = ?`).bind(id).run();
  return ok(c, { id }, "已删除");
});

admin.post("/:id/approve", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(`UPDATE friends SET status='approved', updated_at=? WHERE id=?`).bind(new Date().toISOString(), id).run();
  return ok(c, { id, status: "approved" }, "已通过");
});

admin.post("/:id/reject", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(`UPDATE friends SET status='rejected', updated_at=? WHERE id=?`).bind(new Date().toISOString(), id).run();
  return ok(c, { id, status: "rejected" }, "已拒绝");
});

/** 探测站点 RSS/Atom 订阅地址（抓首页解析 <link rel="alternate">，不写库） */
admin.get("/detect-feed", requireAdmin, async c => {
  const url = normalizeUrl(String(c.req.query("url") || "").trim());
  if (!url) return fail(c, "请填写正确的站点地址", 400);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let html = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return fail(c, `站点无法访问（HTTP ${res.status}）`, 400);
    html = await res.text();
  } catch {
    return fail(c, "站点访问超时或失败", 400);
  } finally {
    clearTimeout(timer);
  }
  const feedUrl = detectFeedFromHtml(html, url) || (await probeCommonFeedPaths(url));
  if (!feedUrl) return fail(c, "未在该站发现 RSS/Atom 订阅地址（已尝试 /feed/、/rss.xml 等常见路径）", 404);
  return ok(c, { feed_url: feedUrl });
});

/** 立即抓取该友站订阅源（同步执行，返回抓取结果） */
admin.post("/:id/fetch", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);
  const f = await c.env.DB.prepare(`SELECT id, feed_url FROM friends WHERE id = ?`).bind(id).first<{ id: number; feed_url: string }>();
  if (!f) return fail(c, "友站不存在", 404);
  if (!f.feed_url) return fail(c, "请先填写订阅地址（feed_url）", 400);
  const r = await runFriendsFetch(c.env, { friendId: id });
  const status = r.results[0]?.status || "未知结果";
  const updated = await c.env.DB.prepare(`SELECT * FROM friends WHERE id = ?`).bind(id).first<FriendRow>();
  return ok(c, { status, friend: updated ? serializeFriend(updated) : null }, status === "ok" ? "抓取完成" : status);
});

/* ==================== 抓取站点信息 ==================== */

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && (b === 168 || b === 0)) return true;
    if (a >= 224) return true;
  }
  if (h === "::1" || h === "::" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

function normalizeUrl(raw: string): string {
  let v = raw.trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (isBlockedHost(u.hostname)) return "";
    return u.toString();
  } catch {
    return "";
  }
}

/** 抓取目标站首页，解析 title / description / favicon。失败返回 null。 */
async function fetchSiteInfo(rawUrl: string): Promise<{ name: string; description: string; avatar: string; url: string; feed_url: string } | null> {
  const url = normalizeUrl(rawUrl);
  if (!url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let html = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!html) return null;

  let base = url;
  const baseMatch = html.match(/<base[^>]+href=["']([^"']+)["']/i);
  if (baseMatch) {
    try { base = new URL(baseMatch[1], url).toString(); } catch { /* keep url */ }
  }

  const name = (() => {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 80) : "";
  })();
  const description = (() => {
    const m = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
    return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
  })();

  const avatar = (() => {
    const iconRe = /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi;
    let href = "";
    let mm;
    while ((mm = iconRe.exec(html))) {
      const tag = mm[0];
      const hm = tag.match(/href=["']([^"']+)["']/i);
      if (hm && hm[1]) { href = hm[1]; break; }
    }
    if (href) {
      try { return new URL(href, base).toString(); } catch { /* fallthrough */ }
    }
    try { return new URL("/favicon.ico", base).toString(); } catch { return ""; }
  })();

  const feed_url = detectFeedFromHtml(html, base);

  return { name, description, avatar, url, feed_url };
}

export default app;
export { admin as adminFriendRoutes };
