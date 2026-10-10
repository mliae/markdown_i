/**
 * 通用评论服务：说说（moment）与文章（post）共用一套 comments 表与校验逻辑
 * comments 表结构：target_type('moment'|'post') + target_id + parent_id(根评论 id，0=顶级)
 */
import type { CommentRow } from "./db";

export type CommentTargetType = "moment" | "post";

const MAX_NICK = 20;
const MAX_CONTENT = 500;
const QQ_RE = /^[1-9]\d{4,11}$/;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export interface ParsedCommentInput {
  nickname: string;
  content: string;
  qq: string;
  email: string;
  avatarUrl: string;
  website: string;
  parentId: number;
  images: string; // JSON 数组字符串
  notifyReply: boolean; // 评论者是否订阅「收到回复邮件通知」
}

/** 解析评论提交体（字段合法性由 validateCommentInput 校验） */
export function parseCommentBody(body: unknown): ParsedCommentInput {
  const b = (body ?? {}) as Record<string, unknown>;
  let qq = String(b.qq ?? "").trim().replace(/[^\d]/g, "").slice(0, 12);
  if (qq && !QQ_RE.test(qq)) qq = "";
  let email = String(b.email ?? "").trim().toLowerCase().slice(0, 100);
  if (email && !EMAIL_RE.test(email)) email = "";

  const rawAvatar = String(b.avatar_url ?? "").trim();
  // 头像只允许 QQ 官方头像 CDN，防止任意 URL 注入
  const avatarUrl = /^https:\/\/(q[1234]|q|thirdqq)\.qlogo\.cn\//.test(rawAvatar) ? rawAvatar.slice(0, 300) : "";

  let website = String(b.website ?? "").trim().slice(0, 200);
  if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
  if (website && !/^https?:\/\/[^\s]+$/.test(website)) website = "";

  const nickname = String(b.nickname ?? "").trim().slice(0, MAX_NICK);
  const content = String(b.content ?? "").trim().slice(0, MAX_CONTENT);

  // 解析图片 URL 列表（最多 3 张，每张限 500 字符，必须 http(s)://）
  let imgs: string[] = [];
  if (Array.isArray(b.images)) {
    imgs = (b.images as unknown[])
      .map(String)
      .map(s => s.trim())
      .filter(s => /^https?:\/\//i.test(s))
      .slice(0, 3)
      .map(s => s.slice(0, 500));
  }

  const notifyReply = b.notify_reply === true || b.notify_reply === "true" || b.notify_reply === "1";

  return {
    nickname,
    content,
    qq,
    email,
    avatarUrl,
    website,
    parentId: Number(b.parent_id ?? 0) || 0,
    images: imgs.length ? JSON.stringify(imgs) : "",
    notifyReply,
  };
}

export function validateCommentInput(input: ParsedCommentInput): string | null {
  if (!input.nickname) return "请填写昵称";
  if (!input.email) return "请填写邮箱";
  if (!input.content) return "评论内容不能为空";
  return null;
}

/** 评论目标是否存在 */
export async function targetExists(
  db: D1Database,
  type: CommentTargetType,
  id: number
): Promise<boolean> {
  const table = type === "post" ? "posts" : "moments";
  const row = await db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).bind(id).first();
  return !!row;
}

/** 列出目标下全部评论（按 id 升序，楼中楼由前端分组） */
export async function listComments(
  db: D1Database,
  type: CommentTargetType,
  targetId: number
): Promise<CommentRow[]> {
  return (
    await db
      .prepare(
        `SELECT * FROM comments WHERE target_type = ? AND target_id = ? ORDER BY id ASC`
      )
      .bind(type, targetId)
      .all<CommentRow>()
  ).results;
}

/** 插入评论（含父评论校验/归一化、频控）；返回 {error} 或 {comment} */
export async function createComment(
  db: D1Database,
  type: CommentTargetType,
  targetId: number,
  raw: ParsedCommentInput,
  owner: boolean,
  opts?: { ip?: string; rateLimit?: number; avatarUrl?: string }
): Promise<{ error: string; status?: 400 | 404 | 429 | 500 } | { comment: CommentRow }> {
  if (!(await targetExists(db, type, targetId))) {
    return { error: type === "post" ? "文章不存在" : "动态不存在", status: 404 };
  }

  // 楼中楼：校验父评论归属同一目标；回复“回复”时归一到根评论（只做两级）
  let parentId = 0;
  if (raw.parentId > 0) {
    const target = await db
      .prepare(`SELECT id, parent_id FROM comments WHERE id = ? AND target_type = ? AND target_id = ?`)
      .bind(raw.parentId, type, targetId)
      .first<{ id: number; parent_id: number }>();
    if (!target) return { error: "回复的评论不存在", status: 400 };
    parentId = target.parent_id > 0 ? target.parent_id : target.id;
  }

  // 留了 QQ 但没带邮箱时自动补 @qq.com
  const email = raw.email || (raw.qq ? `${raw.qq}@qq.com` : "");
  // 管理员可使用自己的站点头像（绕过 parseCommentBody 的 QQ 头像白名单）；普通用户仍只能用 QQ CDN 头像
  const avatarUrl = owner && opts?.avatarUrl ? opts.avatarUrl.slice(0, 300) : raw.avatarUrl;

  // 简单频控：同一昵称同样内容（含同一父评论）60 秒内禁止重复
  const dup = await db.prepare(
    `SELECT 1 FROM comments WHERE target_type = ? AND target_id = ? AND parent_id = ? AND nickname = ? AND content = ?
     AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 seconds') LIMIT 1`
  )
    .bind(type, targetId, parentId, raw.nickname, raw.content)
    .first();
  if (dup) return { error: "刚刚发过相同评论了", status: 429 };

  // 同 IP 高频评论频控：60 秒窗口内超过 rateLimit 次则拒绝（管理员不受限）
  if (opts?.ip && !owner) {
    const limit = Math.max(1, Math.min(100, opts.rateLimit ?? 5));
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const cnt = await db
      .prepare(`SELECT COUNT(*) AS n FROM comment_rate WHERE ip = ? AND created_at > ?`)
      .bind(opts.ip, windowStart)
      .first<{ n: number }>();
    if (Number(cnt?.n ?? 0) >= limit) {
      return { error: "评论过于频繁，请稍后再试", status: 429 };
    }
  }

  const commentStmt = db.prepare(
    `INSERT INTO comments (target_type, target_id, parent_id, nickname, content, is_owner, qq, email, avatar_url, website, images)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(
      type,
      targetId,
      parentId,
      raw.nickname,
      raw.content,
      owner ? 1 : 0,
      raw.qq,
      email,
      avatarUrl,
      raw.website,
      raw.images
    );
  // 评论 + 频控记录在同一个 batch 原子提交，确保下一条请求计数立即可见（管理员不计数）
  const stmts: D1PreparedStatement[] = [commentStmt];
  if (opts?.ip && !owner) {
    stmts.push(db.prepare(`INSERT INTO comment_rate (ip) VALUES (?)`).bind(opts.ip));
  }
  const batch = await db.batch(stmts);
  const inserted = batch[0].results?.[0] as CommentRow | undefined;
  if (!inserted) return { error: "评论失败", status: 500 };
  return { comment: inserted };
}

/** 删除目标下的评论整楼（根评论连带回复）；未命中返回 false */
export async function deleteCommentThread(
  db: D1Database,
  type: CommentTargetType,
  targetId: number,
  commentId: number
): Promise<boolean> {
  const info = await db.prepare(
    `DELETE FROM comments WHERE target_type = ? AND target_id = ? AND (id = ? OR parent_id = ?)`
  )
    .bind(type, targetId, commentId, commentId)
    .run();
  return !!info.meta.changes;
}

/** 按评论 id 删除（后台管理用，自动识别所属目标）；未命中返回 false */
export async function deleteCommentAnywhere(db: D1Database, commentId: number): Promise<boolean> {
  const info = await db.prepare(`DELETE FROM comments WHERE id = ? OR parent_id = ?`)
    .bind(commentId, commentId)
    .run();
  return !!info.meta.changes;
}

/** 按评论 id 编辑内容/图片（后台管理用）；仅更新传入字段；返回更新后的行或 null */
export async function editCommentAnywhere(
  db: D1Database,
  commentId: number,
  patch: { content?: string; images?: string }
): Promise<CommentRow | null> {
  const sets: string[] = [];
  const binds: (string | number)[] = [];
  if (patch.content !== undefined) {
    sets.push("content = ?");
    binds.push(patch.content.trim().slice(0, 500));
  }
  if (patch.images !== undefined) {
    sets.push("images = ?");
    binds.push(patch.images);
  }
  if (!sets.length) return null;
  binds.push(commentId);
  const row = await db
    .prepare(`UPDATE comments SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...binds)
    .first<CommentRow>();
  return row ?? null;
}
