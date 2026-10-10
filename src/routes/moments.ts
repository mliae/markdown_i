/**
 * 动态路由（前缀 /api/moments）
 * 公开：GET /            列表（游标分页）
 *       GET /:id         详情（含评论）
 * 管理：POST /           发布
 *       DELETE /:id      删除（连带评论/点赞/R2 对象）
 * 点赞与评论在 social.ts（同前缀不同子路径）。
 */
import { Hono } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import { requireAdmin } from "../auth";
import { getSettings } from "../settings";
import { parseEmbed } from "../video-embed";
import {
  queryMoments,
  queryMomentById,
  parseImages,
  parseVideos,
  mediaKeyFrom,
  type VideoRef,
} from "../db";
import { deleteObjects } from "../storage";

const app = new Hono<HonoEnv>();

const MAX_IMAGES = 9;
const MAX_CONTENT = 5000;
const MAX_LOCATION = 100;

interface MomentInput {
  content: string;
  images: string[]; // R2 key
  videos: VideoRef[]; // src 存储为 key（本站）或 URL（外链）
  location: string;
}

/** 校验并归一化发布输入；返回错误字符串或输入对象。
 *  r2Domain/b2Domain：配置直连域名后上传返回完整 URL，需按域名提取 key。 */
function validateMomentInput(raw: unknown, r2Domain?: string, b2Domain?: string): MomentInput | string {
  const body = (raw ?? {}) as Record<string, unknown>;

  const content = String(body.content ?? "").trim().slice(0, MAX_CONTENT);
  const location = String(body.location ?? "").trim().slice(0, MAX_LOCATION);

  // 图片：仅接受本站 uploads/images key（R2）或 b2/uploads/images key（B2）
  let images: string[] = [];
  if (body.images !== undefined && body.images !== null) {
    if (!Array.isArray(body.images)) return "images 必须是数组";
    if (body.images.length > MAX_IMAGES) return `最多 ${MAX_IMAGES} 张图片`;
    for (const item of body.images) {
      const src = String(item ?? "");
      // 接受 /media/<key>、纯 key、R2/B2 直连 URL（host 匹配 r2_domain/b2_domain）
      const key = mediaKeyFrom(src, r2Domain, b2Domain);
      if (!key || (!key.startsWith("uploads/images/") && !key.startsWith("b2/uploads/images/"))) return "存在非法的图片来源";
      images.push(key);
    }
    images = [...new Set(images)];
  }

  // 视频：兼容单对象 body.video 或数组 body.videos，统一存数组（最多 9 个）
  const rawVideos: unknown[] = [];
  if (Array.isArray(body.videos)) rawVideos.push(...body.videos);
  else if (body.videos && typeof body.videos === "object") rawVideos.push(body.videos);
  if (body.video && typeof body.video === "object" && !Array.isArray(body.video)) rawVideos.push(body.video);

  const videos: VideoRef[] = [];
  for (const rv of rawVideos.slice(0, 9)) {
    const res = validateVideoObj(rv, r2Domain, b2Domain);
    if (typeof res === "string") return res;
    if (res) videos.push(res);
  }

  if (!content && images.length === 0 && videos.length === 0) return "内容不能为空";
  return { content, images, videos, location };
}

/** 校验单个视频对象 → 返回 VideoRef，或错误字符串；空对象返回 null */
function validateVideoObj(rv: unknown, r2Domain?: string, b2Domain?: string): VideoRef | string | null {
  if (!rv || typeof rv !== "object") return null;
  const v = rv as Record<string, unknown>;
  const kind = String(v.kind ?? "");
  const src = String(v.src ?? "").trim();
  if (kind !== "embed" && !src) return "视频地址不能为空";
  let poster: string | null = null;
  const posterRaw = typeof v.poster === "string" ? v.poster.trim() : "";
  if (posterRaw) {
    // 入库归一化：本站文件（域名 URL / /media/ 路径 / key）统一转 key 存储，换域名随设置自动切换；外链 URL 保留原样
    const pKey = mediaKeyFrom(posterRaw, r2Domain, b2Domain);
    if (pKey) poster = pKey;
    else if (/^https?:\/\//i.test(posterRaw)) poster = posterRaw;
    else return "封面地址非法";
  }
  if (kind === "mp4") {
    const key = mediaKeyFrom(src, r2Domain, b2Domain) ?? (/^https?:\/\//i.test(src) ? src : null);
    if (!key) return "MP4 地址非法";
    return { kind: "mp4", src: key, poster };
  }
  if (kind === "hls") {
    let u: URL;
    try {
      u = new URL(src);
    } catch {
      return "M3U8 地址非法";
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return "M3U8 仅支持 http(s) 外链";
    if (!/\.m3u8($|\?)/i.test(u.pathname + u.search)) return "M3U8 地址必须以 .m3u8 结尾";
    return { kind: "hls", src, poster };
  }
  if (kind === "embed") {
    let provider = String(v.provider ?? "");
    let vid = String(v.vid ?? "");
    if ((provider !== "bilibili" && provider !== "youtube") || !vid) {
      const parsed = parseEmbed(src || v.url || "");
      if (!parsed) return "不支持的视频平台（仅支持 B站 / YouTube）";
      provider = parsed.provider;
      vid = parsed.vid;
    }
    if (provider === "youtube" && !/^[\w-]{11}$/.test(vid)) return "YouTube 视频 ID 非法";
    if (provider === "bilibili" && !/^BV[0-9A-Za-z]{10}$/.test(vid)) return "B站视频 ID 非法（需 BV 号）";
    return { kind: "embed", src: "", provider: provider as "bilibili" | "youtube", vid, poster: null };
  }
  return "视频类型非法";
}

app.get("/", async c => {
  const voterId = c.req.query("voter_id");
  const cursor = Number(c.req.query("cursor")) || undefined;
  const limit = Number(c.req.query("limit")) || undefined;
  const s = await getSettings(c.env.DB);
  const result = await queryMoments(c.env.DB, { cursor, limit, voterId, r2Domain: s.r2_domain, b2Domain: s.b2_domain });
  return ok(c, result);
});

app.get("/:id", async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);
  const s = await getSettings(c.env.DB);
  const moment = await queryMomentById(c.env.DB, id, c.req.query("voter_id"), true, s.r2_domain, s.b2_domain);
  if (!moment) return fail(c, "动态不存在", 404);
  return ok(c, moment);
});

app.post("/", requireAdmin, async c => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const s = await getSettings(c.env.DB);
  const input = validateMomentInput(body, s.r2_domain, s.b2_domain);
  if (typeof input === "string") return fail(c, input);

  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    `INSERT INTO moments (content, images, video, location, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(input.content, JSON.stringify(input.images), JSON.stringify(input.videos), input.location, now, now)
    .first();

  const created = await queryMomentById(c.env.DB, Number((result as { id: number }).id), undefined, false, s.r2_domain, s.b2_domain);
  return ok(c, created, "发布成功");
});

app.delete("/:id", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);

  const row = await c.env.DB.prepare(`SELECT * FROM moments WHERE id = ?`).bind(id).first<{
    images: string;
    video: string;
  }>();
  if (!row) return fail(c, "动态不存在", 404);

  // 收集本站对象（图片 + 所有 mp4 视频），B2/R2 由 key 前缀自动区分
  const s = await getSettings(c.env.DB);
  const keys: string[] = [...parseImages(row.images)];
  for (const video of parseVideos(row.video)) {
    if (video.kind === "mp4") {
      const key = mediaKeyFrom(video.src, s.r2_domain, s.b2_domain);
      if (key) keys.push(key);
    }
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM comments WHERE target_type = 'moment' AND target_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM likes WHERE moment_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM moments WHERE id = ?`).bind(id),
  ]);
  await deleteObjects(c.env.R2, s, keys);

  return ok(c, { id }, "删除成功");
});

/** POST /batch-delete  批量删除说说（连带评论/点赞/媒体对象），body: { ids: number[] } */
app.post("/batch-delete", requireAdmin, async c => {
  let ids: number[];
  try {
    const body = (await c.req.json()) as { ids?: unknown };
    ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 200);
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  if (!ids.length) return fail(c, "未选择任何说说", 400);

  const ph = ids.map(() => "?").join(",");
  const rows = await c.env.DB
    .prepare(`SELECT images, video FROM moments WHERE id IN (${ph})`)
    .bind(...ids)
    .all<{ images: string; video: string }>();

  const s = await getSettings(c.env.DB);
  const keys = new Set<string>();
  for (const r of rows.results) {
    for (const k of parseImages(r.images)) {
      if (k.startsWith("uploads/") || k.startsWith("b2/uploads/")) keys.add(k);
    }
    for (const v of parseVideos(r.video)) {
      if (v.kind === "mp4") {
        const k = mediaKeyFrom(v.src, s.r2_domain, s.b2_domain);
        if (k) keys.add(k);
      }
    }
  }

  await c.env.DB.batch(
    ids.flatMap(id => [
      c.env.DB.prepare(`DELETE FROM comments WHERE target_type = 'moment' AND target_id = ?`).bind(id),
      c.env.DB.prepare(`DELETE FROM likes WHERE moment_id = ?`).bind(id),
      c.env.DB.prepare(`DELETE FROM moments WHERE id = ?`).bind(id),
    ])
  );
  await deleteObjects(c.env.R2, s, [...keys]);

  return ok(c, { deleted: rows.results.length }, `已删除 ${rows.results.length} 条说说`);
});

/**
 * PUT /:id  编辑说说（content/images/video/location，可选字段；未传字段保留原值）
 * 注意：images/video 整体替换；旧 R2 对象不自动清理（编辑时不删旧素材，避免误删）
 */
app.put("/:id", requireAdmin, async c => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, "无效的 ID", 400);
  const existing = await c.env.DB.prepare(`SELECT * FROM moments WHERE id = ?`).bind(id).first<{
    content: string;
    images: string;
    video: string;
    location: string;
  }>();
  if (!existing) return fail(c, "动态不存在", 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, "请求格式错误", 400);
  }
  const s = await getSettings(c.env.DB);
  const input = validateMomentInput(body, s.r2_domain, s.b2_domain);
  if (typeof input === "string") return fail(c, input);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE moments SET content = ?, images = ?, video = ?, location = ?, updated_at = ? WHERE id = ?`
  )
    .bind(
      input.content,
      JSON.stringify(input.images),
      JSON.stringify(input.videos),
      input.location,
      now,
      id
    )
    .run();

  const updated = await queryMomentById(c.env.DB, id, undefined, false, s.r2_domain, s.b2_domain);
  return ok(c, updated, "已更新");
});

export default app;
