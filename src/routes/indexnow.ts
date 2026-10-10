/**
 * IndexNow 后台路由（前缀 /api/admin/indexnow）
 * GET  /log            最近推送记录
 * POST /push           手动推送最近 N 篇已发布文章  body: { n?: number }
 * POST /push-urls      手动推送指定 URL             body: { urls: string[] }
 */
import { Hono, type Context } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import { requireAdmin } from "../auth";
import { getSettings } from "../settings";
import { pingIndexNow, getIndexNowLog } from "../indexnow";

const app = new Hono<HonoEnv>();
app.use("*", requireAdmin);

function originOf(c: Context): string {
  try {
    return new URL(c.req.url).origin;
  } catch {
    return "";
  }
}

app.get("/log", async c => {
  const list = await getIndexNowLog(c.env.DB, 50);
  return ok(c, { list });
});

app.post("/push", async c => {
  let n = 10;
  try {
    const body = await c.req.json();
    if (body && typeof (body as { n?: number }).n === "number") n = (body as { n: number }).n;
  } catch {
    /* 忽略解析失败，用默认值 */
  }
  n = Math.min(50, Math.max(1, n));
  const rows = await c.env.DB
    .prepare(`SELECT slug FROM posts WHERE status = 'published' ORDER BY created_at DESC LIMIT ?`)
    .bind(n)
    .all<{ slug: string }>();
  const relUrls = rows.results.map(r => `/post/${encodeURIComponent(r.slug)}`);
  if (!relUrls.length) return fail(c, "没有可推送的已发布文章", 400);
  const s = await getSettings(c.env.DB);
  if (!s.indexnow_key?.trim()) return fail(c, "请先在上方填写 IndexNow key 并保存", 400);
  const results = await pingIndexNow(c.env.DB, s, relUrls, originOf(c));
  const okN = results.filter(r => r.status === "ok").length;
  return ok(c, { pushed: relUrls.length, urls: relUrls, results, ok: okN, total: results.length }, `已推送 ${relUrls.length} 篇，${okN}/${results.length} 个端点成功`);
});

app.post("/push-urls", async c => {
  let urls: string[] = [];
  try {
    const body = (await c.req.json()) as { urls?: string[] };
    urls = Array.isArray(body.urls) ? body.urls.filter(u => typeof u === "string") : [];
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  if (!urls.length) return fail(c, "urls 不能为空", 400);
  const s = await getSettings(c.env.DB);
  if (!s.indexnow_key?.trim()) return fail(c, "请先填写 IndexNow key", 400);
  const results = await pingIndexNow(c.env.DB, s, urls, originOf(c));
  return ok(c, { results });
});

export default app;
