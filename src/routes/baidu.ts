/**
 * 百度收录推送后台路由（前缀 /api/admin/baidu）
 * POST /push  手动推送最近 N 篇已发布文章  body: { n?: number }
 */
import { Hono, type Context } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import { requireAdmin } from "../auth";
import { getSettings } from "../settings";
import { baiduPush } from "../indexnow";

const app = new Hono<HonoEnv>();
app.use("*", requireAdmin);

function originOf(c: Context): string {
  try {
    return new URL(c.req.url).origin;
  } catch {
    return "";
  }
}

app.post("/push", async c => {
  let n = 10;
  try {
    const body = await c.req.json();
    if (body && typeof (body as { n?: number }).n === "number") n = (body as { n: number }).n;
  } catch {
    /* 忽略 */
  }
  n = Math.min(50, Math.max(1, n));
  const s = await getSettings(c.env.DB);
  if (!s.baidu_push_enabled || !s.baidu_push_site?.trim() || !s.baidu_push_token?.trim()) {
    return fail(c, "请先开启百度推送并填写 site 与 token", 400);
  }
  const rows = await c.env.DB
    .prepare(`SELECT slug FROM posts WHERE status = 'published' ORDER BY created_at DESC LIMIT ?`)
    .bind(n)
    .all<{ slug: string }>();
  const relUrls = rows.results.map(r => `/post/${encodeURIComponent(r.slug)}`);
  if (!relUrls.length) return fail(c, "没有可推送的已发布文章", 400);
  const r = await baiduPush(c.env.DB, s, relUrls, originOf(c));
  return ok(c, { pushed: relUrls.length, urls: relUrls, ok: r.ok, message: r.message }, r.ok ? `百度推送成功（${r.message}）` : `百度推送失败：${r.message}`);
});

export default app;
