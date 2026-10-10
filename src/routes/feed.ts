/**
 * 混合时间线路由（前缀 /api/feed）
 * 公开：GET /  说说 + 已发布文章按发布时间混排（游标分页）
 */
import { Hono } from "hono";
import { ok } from "../respond";
import type { HonoEnv } from "../types";
import { queryFeed, decodeFeedCursor } from "../db";
import { getSettings } from "../settings";

const app = new Hono<HonoEnv>();

app.get("/", async c => {
  const voterId = c.req.query("voter_id");
  const limit = Number(c.req.query("limit")) || undefined;
  const q = c.req.query("q") || "";
  const cursorRaw = c.req.query("cursor") || "";
  const cursor = cursorRaw ? decodeFeedCursor(cursorRaw) : null;
  // 游标非法时当作没有更多，避免异常参数导致 500
  if (cursorRaw && !cursor) {
    return ok(c, { list: [], nextCursor: null });
  }
  const s = await getSettings(c.env.DB);
  const result = await queryFeed(c.env.DB, { cursor, limit, voterId, r2Domain: s.r2_domain, b2Domain: s.b2_domain, q });
  return ok(c, result);
});

export default app;
