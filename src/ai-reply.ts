/**
 * 评论 @AI 机器人自动回复
 *
 * 用户评论内容包含「@机器人昵称」（昵称在后台 AI 设置中配置，默认「小J」）时，
 * 通过 c.executionCtx.waitUntil 异步调用 Workers AI 生成回复，作为楼中楼子评论入库，
 * 不阻塞用户评论提交；任何失败仅记录日志。
 *
 * 两级楼层结构：机器人回复挂到触发评论所在的根评论下
 * （触发评论本身是根评论 → parent_id = 该评论；是楼中楼回复 → parent_id = 其根评论）。
 */
import type { Context } from "hono";
import type { HonoEnv } from "./types";
import type { CommentRow } from "./db";
import { getSettings } from "./settings";
import { generateText, TEXT_MODEL, TEXT_MODEL_FALLBACK } from "./ai";

/** 机器人回复内容上限（与用户评论一致 500 字） */
const MAX_REPLY = 500;

export async function maybeScheduleAiReply(
  c: Context<HonoEnv>,
  opts: { type: "moment" | "post"; targetId: number; comment: CommentRow }
): Promise<void> {
  const s = await getSettings(c.env.DB);
  if (!s.ai_reply_enabled || !c.env.AI) return;

  const botName = s.ai_bot_name.trim();
  if (!botName) return;
  const mention = `@${botName}`;
  if (!opts.comment.content.includes(mention)) return;

  const { type, targetId, comment } = opts;
  const rootId = comment.parent_id || comment.id;

  // 防刷：同一根楼下机器人累计最多回复 6 次，超过则跳过，避免无限对话刷屏
  const cnt = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM comments
     WHERE target_type = ? AND target_id = ? AND parent_id = ? AND is_ai = 1`
  )
    .bind(type, targetId, rootId)
    .first<{ n: number }>();
  if (Number(cnt?.n ?? 0) >= 6) return;

  c.executionCtx.waitUntil(generateAndSave(c, { type, targetId, rootId, comment, botName }));
}

async function generateAndSave(
  c: Context<HonoEnv>,
  args: { type: "moment" | "post"; targetId: number; rootId: number; comment: CommentRow; botName: string }
): Promise<void> {
  const { type, targetId, rootId, comment, botName } = args;
  try {
    const s = await getSettings(c.env.DB);

    // 被评论对象摘要：文章取标题，说说取纯文本前 120 字
    let subject = "";
    if (type === "post") {
      const p = await c.env.DB.prepare(`SELECT title FROM posts WHERE id = ?`).bind(targetId).first<{ title: string }>();
      subject = p?.title || "";
    } else {
      const m = await c.env.DB.prepare(`SELECT content FROM moments WHERE id = ?`)
        .bind(targetId)
        .first<{ content: string }>();
      subject = (m?.content || "").replace(/\s+/g, " ").slice(0, 120);
    }

    // 去掉 @昵称 后才是真正向机器人提问的内容
    const userContent = comment.content.split(`@${botName}`).join(" ").replace(/\s+/g, " ").trim() || comment.content;
    const siteTitle = s.site_title || "本站";
    const prompt = [
      `你是轻博客「${siteTitle}」的 AI 助手「${botName}」，正在回复读者 ${comment.nickname} 的评论。`,
      subject ? `读者正在阅读的内容：${subject}` : "",
      `读者评论：${userContent}`,
      "请用友好、简洁、口语化的中文回复（不超过 200 字），可适当使用 emoji。直接输出回复内容，不要任何前缀或解释。",
    ]
      .filter(Boolean)
      .join("\n");

    const genOpts = { maxTokens: 400, temperature: 0.7, thinking: false } as const;
    let reply = "";
    try {
      reply = await generateText(c.env.AI, [{ role: "user", content: prompt }], {
        ...genOpts,
        model: s.ai_text_model.trim() || TEXT_MODEL,
      });
    } catch (e) {
      console.warn("[AI] primary model failed, fallback:", e instanceof Error ? e.message : e);
      reply = await generateText(c.env.AI, [{ role: "user", content: prompt }], {
        ...genOpts,
        model: TEXT_MODEL_FALLBACK,
      });
    }
    reply = reply.slice(0, MAX_REPLY).trim();
    if (!reply) return;

    // 头像只接受 http(s) 图片 URL；emoji 头像由前端按设置渲染，不入库
    const avatar = /^https?:\/\//i.test(s.ai_bot_avatar) ? s.ai_bot_avatar.slice(0, 300) : "";

    await c.env.DB.prepare(
      `INSERT INTO comments
         (target_type, target_id, parent_id, nickname, content, is_owner, qq, email, avatar_url, website, is_ai)
       VALUES (?, ?, ?, ?, ?, 0, '', ?, ?, '', 1)`
    )
      .bind(type, targetId, rootId, botName.slice(0, 20), reply, "ai-bot@jxe.local", avatar)
      .run();
  } catch (e) {
    console.error("[AI] bot reply failed:", e);
  }
}
