/**
 * 访问统计：
 *  公开上报
 *   POST /api/analytics/pv     记录一次页面浏览，返回 { id }（供离开时回写停留时长）
 *   POST /api/analytics/leave  回写停留秒数（sendBeacon）
 *  后台查询（requireAdmin）
 *   GET  /api/admin/analytics/summary?days=7   总览 + 趋势 + 热门页 + 来源 + 画像
 *        /api/admin/analytics/summary?date=YYYY-MM-DD  单天详情（行展开懒加载用）
 *   GET  /api/admin/analytics/daily?days=30    每日明细表格（PV/UV/停留/设备/热门页）
 *   GET  /api/admin/analytics/sources?days=7   来源分析（分类占比 + 趋势 + 明细）
 *   GET  /api/admin/analytics/visitors?limit=50 最近访客会话（IP + 地区 + 浏览序列 + 停留）
 *
 *  设计要点：
 *  - IP 明文存储并在后台展示；地区走 ip-api.com，结果按 IP 缓存到 analytics_ip_geo（免费版 45次/分，缓存后几乎不耗）。
 *  - 管理员（已登录）的访问不计入。
 *  - 明细只保留 90 天，写入时顺带低频清理。
 */
import { Hono } from "hono";
import { ok } from "../respond";
import type { HonoEnv } from "../types";
import { getSettings } from "../settings";
import { isAdmin, requireAdmin } from "../auth";

const publicApp = new Hono<HonoEnv>();
const adminApp = new Hono<HonoEnv>();

const RETENTION_DAYS = 90;

/* ---------------- UA 解析（轻量，够后台画像用） ---------------- */
function parseUA(ua: string) {
  const u = ua || "";
  let device = "desktop";
  if (/iPad|Tablet|PlayBook|Silk/i.test(u)) device = "tablet";
  else if (/Mobi|Android|iPhone|iPod|Windows Phone|BlackBerry/i.test(u)) device = "mobile";

  let browser = "其他";
  if (/Edg\//i.test(u)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(u)) browser = "Opera";
  else if (/Firefox\//i.test(u)) browser = "Firefox";
  else if (/Chrome\//i.test(u) && !/Chromium/i.test(u)) browser = "Chrome";
  else if (/Chromium/i.test(u)) browser = "Chromium";
  else if (/Safari\//i.test(u)) browser = "Safari";

  let os = "其他";
  if (/Windows NT 10/i.test(u)) os = "Windows 10/11";
  else if (/Windows/i.test(u)) os = "Windows";
  else if (/Android/i.test(u)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(u)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(u)) os = "macOS";
  else if (/Linux/i.test(u)) os = "Linux";

  return { device, browser, os };
}

/* ---------------- IP 归属地（ip-api.com + D1 缓存） ---------------- */
interface Geo { country: string; region: string; city: string; isp: string; }

async function lookupGeo(db: D1Database, ip: string, cfCountry: string): Promise<Geo> {
  if (!ip) return { country: cfCountry || "", region: "", city: "", isp: "" };
  const cached = await db
    .prepare(`SELECT country, region, city, isp FROM analytics_ip_geo WHERE ip = ?`)
    .bind(ip)
    .first<Geo>();
  if (cached) return cached;

  let geo: Geo = { country: cfCountry || "", region: "", city: "", isp: "" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,query&lang=zh-CN`,
      { signal: ctrl.signal, headers: { "User-Agent": "moments-analytics/1.0" } }
    );
    clearTimeout(t);
    if (res.ok) {
      const j = (await res.json()) as { status?: string; country?: string; regionName?: string; city?: string; isp?: string };
      if (j.status === "success") {
        geo = { country: j.country || "", region: j.regionName || "", city: j.city || "", isp: j.isp || "" };
      }
    }
  } catch {
    // 超时/失败：回退 CF 国家头，仍缓存避免重复请求
  }
  try {
    await db
      .prepare(
        `INSERT INTO analytics_ip_geo (ip, country, region, city, isp) VALUES (?,?,?,?,?)
         ON CONFLICT(ip) DO UPDATE SET country=excluded.country, region=excluded.region, city=excluded.city, isp=excluded.isp`
      )
      .bind(ip, geo.country, geo.region, geo.city, geo.isp)
      .run();
  } catch {
    /* 缓存写入失败不影响主流程 */
  }
  return geo;
}

/* ---------------- 简易内存限流（每隔离体，防刷） ---------------- */
const rl = new Map<string, { n: number; t: number }>();
function overLimit(ip: string): boolean {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now - e.t > 60000) { rl.set(ip, { n: 1, t: now }); return false; }
  e.n++;
  return e.n > 90; // 单 IP 每分钟上限 90 次
}

let lastPrune = 0;

/* ---------------- 日期范围解析（支持自定义 start/end + 环比 prevWhere） ---------------- */
function parseRange(c: { req: { query: (k: string) => string | undefined } }) {
  const start = (c.req.query("start") || "").trim().replace(/[^0-9-]/g, "").slice(0, 10);
  const end = (c.req.query("end") || "").trim().replace(/[^0-9-]/g, "").slice(0, 10);
  if (start && end && start <= end) {
    // 自定义日期范围
    const startDate = new Date(start + "T00:00:00.000Z");
    const endDate = new Date(end + "T23:59:59.999Z");
    const rangeMs = endDate.getTime() - startDate.getTime();
    const rangeDays = Math.floor(rangeMs / 86400000) + 1;
    // 上期：整段区间往前平移 rangeDays 天
    const prevEnd = new Date(startDate.getTime() - 1); // 前一天结束
    const prevStart = new Date(prevEnd.getTime() - rangeMs);
    const ps = prevStart.toISOString().slice(0, 10);
    const pe = prevEnd.toISOString().slice(0, 10);
    const where = `created_at >= '${start}T00:00:00.000Z' AND created_at <= '${end}T23:59:59.999Z'`;
    const prevWhere = `created_at >= '${ps}T00:00:00.000Z' AND created_at <= '${pe}T23:59:59.999Z'`;
    return { where, prevWhere, days: rangeDays, start, end };
  }
  const days = Math.max(1, Math.min(90, Number(c.req.query("days")) || 7));
  const where = `created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${days} days')`;
  const prevWhere = `created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${days * 2} days') AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${days} days')`;
  return { where, prevWhere, days, start: "", end: "" };
}

// 生成区间内每天的日期数组（用于趋势/明细补齐）
function buildDateList(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00.000Z");
  const e = new Date(end + "T00:00:00.000Z");
  for (let t = s; t <= e; t = new Date(t.getTime() + 86400000)) {
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

/* ---------------- 上报 PV ---------------- */
publicApp.post("/pv", async c => {
  const s = await getSettings(c.env.DB);
  if (!s.analytics_enabled) return ok(c, { disabled: true });
  if (await isAdmin(c)) return ok(c, { ignored: true }); // 后台不计

  let body: Record<string, unknown> = {};
  try { body = (await c.req.json()) as Record<string, unknown>; } catch { /* 空体也接受 */ }

  const ip = c.req.header("cf-connecting-ip") || "";
  if (overLimit(ip)) return ok(c, { throttled: true });

  const cfCountry = c.req.header("cf-ipcountry") || "";
  const ua = parseUA(c.req.header("user-agent") || "");
  const clamp = (v: unknown, n: number) => String(v ?? "").slice(0, n);

  const info = await c.env.DB
    .prepare(
      `INSERT INTO analytics_pv
        (path, title, referrer, utm_source, utm_medium, utm_campaign, country, ip, device, browser, os, sid)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      clamp(body.path, 300), clamp(body.title, 120), clamp(body.referrer, 500),
      clamp(body.utm_source, 60), clamp(body.utm_medium, 60), clamp(body.utm_campaign, 60),
      cfCountry, ip.slice(0, 64), ua.device, ua.browser, ua.os, clamp(body.sid, 64)
    )
    .run();
  const id = Number(info.meta?.last_row_id ?? 0);

  // 异步：补全归属地（不阻塞响应）+ 低频清理 90 天前明细
  c.executionCtx.waitUntil((async () => {
    try {
      const geo = await lookupGeo(c.env.DB, ip, cfCountry);
      if (geo.region || geo.city || geo.isp || (geo.country && geo.country !== cfCountry)) {
        await c.env.DB
          .prepare(`UPDATE analytics_pv SET country=?, region=?, city=?, isp=? WHERE id=?`)
          .bind(geo.country, geo.region, geo.city, geo.isp, id)
          .run();
      }
      const now = Date.now();
      if (now - lastPrune > 3600_000) {
        lastPrune = now;
        await c.env.DB.prepare(`DELETE FROM analytics_pv WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-${RETENTION_DAYS} days')`).run();
      }
    } catch { /* 后台任务失败静默 */ }
  })());

  return ok(c, { id });
});

/* ---------------- 回写停留时长 ---------------- */
publicApp.post("/leave", async c => {
  let body: Record<string, unknown> = {};
  try { body = (await c.req.json()) as Record<string, unknown>; } catch { return ok(c, {}); }
  const id = Number(body.id) || 0;
  const sec = Math.max(0, Math.min(86400, Math.round(Number(body.seconds) || 0)));
  if (id > 0 && sec > 0) {
    try {
      await c.env.DB.prepare(`UPDATE analytics_pv SET duration = ? WHERE id = ? AND duration = 0`).bind(sec, id).run();
    } catch { /* 忽略 */ }
  }
  return ok(c, {});
});

/* ---------------- 后台：总览（支持自定义日期范围 + 环比对比） ---------------- */
adminApp.get("/summary", requireAdmin, async c => {
  const db = c.env.DB;
  const dateParam = (c.req.query("date") || "").trim();
  // date=YYYY-MM-DD 时按单天筛选（供每日明细行展开懒加载），不计算环比
  if (dateParam) {
    const where = `date(created_at) = '${dateParam.replace(/[^0-9-]/g, "")}'`;
    const batch = await db.batch([
      db.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv FROM analytics_pv WHERE ${where}`),
      db.prepare(`SELECT path, MIN(title) AS title, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY path ORDER BY n DESC LIMIT 10`),
      db.prepare(`SELECT referrer, COUNT(*) AS n FROM analytics_pv WHERE ${where} AND referrer <> '' GROUP BY referrer ORDER BY n DESC LIMIT 10`),
      db.prepare(`SELECT country, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY country ORDER BY n DESC LIMIT 10`),
      db.prepare(`SELECT device, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY device ORDER BY n DESC`),
      db.prepare(`SELECT browser, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY browser ORDER BY n DESC LIMIT 8`),
      db.prepare(`SELECT os, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY os ORDER BY n DESC LIMIT 8`),
      db.prepare(`SELECT AVG(duration) AS avg FROM analytics_pv WHERE ${where} AND duration > 0`),
      db.prepare(`SELECT COUNT(DISTINCT referrer) AS n FROM analytics_pv WHERE ${where} AND referrer <> ''`),
      db.prepare(`SELECT COUNT(DISTINCT path) AS n FROM analytics_pv WHERE ${where} AND path <> ''`),
    ]);
    const row = batch[0].results[0] as { pv: number; uv: number };
    const avgRow = batch[7].results[0] as { avg: number | null };
    const refCount = Number((batch[8].results[0] as { n?: number } | undefined)?.n ?? 0);
    const pathCount = Number((batch[9].results[0] as { n?: number } | undefined)?.n ?? 0);
    const top = (i: number) => (batch[i].results as Array<Record<string, unknown>>).map(r => ({
      name: String(r.path ?? r.referrer ?? r.country ?? r.device ?? r.browser ?? r.os ?? "未知"),
      n: Number(r.n),
    }));
    const uv = Number(row?.uv ?? 0);
    return ok(c, {
      days: 1,
      date: dateParam,
      pv: Number(row?.pv ?? 0),
      uv,
      pvPerUv: uv ? Math.round(Number(row?.pv ?? 0) / uv * 10) / 10 : 0,
      refCount,
      pathCount,
      avgDuration: Math.round(Number(avgRow?.avg ?? 0)),
      trend: [{ date: dateParam, pv: Number(row?.pv ?? 0), uv: Number(row?.uv ?? 0) }],
      topPaths: (batch[1].results as Array<{ path: string; title: string | null; n: number }>).map(r => ({
        name: String(r.path), title: String(r.title ?? ""), n: Number(r.n),
      })),
      referrers: top(2), countries: top(3), devices: top(4), browsers: top(5), os: top(6),
    });
  }

  // 正常模式：days 或 start/end
  const range = parseRange(c);
  const { where, prevWhere } = range;

  const batch = await db.batch([
    db.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv FROM analytics_pv WHERE ${where}`),
    db.prepare(
      `SELECT date(created_at) AS d, COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv FROM analytics_pv
       WHERE ${where} GROUP BY date(created_at) ORDER BY d ASC`
    ),
    db.prepare(`SELECT path, MIN(title) AS title, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY path ORDER BY n DESC LIMIT 10`),
    db.prepare(`SELECT referrer, COUNT(*) AS n FROM analytics_pv WHERE ${where} AND referrer <> '' GROUP BY referrer ORDER BY n DESC LIMIT 10`),
    db.prepare(`SELECT country, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY country ORDER BY n DESC LIMIT 10`),
    db.prepare(`SELECT device, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY device ORDER BY n DESC`),
    db.prepare(`SELECT browser, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY browser ORDER BY n DESC LIMIT 8`),
    db.prepare(`SELECT os, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY os ORDER BY n DESC LIMIT 8`),
    db.prepare(`SELECT AVG(duration) AS avg FROM analytics_pv WHERE ${where} AND duration > 0`),
    db.prepare(`SELECT COUNT(DISTINCT referrer) AS n FROM analytics_pv WHERE ${where} AND referrer <> ''`),
    db.prepare(`SELECT COUNT(DISTINCT path) AS n FROM analytics_pv WHERE ${where} AND path <> ''`),
    // 环比：上期 PV/UV/平均停留
    db.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv FROM analytics_pv WHERE ${prevWhere}`),
    db.prepare(`SELECT AVG(duration) AS avg FROM analytics_pv WHERE ${prevWhere} AND duration > 0`),
    db.prepare(`SELECT COUNT(DISTINCT referrer) AS n FROM analytics_pv WHERE ${prevWhere} AND referrer <> ''`),
    db.prepare(`SELECT COUNT(DISTINCT path) AS n FROM analytics_pv WHERE ${prevWhere} AND path <> ''`),
  ]);
  const row = batch[0].results[0] as { pv: number; uv: number };
  const avgRow = batch[8].results[0] as { avg: number | null };
  const refCount = Number((batch[9].results[0] as { n?: number } | undefined)?.n ?? 0);
  const pathCount = Number((batch[10].results[0] as { n?: number } | undefined)?.n ?? 0);
  const prevRow = batch[11].results[0] as { pv: number; uv: number };
  const prevAvgRow = batch[12].results[0] as { avg: number | null };
  const prevRefCount = Number((batch[13].results[0] as { n?: number } | undefined)?.n ?? 0);
  const prevPathCount = Number((batch[14].results[0] as { n?: number } | undefined)?.n ?? 0);

  const days = range.days;
  // 补齐趋势日期
  const trendMap = new Map<string, { pv: number; uv: number }>();
  for (const r of batch[1].results as Array<{ d: string; pv: number; uv: number }>) {
    trendMap.set(r.d, { pv: Number(r.pv), uv: Number(r.uv) });
  }
  const trend: Array<{ date: string; pv: number; uv: number }> = [];
  const dateList = range.start && range.end
    ? buildDateList(range.start, range.end) // 自定义范围：从 start 到 end
    : Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10));
  for (const d of dateList) {
    trend.push({ date: d, ...(trendMap.get(d) ?? { pv: 0, uv: 0 }) });
  }

  const top = (i: number) => (batch[i].results as Array<Record<string, unknown>>).map(r => ({
    name: String(r.path ?? r.referrer ?? r.country ?? r.device ?? r.browser ?? r.os ?? "未知"),
    n: Number(r.n),
  }));
  const uv = Number(row?.uv ?? 0);
  const prevUv = Number(prevRow?.uv ?? 0);

  return ok(c, {
    days,
    start: range.start || undefined,
    end: range.end || undefined,
    pv: Number(row?.pv ?? 0),
    uv,
    pvPerUv: uv ? Math.round(Number(row?.pv ?? 0) / uv * 10) / 10 : 0,
    refCount,
    pathCount,
    avgDuration: Math.round(Number(avgRow?.avg ?? 0)),
    prevPv: Number(prevRow?.pv ?? 0),
    prevUv,
    prevPvPerUv: prevUv ? Math.round(Number(prevRow?.pv ?? 0) / prevUv * 10) / 10 : 0,
    prevRefCount,
    prevPathCount,
    prevAvgDuration: Math.round(Number(prevAvgRow?.avg ?? 0)),
    trend,
    topPaths: (batch[2].results as Array<{ path: string; title: string | null; n: number }>).map(r => ({
      name: String(r.path),
      title: String(r.title ?? ""),
      n: Number(r.n),
    })),
    referrers: top(3),
    countries: top(4),
    devices: top(5),
    browsers: top(6),
    os: top(7),
  });
});

/* ---------------- 后台：每日明细（支持自定义日期范围） ---------------- */
adminApp.get("/daily", requireAdmin, async c => {
  const db = c.env.DB;
  const range = parseRange(c);
  const { where, days } = range;

  const batch = await db.batch([
    // 主聚合：按天 PV/UV/停留/设备
    db.prepare(
      `SELECT date(created_at) AS d, COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv,
              ROUND(AVG(CASE WHEN duration > 0 THEN duration END), 1) AS avg_dur,
              COUNT(CASE WHEN device = 'mobile' THEN 1 END) AS mobile,
              COUNT(CASE WHEN device = 'desktop' THEN 1 END) AS desktop,
              COUNT(CASE WHEN device = 'tablet' THEN 1 END) AS tablet,
              COUNT(DISTINCT referrer) AS ref_count
       FROM analytics_pv WHERE ${where}
       GROUP BY date(created_at) ORDER BY d DESC`
    ),
    // 每天热门页面（用 ROW_NUMBER 窗口函数取每天 Top1）
    db.prepare(
      `SELECT d, path, title FROM (
         SELECT date(created_at) AS d, path, MIN(title) AS title, COUNT(*) AS n,
                ROW_NUMBER() OVER (PARTITION BY date(created_at) ORDER BY COUNT(*) DESC) AS rn
         FROM analytics_pv WHERE ${where} AND path IS NOT NULL
         GROUP BY date(created_at), path
       ) WHERE rn = 1`
    ),
    // 区间汇总：总 PV / 去重 UV / 平均停留 / 移动占比
    db.prepare(
      `SELECT COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv,
              ROUND(AVG(CASE WHEN duration > 0 THEN duration END), 1) AS avg_dur,
              COUNT(CASE WHEN device = 'mobile' THEN 1 END) AS mobile,
              COUNT(DISTINCT referrer) AS ref_count
       FROM analytics_pv WHERE ${where}`
    ),
  ]);
  const sumRow = batch[2].results[0] as { pv: number; uv: number; avg_dur: number | null; mobile: number; ref_count: number } | undefined;

  const dayMap = new Map<string, { pv: number; uv: number; avg_dur: number | null; mobile: number; desktop: number; tablet: number; ref_count: number; topPath: string; topTitle: string }>();
  for (const r of batch[0].results as Array<{ d: string; pv: number; uv: number; avg_dur: number | null; mobile: number; desktop: number; tablet: number; ref_count: number }>) {
    dayMap.set(r.d, { pv: Number(r.pv), uv: Number(r.uv), avg_dur: r.avg_dur, mobile: Number(r.mobile), desktop: Number(r.desktop), tablet: Number(r.tablet), ref_count: Number(r.ref_count), topPath: "", topTitle: "" });
  }
  for (const r of batch[1].results as Array<{ d: string; path: string; title: string | null }>) {
    const day = dayMap.get(r.d);
    if (day) { day.topPath = r.path; day.topTitle = r.title || ""; }
  }

  // 补齐空白天，按日期倒序
  const dateList = range.start && range.end
    ? buildDateList(range.start, range.end).reverse()
    : Array.from({ length: days }, (_, i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const list: Array<{ date: string; pv: number; uv: number; avgDuration: number; mobile: number; desktop: number; tablet: number; refCount: number; topPath: string; topTitle: string }> = [];
  for (const d of dateList) {
    const r = dayMap.get(d);
    list.push({
      date: d,
      pv: r?.pv ?? 0,
      uv: r?.uv ?? 0,
      avgDuration: Math.round(Number(r?.avg_dur ?? 0)),
      mobile: r?.mobile ?? 0,
      desktop: r?.desktop ?? 0,
      tablet: r?.tablet ?? 0,
      refCount: r?.ref_count ?? 0,
      topPath: r?.topPath ?? "",
      topTitle: r?.topTitle ?? "",
    });
  }

  const totalPv = Number(sumRow?.pv ?? 0);
  const totalUv = Number(sumRow?.uv ?? 0);
  const activeDays = list.filter(d => d.pv > 0).length || 1;
  return ok(c, {
    days,
    start: range.start || undefined,
    end: range.end || undefined,
    list,
    summary: {
      pv: totalPv,
      uv: totalUv,
      avgPvPerDay: Math.round(totalPv / activeDays * 10) / 10,
      avgDuration: Math.round(Number(sumRow?.avg_dur ?? 0)),
      mobilePct: totalPv ? Math.round(Number(sumRow?.mobile ?? 0) / totalPv * 100) : 0,
      refCount: Number(sumRow?.ref_count ?? 0),
    },
  });
});

/* ---------------- 后台：来源分析（支持自定义日期范围） ---------------- */
adminApp.get("/sources", requireAdmin, async c => {
  const db = c.env.DB;
  const range = parseRange(c);
  const { where, days } = range;

  // 来源分类：搜索引擎 / 社交媒体 / 直接访问 / 外链
  const classify = (ref: string) => {
    if (!ref) return "direct";
    const h = ref.toLowerCase();
    if (/baidu\.|google\.|bing\.|sogou\.|so\.com|yandex\.|duckduckgo\.|sm\.cn|haosou\.|360\.cn/i.test(h)) return "search";
    if (/weibo\.|zhihu\.|qq\.com|mp\.weixin\.|xiaohongshu\.|bilibili\.|douyin\.|tiktok\.|twitter\.|x\.com|facebook\.|instagram\.|linkedin\.|pinterest\.|reddit\./i.test(h)) return "social";
    if (/jxe\.me|ymao\.me/.test(h)) return "internal";
    return "external";
  };
  const TYPE_LABELS: Record<string, string> = { search: "搜索引擎", social: "社交媒体", direct: "直接访问", external: "外链", internal: "站内" };

  const batch = await db.batch([
    // 总量按来源类型分类
    db.prepare(
      `SELECT referrer, COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv,
              ROUND(AVG(CASE WHEN duration > 0 THEN duration END), 1) AS avg_dur
       FROM analytics_pv WHERE ${where}
       GROUP BY referrer ORDER BY pv DESC LIMIT 50`
    ),
    // 按天 + 来源类型趋势（用 CASE 在 SQL 里分类）
    db.prepare(
      `SELECT date(created_at) AS d, referrer, COUNT(*) AS n
       FROM analytics_pv WHERE ${where}
       GROUP BY date(created_at), referrer ORDER BY d ASC`
    ),
  ]);

  // 聚合来源类型
  const typeMap: Record<string, { pv: number; uv: Set<string>; avgDur: number[] }> = {};
  const refList: Array<{ name: string; type: string; pv: number; uv: number; avgDur: number }> = [];
  for (const r of batch[0].results as Array<{ referrer: string; pv: number; uv: number; avg_dur: number | null }>) {
    const type = classify(r.referrer);
    if (!typeMap[type]) typeMap[type] = { pv: 0, uv: new Set(), avgDur: [] };
    typeMap[type].pv += Number(r.pv);
    for (let i = 0; i < Number(r.uv); i++) typeMap[type].uv.add(`${type}-${i}`); // 近似：UV 按来源合并无法精确，改用 PV 比例展示
    if (r.avg_dur) typeMap[type].avgDur.push(Number(r.avg_dur));
    const host = (() => { try { return r.referrer ? new URL(r.referrer).host : "直接访问" } catch { return r.referrer || "直接访问" } })();
    refList.push({ name: host, type, pv: Number(r.pv), uv: Number(r.uv), avgDur: Number(r.avg_dur || 0) });
  }

  const totalPv = refList.reduce((s, r) => s + r.pv, 0);
  const types = Object.entries(typeMap).map(([k, v]) => ({
    key: k,
    label: TYPE_LABELS[k] || k,
    pv: v.pv,
    pct: totalPv ? Math.round(v.pv / totalPv * 1000) / 10 : 0,
    avgDur: v.avgDur.length ? Math.round(v.avgDur.reduce((a, b) => a + b, 0) / v.avgDur.length) : 0,
  })).sort((a, b) => b.pv - a.pv);

  // 按天趋势
  const trendMap = new Map<string, Record<string, number>>();
  for (const r of batch[1].results as Array<{ d: string; referrer: string; n: number }>) {
    const type = classify(r.referrer);
    if (!trendMap.has(r.d)) trendMap.set(r.d, {});
    const day = trendMap.get(r.d)!;
    day[type] = (day[type] || 0) + Number(r.n);
  }
  const trend: Array<Record<string, number | string>> = [];
  const dateList = range.start && range.end
    ? buildDateList(range.start, range.end)
    : Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10));
  for (const d of dateList) {
    trend.push({ date: d, ...(trendMap.get(d) ?? {}) });
  }

  return ok(c, { days, start: range.start || undefined, end: range.end || undefined, types, trend, referrers: refList, totalPv });
});

/* ---------------- 后台：文章统计列表（支持自定义日期范围） ---------------- */
adminApp.get("/posts", requireAdmin, async c => {
  const db = c.env.DB;
  const range = parseRange(c);
  const { where, days } = range;
  const [pvRows, postRows, sumRows] = await db.batch([
    db.prepare(
      `SELECT path, MIN(title) AS title, COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv,
              ROUND(AVG(CASE WHEN duration > 0 THEN duration END), 1) AS avg_dur,
              MAX(created_at) AS last_visit
       FROM analytics_pv WHERE ${where} AND path LIKE '/post/%'
       GROUP BY path ORDER BY pv DESC LIMIT 100`
    ),
    db.prepare(`SELECT slug, title FROM posts`),
    // 文章区汇总：总 PV / 去重 UV
    db.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv FROM analytics_pv WHERE ${where} AND path LIKE '/post/%'`),
  ]);
  const sumRow = sumRows.results[0] as { pv: number; uv: number } | undefined;
  // path 存的是 URL 编码的 slug，posts.slug 存的是原文，用 encodeURIComponent 匹配
  const titleMap: Record<string, string> = {};
  for (const p of (postRows.results || []) as Array<{ slug: string; title: string }>) {
    titleMap["/post/" + encodeURIComponent(p.slug)] = p.title;
  }
  const posts = ((pvRows.results || []) as Array<{ path: string; title: string | null; pv: number; uv: number; avg_dur: number | null; last_visit: string }>)
    .map(r => ({ ...r, title: titleMap[r.path] || r.title || r.path }))
    .filter(r => titleMap[r.path]); // 只显示 posts 表中仍存在的文章
  const totalPv = Number(sumRow?.pv ?? 0);
  const totalUv = Number(sumRow?.uv ?? 0);
  return ok(c, {
    days,
    start: range.start || undefined,
    end: range.end || undefined,
    posts,
    summary: {
      postCount: posts.length,
      pv: totalPv,
      uv: totalUv,
      avgPvPerPost: posts.length ? Math.round(totalPv / posts.length * 10) / 10 : 0,
    },
  });
});

/* ---------------- 后台：单篇文章统计详情（支持自定义日期范围） ---------------- */
adminApp.get("/post", requireAdmin, async c => {
  const db = c.env.DB;
  const path = (c.req.query("path") || "").slice(0, 300);
  if (!path) return ok(c, { error: "缺少 path 参数" });
  const range = parseRange(c);
  const { where: rangeWhere, days } = range;
  const where = `${rangeWhere} AND path = ?`;

  const batch = await db.batch([
    db.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv, ROUND(AVG(CASE WHEN duration > 0 THEN duration END),1) AS avg_dur FROM analytics_pv WHERE ${where}`).bind(path),
    db.prepare(`SELECT referrer, COUNT(*) AS n FROM analytics_pv WHERE ${where} AND referrer <> '' GROUP BY referrer ORDER BY n DESC LIMIT 8`).bind(path),
    db.prepare(`SELECT country, region, city, COUNT(*) AS n FROM analytics_pv WHERE ${where} GROUP BY country, region, city ORDER BY n DESC LIMIT 8`).bind(path),
    db.prepare(
      `SELECT id, created_at, country, region, city, isp, ip, device, browser, os, sid, duration, referrer
       FROM analytics_pv WHERE ${where} ORDER BY created_at DESC LIMIT 200`
    ).bind(path),
  ]);

  const summary = batch[0].results[0] as { pv: number; uv: number; avg_dur: number | null };
  const referrers = (batch[1].results as Array<{ referrer: string; n: number }>).map(r => ({ name: r.referrer, n: r.n }));
  const regions = (batch[2].results as Array<{ country: string; region: string; city: string; n: number }>).map(r => ({
    name: [r.country, r.region, r.city].filter(Boolean).join(" · ") || "未知", n: r.n,
  }));
  const visitors = (batch[3].results as Array<{
    id: number; created_at: string; country: string; region: string; city: string; isp: string;
    ip: string; device: string; browser: string; os: string; sid: string; duration: number; referrer: string;
  }>).map(r => ({
    at: r.created_at, ip: r.ip, loc: [r.country, r.region, r.city].filter(Boolean).join(" · ") || "未知",
    isp: r.isp, device: r.device, browser: r.browser, os: r.os, dur: r.duration || 0,
    from: r.referrer || "", sid: r.sid,
  }));

  return ok(c, { path, days, start: range.start || undefined, end: range.end || undefined, pv: Number(summary?.pv ?? 0), uv: Number(summary?.uv ?? 0), avgDuration: Math.round(Number(summary?.avg_dur ?? 0)), referrers, regions, visitors });
});

/* ---------------- 后台：最近访客（按会话聚合） ---------------- */
adminApp.get("/visitors", requireAdmin, async c => {
  const db = c.env.DB;
  const limit = Math.max(1, Math.min(100, Number(c.req.query("limit")) || 50));
  const rows = await db
    .prepare(
      `SELECT id, created_at, path, title, country, region, city, isp, ip, device, browser, os, sid, duration
       FROM analytics_pv ORDER BY created_at DESC, id DESC LIMIT 800`
    )
    .all<{
      id: number; created_at: string; path: string; title: string; country: string; region: string;
      city: string; isp: string; ip: string; device: string; browser: string; os: string; sid: string; duration: number;
    }>();

  const map = new Map<string, any>();
  for (const r of rows.results ?? []) {
    const sid = r.sid || `ip:${r.ip}`;
    let sess = map.get(sid);
    if (!sess) {
      sess = { sid, first: r.created_at, last: r.created_at, ip: r.ip, country: r.country, region: r.region, city: r.city, isp: r.isp, device: r.device, browser: r.browser, os: r.os, pages: [], duration: 0 };
      map.set(sid, sess);
    }
    sess.last = r.created_at;
    sess.duration += Number(r.duration) || 0;
    sess.pages.push({ path: r.path, title: r.title, at: r.created_at, dur: Number(r.duration) || 0 });
  }
  const list = [...map.values()]
    .sort((a, b) => (a.last < b.last ? 1 : -1))
    .slice(0, limit)
    .map(s => ({ ...s, pages: s.pages.reverse() })); // 最近页在前
  return ok(c, { list });
});

export { publicApp as analyticsPublicRoutes, adminApp as analyticsAdminRoutes };
export default publicApp;
