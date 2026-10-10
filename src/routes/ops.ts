/**
 * 运维增强管理路由（前缀 /api/admin/ops，全部 requireAdmin）：
 * - GET  /uptime/summary        可用性监控看板（24h 可用率 / 最近记录 / 7 天趋势）
 * - GET  /uptime/logs           最近 N 条可用性检测记录
 * - GET  /perf/summary          性能监控看板（慢请求 / 接口耗时排行 / 最近记录）
 * - GET  /backup/export         一键导出全库 JSON 备份（Content-Disposition 下载）
 * - POST /backup/restore        按表恢复：清空目标表并重新插入备份中的行（危险操作）
 * - POST /seo/extract-links     从文章/说说/友链提取外链列表
 * - POST /seo/check-links       批量检测链接可访问性（每批 ≤ 20，Workers subrequest 限制）
 *
 * 同时导出运行时可用的工具函数：
 * - runUptimeCheck(db, url, webhookUrl)  Cron 可用性检测 + 连续失败 webhook 告警
 * - recordPerf(db, method, path, ms)  性能采样写入（由性能中间件调用）
 */
import { Hono } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import { requireAdmin } from "../auth";
import { sendWebhookAlert } from "../security";

const app = new Hono<HonoEnv>();

/** 备份导出单表行数上限（防止 analytics_pv / attack_log 等大表撑爆响应） */
const BACKUP_MAX_ROWS = 10000;

/* ==================== 可用性监控看板 ==================== */

app.get("/uptime/summary", requireAdmin, async c => {
  const db = c.env.DB;
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [day24, week, recent] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status >= 200 AND status < 400 THEN 1 ELSE 0 END) AS ok,
              ROUND(AVG(latency_ms)) AS avg_latency
       FROM uptime_log WHERE created_at > ?`
    ).bind(dayAgo).first<{ total: number; ok: number; avg_latency: number | null }>(),
    db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status >= 200 AND status < 400 THEN 1 ELSE 0 END) AS ok
       FROM uptime_log WHERE created_at > ?`
    ).bind(weekAgo).first<{ total: number; ok: number }>(),
    db.prepare(
      `SELECT id, created_at, url, status, latency_ms, error FROM uptime_log ORDER BY id DESC LIMIT 30`
    ).all<{ id: number; created_at: string; url: string; status: number; latency_ms: number; error: string }>(),
  ]);

  // 近 7 天每日可用率（SQLite strftime('%Y-%m-%d') 按天分组）
  const daily = await db.prepare(
    `SELECT substr(created_at, 1, 10) AS day,
            COUNT(*) AS total,
            SUM(CASE WHEN status >= 200 AND status < 400 THEN 1 ELSE 0 END) AS ok
     FROM uptime_log WHERE created_at > ?
     GROUP BY substr(created_at, 1, 10)
     ORDER BY day ASC`
  ).bind(weekAgo).all<{ day: string; total: number; ok: number }>();

  const s = await import("../settings").then(m => m.getSettings(db));

  return ok(c, {
    interval: s.uptime_check_interval,
    day24: {
      total: Number(day24?.total ?? 0),
      ok: Number(day24?.ok ?? 0),
      rate: calcRate(day24?.ok, day24?.total),
      avgLatency: Number(day24?.avg_latency ?? 0),
    },
    week: {
      total: Number(week?.total ?? 0),
      ok: Number(week?.ok ?? 0),
      rate: calcRate(week?.ok, week?.total),
    },
    daily: (daily?.results ?? []).map(d => ({
      day: d.day,
      rate: calcRate(d.ok, d.total),
      total: Number(d.total ?? 0),
    })),
    recent: recent?.results ?? [],
  });
});

app.get("/uptime/logs", requireAdmin, async c => {
  const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
  const rows = await c.env.DB.prepare(
    `SELECT id, created_at, url, status, latency_ms, error FROM uptime_log ORDER BY id DESC LIMIT ?`
  ).bind(limit).all();
  return ok(c, { list: rows.results ?? [] });
});

/* ==================== 性能监控看板 ==================== */

app.get("/perf/summary", requireAdmin, async c => {
  const db = c.env.DB;
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [stats, slowest, topPaths, recent] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS total,
              ROUND(AVG(duration_ms)) AS avg_ms,
              ROUND(AVG(CASE WHEN duration_ms < 500 THEN duration_ms END)) AS fast_avg_ms,
              SUM(CASE WHEN duration_ms >= 500 THEN 1 ELSE 0 END) AS slow_count,
              MAX(duration_ms) AS max_ms
       FROM perf_log WHERE created_at > ?`
    ).bind(dayAgo).first<{ total: number; avg_ms: number | null; fast_avg_ms: number | null; slow_count: number; max_ms: number }>(),
    db.prepare(
      `SELECT id, created_at, method, path, duration_ms FROM perf_log ORDER BY duration_ms DESC LIMIT 20`
    ).all<{ id: number; created_at: string; method: string; path: string; duration_ms: number }>(),
    db.prepare(
      `SELECT path,
              COUNT(*) AS total,
              ROUND(AVG(duration_ms)) AS avg_ms,
              MAX(duration_ms) AS max_ms
       FROM perf_log WHERE created_at > ?
       GROUP BY path ORDER BY avg_ms DESC LIMIT 20`
    ).bind(dayAgo).all<{ path: string; total: number; avg_ms: number | null; max_ms: number }>(),
    db.prepare(
      `SELECT id, created_at, method, path, duration_ms FROM perf_log ORDER BY id DESC LIMIT 30`
    ).all<{ id: number; created_at: string; method: string; path: string; duration_ms: number }>(),
  ]);

  return ok(c, {
    stats: {
      total: Number(stats?.total ?? 0),
      avgMs: Number(stats?.avg_ms ?? 0),
      fastAvgMs: Number(stats?.fast_avg_ms ?? 0),
      slowCount: Number(stats?.slow_count ?? 0),
      maxMs: Number(stats?.max_ms ?? 0),
      slowRate: calcRate(stats?.slow_count, stats?.total),
    },
    slowest: slowest?.results ?? [],
    topPaths: (topPaths?.results ?? []).map(p => ({
      path: p.path,
      total: Number(p.total ?? 0),
      avgMs: Number(p.avg_ms ?? 0),
      maxMs: Number(p.max_ms ?? 0),
    })),
    recent: recent?.results ?? [],
  });
});

/* ==================== D1 全库备份导出 ==================== */

function calcRate(okVal: unknown, totalVal: unknown): number {
  const ok = Number(okVal ?? 0);
  const total = Number(totalVal ?? 0);
  if (!total) return 0;
  return Math.round((ok / total) * 1000) / 10;
}

/** 安全地引用表名（sqlite_master 可信，但避免意外反引号） */
function quoteTable(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

app.get("/backup/export", requireAdmin, async c => {
  const db = c.env.DB;
  const s = await import("../settings").then(m => m.getSettings(db));
  const tables = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_migrations' ORDER BY name`
  ).all<{ name: string }>();

  const payload: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    site: s.site_title,
    domain: s.site_domain || "",
    limit_per_table: BACKUP_MAX_ROWS,
    tables: {},
  };

  for (const t of tables.results ?? []) {
    const name = t.name;
    const rows = await db.prepare(
      `SELECT * FROM ${quoteTable(name)} ORDER BY rowid DESC LIMIT ?`
    ).bind(BACKUP_MAX_ROWS).all();
    (payload.tables as Record<string, unknown>)[name] = rows.results ?? [];
  }

  const json = JSON.stringify(payload, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(json, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="moments-backup-${date}.json"`,
      "cache-control": "no-store",
    },
  });
});

/** 按表恢复：清空目标表并重新插入备份中的行（危险操作，前端需二次确认） */
app.post("/backup/restore", requireAdmin, async c => {
  let body: { table?: unknown; rows?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const table = typeof body.table === "string" ? body.table.trim() : "";
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!table || !rows.length || rows.length > BACKUP_MAX_ROWS) {
    return fail(c, "请提供要恢复的表且行数为 1-10000", 400);
  }
  // 表名必须存在于用户表中（排除 sqlite_*、Cloudflare 内部表与 D1 迁移表）
  const safeTable = table.replace(/"/g, '""');
  const tbl = await c.env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_migrations' AND name = ?`
  ).bind(table).first<{ name: string }>();
  if (!tbl) return fail(c, "目标表不存在或不允许恢复", 400);

  // 从备份行提取合法列名（仅允许字母数字下划线）
  const first = rows[0] as Record<string, unknown>;
  const cols = Object.keys(first).filter(k => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k));
  if (!cols.length) return fail(c, "备份行中没有合法列", 400);
  const colSql = cols.map(k => `"${k.replace(/"/g, '""')}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");
  const insertSql = `INSERT INTO "${safeTable}" (${colSql}) VALUES (${placeholders})`;

  // 清空目标表（单独事务；恢复文件在手，失败可重试）
  await c.env.DB.prepare(`DELETE FROM "${safeTable}"`).run();

  // 分批插入（D1 batch 每批 ≤ 100 条）
  let inserted = 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const stmts = chunk.map(r => {
      const vals = cols.map(col => {
        const v = (r as Record<string, unknown>)[col];
        if (v === null || v === undefined) return null;
        if (typeof v === "object") return JSON.stringify(v);
        return v;
      });
      return c.env.DB.prepare(insertSql).bind(...vals);
    });
    const res = await c.env.DB.batch(stmts);
    inserted += res.reduce((n, r) => n + (r.meta?.changes ?? 0), 0);
  }
  return ok(c, { table, inserted }, `已恢复 ${table}：${inserted} 行`);
});

/* ==================== SEO 死链检测 ==================== */

/** 简化版 SSRF 防护：仅放行公网 http(s)，拦截内网/保留地址 */
function isInternalUrl(u: URL): boolean {
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
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

const LINK_RE = /https?:\/\/[^\s"'<>)\]]+/gi;

function extractLinksFromText(text: string, selfHosts: Set<string>): string[] {
  const out: string[] = [];
  if (!text || typeof text !== "string") return out;
  // 截断超长文本防止 CPU 超限（m3u8 清单等超长内容）
  const truncated = text.length > 30000 ? text.slice(0, 30000) : text;
  for (const m of truncated.matchAll(LINK_RE)) {
    let raw = m[0];
    // 去掉末尾常见标点
    raw = raw.replace(/[.,;:!?，。；：！？、]+$/, "");
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (isInternalUrl(u)) continue;
      if (selfHosts.has(u.hostname)) continue;
      out.push(u.href);
    } catch {
      // 忽略无法解析的
    }
  }
  return out;
}

const CHECK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** 检测单个链接；优先 HEAD，405/501 时回退 GET */
async function checkOne(url: string): Promise<{ url: string; status: number; ok: boolean; latency: number; error: string }> {
  const start = Date.now();
  const doFetch = async (method: "HEAD" | "GET") => {
    return fetch(url, {
      method,
      redirect: "follow",
      headers: {
        "User-Agent": CHECK_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
  };

  let res: Response;
  try {
    res = await doFetch("HEAD");
    if (res.status === 405 || res.status === 501) {
      await res.body?.cancel().catch(() => undefined);
      res = await doFetch("GET");
    }
    const latency = Date.now() - start;
    const ok = res.status >= 200 && res.status < 400;
    return { url, status: res.status, ok, latency, error: ok ? "" : `HTTP ${res.status}` };
  } catch (e) {
    const msg = String((e as Error | undefined)?.message || "network error").slice(0, 200);
    return { url, status: 0, ok: false, latency: Date.now() - start, error: msg };
  }
}

app.post("/seo/extract-links", requireAdmin, async c => {
  try {
    const db = c.env.DB;
    const s = await import("../settings").then(m => m.getSettings(db));

    // 站点自身域名（排除）
    const selfHosts = new Set<string>();
    const domains = [s.site_domain, s.r2_domain].filter(Boolean);
    for (const d of domains) {
      try { selfHosts.add(new URL(d).hostname.toLowerCase()); } catch { /* 忽略 */ }
    }
    const reqUrl = new URL(c.req.url);
    selfHosts.add(reqUrl.hostname.toLowerCase());
    selfHosts.add("jxe.me");

    const [posts, moments, friends] = await Promise.all([
      db.prepare(`SELECT title, content_md, excerpt FROM posts WHERE status = 'published' ORDER BY id DESC LIMIT 100`).all<{ title: string; content_md: string; excerpt: string }>(),
      db.prepare(`SELECT content FROM moments ORDER BY id DESC LIMIT 200`).all<{ content: string }>(),
      db.prepare(`SELECT name, url, description FROM friends WHERE status = 'approved' ORDER BY id DESC LIMIT 200`).all<{ name: string; url: string; description: string }>(),
    ]);

    const all: string[] = [];
    const seen = new Set<string>();
    const addLinks = (texts: (string | null | undefined)[], source: string) => {
      for (const text of texts) {
        if (!text || typeof text !== "string") continue;
        for (const link of extractLinksFromText(text, selfHosts)) {
          if (seen.has(link)) continue;
          seen.add(link);
          all.push(link);
          if (all.length >= 100) break;
        }
        if (all.length >= 100) break;
      }
      void source;
    };

    addLinks((posts.results ?? []).flatMap(p => [p.content_md, p.excerpt].filter(Boolean)), "posts");
    addLinks((moments.results ?? []).map(m => m.content), "moments");
    addLinks((friends.results ?? []).flatMap(f => [f.url, f.description].filter(Boolean)), "friends");

    return ok(c, { list: all, total: all.length });
  } catch (e) {
    return fail(c, "提取异常：" + String(e instanceof Error ? e.message : e), 500);
  }
});

app.post("/seo/check-links", requireAdmin, async c => {
  let body: { links?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const links = Array.isArray(body.links)
    ? body.links.filter((x): x is string => typeof x === "string" && /^https?:\/\//i.test(x)).slice(0, 20)
    : [];
  if (!links.length) return fail(c, "请提供要检测的链接", 400);

  const results = await Promise.all(links.map(checkOne));
  return ok(c, {
    checked: results.length,
    dead: results.filter(r => !r.ok).length,
    list: results,
  });
});

/* ==================== 运行时工具函数（供 index.ts 调用） ==================== */

/** Cron 可用性检测：Worker 无法回环请求绑定到自身的公开 URL（会 522 循环），
 *  因此改为内部健康检查——验证 D1 可读写 + Worker 运行时正常，并记录耗时。
 *  连续 3 次失败且配置了 webhook 时推送告警（同一轮故障 60 分钟内去重）。
 *  需要"外部视角"时可用 UptimeRobot 等第三方监控直接探测 /api/health。 */
export async function runUptimeCheck(db: D1Database, url: string, webhookUrl?: string): Promise<void> {
  const target = url || "";
  const start = Date.now();
  let status = 0;
  let error = "";
  try {
    const row = await db.prepare(`SELECT 1 AS ok`).first<{ ok: number }>();
    status = Number(row?.ok ?? 0) === 1 ? 200 : 503;
    if (status !== 200) error = "D1 健康检查未返回预期结果";
  } catch (e) {
    status = 503;
    error = String((e as Error | undefined)?.message || "D1 health check failed").slice(0, 200);
  }
  const latency = Date.now() - start;
  await db.prepare(
    `INSERT INTO uptime_log (url, status, latency_ms, error) VALUES (?, ?, ?, ?)`
  ).bind(target, status, latency, error).run();

  // 连续失败告警：最近 3 条均失败才触发，且同一轮故障 60 分钟内不重复推送
  if (status !== 200 && webhookUrl) {
    try {
      const recent = await db.prepare(`SELECT status FROM uptime_log ORDER BY id DESC LIMIT 3`).all<{ status: number }>();
      const failCount = (recent.results ?? []).filter(r => r.status !== 200).length;
      if (failCount >= 3) {
        const lastAlert = await db.prepare(
          `SELECT id FROM ops_notify_log WHERE type = 'uptime' AND created_at > ? LIMIT 1`
        ).bind(new Date(Date.now() - 3600_000).toISOString()).first();
        if (!lastAlert) {
          await db.prepare(
            `INSERT INTO ops_notify_log (type, message) VALUES ('uptime', ?)`
          ).bind(`站点可用性异常：连续 ${failCount} 次检测失败，最近错误：${error || `HTTP ${status}`}`).run();
          await sendWebhookAlert(
            webhookUrl,
            "⚠️ 站点可用性异常",
            `站点 ${target}\n连续 ${failCount} 次健康检查失败（最近错误：${error || `HTTP ${status}`}）\n时间：${new Date().toISOString()}`
          );
        }
      }
    } catch {
      // 告警逻辑失败不影响检测
    }
  }

  // 保留最近 3000 条，避免无限增长
  await db.prepare(
    `DELETE FROM uptime_log WHERE id NOT IN (SELECT id FROM uptime_log ORDER BY id DESC LIMIT 3000)`
  ).run().catch(() => undefined);
}

/** 性能采样写入；保留最近 5000 条 */
export async function recordPerf(
  db: D1Database,
  method: string,
  path: string,
  durationMs: number
): Promise<void> {
  await db.prepare(
    `INSERT INTO perf_log (method, path, duration_ms) VALUES (?, ?, ?)`
  ).bind(method, path, Math.round(durationMs)).run();
  // 每 200 次写入触发一次清理（概率性，减少额外 D1 调用）
  if (Math.random() < 0.005) {
    await db.prepare(
      `DELETE FROM perf_log WHERE id NOT IN (SELECT id FROM perf_log ORDER BY id DESC LIMIT 5000)`
    ).run().catch(() => undefined);
  }
}

export default app;