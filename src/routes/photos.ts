/**
 * 相册路由
 * 公开：GET /api/photos              前台可见的图片（visible=1），按 sort_order 升序
 * 管理：GET /api/admin/photos         全部图片（含隐藏）
 *       POST /api/admin/photos        新增图片
 *       PUT /api/admin/photos/:id     更新图片（标题/描述/排序/可见）
 *       DELETE /api/admin/photos/:id  删除图片（本地 R2 对象同步删除）
 *       POST /api/admin/photos/sync   从说说(images)和文章(cover)同步图片到相册
 */
import { Hono } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import { requireAdmin } from "../auth";
import { keyToSrc, srcToKey, parseImages, mediaKeyFrom } from "../db";
import { getSettings } from "../settings";
import { deleteObject, deleteObjects } from "../storage";

const app = new Hono<HonoEnv>();

export interface PhotoRow {
  id: number;
  src: string;
  title: string;
  description: string;
  sort_order: number;
  visible: number;
  source_type: string;
  source_id: number;
  created_at: string;
  updated_at: string;
}

/** 序列化相册图片：若已配置直连域名，把站内 /media/<key> 转为 R2/B2 直连 URL；外链原样返回 */
function serializePhoto(row: PhotoRow, r2Domain?: string, b2Domain?: string) {
  const src = (() => {
    if (!r2Domain && !b2Domain) return row.src;
    const key = srcToKey(row.src);
    return key ? keyToSrc(key, r2Domain, b2Domain) : row.src;
  })();
  return {
    id: row.id,
    src,
    title: row.title ?? "",
    description: row.description ?? "",
    sort_order: Number(row.sort_order ?? 0),
    visible: Number(row.visible ?? 1) === 1,
    source_type: row.source_type ?? "upload",
    source_id: Number(row.source_id ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* ==================== 公开接口 ==================== */

app.get("/", async c => {
  const perPage = Math.min(50, Math.max(1, Number(c.req.query("per_page")) || 24));
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const s = await getSettings(c.env.DB);
  const total =
    (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM photos WHERE visible = 1`).first<{ n: number }>())?.n ?? 0;
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT id, src, title, description, sort_order, visible, source_type, source_id, created_at, updated_at
         FROM photos WHERE visible = 1 ORDER BY sort_order ASC, id DESC LIMIT ? OFFSET ?`
      )
      .bind(perPage, (page - 1) * perPage)
      .all<PhotoRow>()
  ).results;
  return ok(c, { list: rows.map(r => serializePhoto(r, s.r2_domain, s.b2_domain)), page, per_page: perPage, total });
});

/* ==================== 后台接口 ==================== */

const admin = new Hono<HonoEnv>();

admin.get("/", requireAdmin, async c => {
  const perPage = Math.min(50, Math.max(1, Number(c.req.query("per_page")) || 24));
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const s = await getSettings(c.env.DB);
  const visibleQ = c.req.query("visible");
  const visibleFilter = visibleQ === "1" ? "visible = 1" : visibleQ === "0" ? "visible = 0" : "1=1";
  const total = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM photos WHERE ${visibleFilter}`).first<{ n: number }>())?.n ?? 0;
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT id, src, title, description, sort_order, visible, source_type, source_id, created_at, updated_at
         FROM photos WHERE ${visibleFilter} ORDER BY sort_order ASC, id DESC LIMIT ? OFFSET ?`
      )
      .bind(perPage, (page - 1) * perPage)
      .all<PhotoRow>()
  ).results;
  return ok(c, { list: rows.map(r => serializePhoto(r, s.r2_domain, s.b2_domain)), page, per_page: perPage, total });
});

admin.post("/", requireAdmin, async c => {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const srcRaw = String(body.src ?? "").trim();
  if (!srcRaw) return fail(c, "图片地址不能为空", 400);
  const s = await getSettings(c.env.DB);
  // 入库归一化：本站文件（域名 URL / /media/ 路径 / key）统一转 key 存储，换域名随设置自动切换；外链 URL 保留原样
  const src = mediaKeyFrom(srcRaw, s.r2_domain, s.b2_domain) ?? (/^https?:\/\//i.test(srcRaw) ? srcRaw : null);
  if (!src) return fail(c, "图片地址非法", 400);

  const title = String(body.title ?? "").slice(0, 200);
  const description = String(body.description ?? "").slice(0, 1000);
  // sort_order 默认 0：列表按 sort_order ASC, id DESC 排序，同值时新的在前 → 最新上传的排最上；需固定位置时手动设置
  const sort_order = Number(body.sort_order) || 0;
  const visible = body.visible === false || body.visible === 0 || body.visible === "0" ? 0 : 1;
  const source_type = body.source_type === "moment" || body.source_type === "post" ? body.source_type : "upload";
  const source_id = Number(body.source_id) || 0;

  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    `INSERT INTO photos (src, title, description, sort_order, visible, source_type, source_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(src, title, description, sort_order, visible, source_type, source_id, now, now)
    .first<PhotoRow>();
  return ok(c, serializePhoto(result as PhotoRow, s.r2_domain, s.b2_domain), "已添加");
});

admin.put("/:id", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);

  const existing = await c.env.DB.prepare(`SELECT * FROM photos WHERE id = ?`).bind(id).first<PhotoRow>();
  if (!existing) return fail(c, "图片不存在", 404);

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return fail(c, "请求格式错误", 400);
  }

  // 仅允许更新以下字段，src 不可改（要改请删除重建）
  const title = body.title !== undefined ? String(body.title).slice(0, 200) : existing.title;
  const description =
    body.description !== undefined ? String(body.description).slice(0, 1000) : existing.description;
  const sort_order = body.sort_order !== undefined ? Number(body.sort_order) || 0 : existing.sort_order;
  let visible = existing.visible;
  if (body.visible !== undefined) {
    visible = body.visible === false || body.visible === 0 || body.visible === "0" ? 0 : 1;
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE photos SET title = ?, description = ?, sort_order = ?, visible = ?, updated_at = ? WHERE id = ?`
  )
    .bind(title, description, sort_order, visible, now, id)
    .run();

  const updated = await c.env.DB.prepare(`SELECT * FROM photos WHERE id = ?`).bind(id).first<PhotoRow>();
  const s = await getSettings(c.env.DB);
  return ok(c, serializePhoto(updated as PhotoRow, s.r2_domain, s.b2_domain), "已更新");
});

admin.delete("/:id", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);

  const row = await c.env.DB.prepare(`SELECT src FROM photos WHERE id = ?`).bind(id).first<{ src: string }>();
  if (!row) return fail(c, "图片不存在", 404);

  // 若为本站对象则一并删除（同步自说说/文章的图片不删原对象，避免影响原内容）
  const s = await getSettings(c.env.DB);
  const key = mediaKeyFrom(row.src, s.r2_domain, s.b2_domain);
  await c.env.DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();
  if (key) await deleteObject(c.env.R2, s, key);
  return ok(c, { id }, "已删除");
});

/** POST /batch-delete  批量删除相册图片（本站对象一并删除），body: { ids: number[] } */
admin.post("/batch-delete", requireAdmin, async c => {
  let ids: number[];
  try {
    const body = (await c.req.json()) as { ids?: unknown };
    ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 200);
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  if (!ids.length) return fail(c, "未选择任何图片", 400);

  const ph = ids.map(() => "?").join(",");
  const rows = await c.env.DB
    .prepare(`SELECT src FROM photos WHERE id IN (${ph})`)
    .bind(...ids)
    .all<{ src: string }>();
  const s = await getSettings(c.env.DB);
  const keys = [...new Set(
    rows.results
      .map(r => mediaKeyFrom(r.src, s.r2_domain, s.b2_domain))
      .filter((k): k is string => !!k)
  )];

  await c.env.DB.batch(ids.map(id => c.env.DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id)));
  await deleteObjects(c.env.R2, s, keys);

  return ok(c, { deleted: ids.length }, `已删除 ${ids.length} 张图片`);
});

/** POST /batch-toggle  批量切换显示/隐藏，body: { ids: number[], visible: 0|1 } */
admin.post("/batch-toggle", requireAdmin, async c => {
  let ids: number[];
  let visible: number;
  try {
    const body = (await c.req.json()) as { ids?: unknown; visible?: unknown };
    ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 200);
    visible = body.visible === 0 || body.visible === "0" || body.visible === false ? 0 : 1;
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  if (!ids.length) return fail(c, "未选择任何图片", 400);

  const ph = ids.map(() => "?").join(",");
  await c.env.DB.prepare(
    `UPDATE photos SET visible = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id IN (${ph})`
  )
    .bind(visible, ...ids)
    .run();

  return ok(c, { updated: ids.length, visible }, `已${visible ? "显示" : "隐藏"} ${ids.length} 张图片`);
});

/**
 * 同步：扫描 moments.images（JSON 数组）与 posts.cover，
 * 按 key 幂等去重后插入 photos 表（source_type=moment/post），
 * sort_order 统一 0（列表同值时 id 大的在前 → 最新同步的排最上），visible=1。
 * 返回新增数量。
 */
admin.post("/sync", requireAdmin, async c => {
  const s = await getSettings(c.env.DB);
  // 已有图片按 key 归一化去重：/media/ 路径、R2/B2 直连 URL 统一提取 key 再比较，
  // 避免同一对象因 src 记录形式不同（历史数据/域名配置变化）被重复同步
  const existingRows = (await c.env.DB.prepare(`SELECT src FROM photos`).all<{ src: string }>()).results;
  const existingKeys = new Set<string>();
  for (const r of existingRows) {
    existingKeys.add(mediaKeyFrom(r.src, s.r2_domain, s.b2_domain) ?? r.src);
  }

  const toInsert: { src: string; source_type: "moment" | "post"; source_id: number }[] = [];

  const moments = (
    await c.env.DB.prepare(`SELECT id, images FROM moments WHERE images != '[]' AND images != ''`).all<{
      id: number;
      images: string;
    }>()
  ).results;
  for (const m of moments) {
    for (const key of parseImages(m.images)) {
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      toInsert.push({ src: key, source_type: "moment", source_id: m.id });
    }
  }

  const posts = (
    await c.env.DB.prepare(`SELECT id, cover FROM posts WHERE cover != ''`).all<{
      id: number;
      cover: string;
    }>()
  ).results;
  for (const p of posts) {
    const coverKey = mediaKeyFrom(p.cover, s.r2_domain, s.b2_domain) ?? p.cover;
    if (existingKeys.has(coverKey)) continue;
    existingKeys.add(coverKey);
    toInsert.push({ src: coverKey, source_type: "post", source_id: p.id });
  }

  const now = new Date().toISOString();
  let inserted = 0;
  if (toInsert.length) {
    // sort_order 统一 0：列表按 sort_order ASC, id DESC 排序，同值时新的在前 → 最新同步的排最上面
    const stmt = c.env.DB.prepare(
      `INSERT INTO photos (src, title, description, sort_order, visible, source_type, source_id, created_at, updated_at)
       VALUES (?, '', '', 0, 1, ?, ?, ?, ?)`
    );
    const batch = toInsert.map(item => stmt.bind(item.src, item.source_type, item.source_id, now, now));
    await c.env.DB.batch(batch);
    inserted = toInsert.length;
  }
  return ok(c, { inserted, total: existingKeys.size }, `同步完成，新增 ${inserted} 张`);
});

export default app;
export { admin as adminPhotoRoutes };
