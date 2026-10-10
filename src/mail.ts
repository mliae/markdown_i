/**
 * 邮件发送（Resend API）+ 评论通知模板
 * - Resend：POST https://api.resend.com/emails，Authorization: Bearer <apiKey>
 * - 免费额度 3000 封/月，适合个人博客评论通知；Key 在后台「评论」Tab 配置
 * - 发送失败静默返回 false，绝不影响评论主流程
 */

export async function sendMail(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const { apiKey, from, to, subject, html } = opts;
  if (!apiKey || !from || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 通用中文邮件 HTML 外壳 */
function mailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f3f1ea">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border:1px solid #e6e2d6;border-radius:12px;overflow:hidden">
      <div style="background:#6b8e6f;color:#fff;padding:14px 20px;font-size:15px;font-weight:700">${title}</div>
      <div style="padding:20px;color:#3f4a40;font-size:14px;line-height:1.7">${bodyHtml}</div>
      <div style="padding:12px 20px;border-top:1px solid #eee;color:#9a9f94;font-size:12px">本邮件由 jxe.me 自动发送，请勿直接回复。</div>
    </div>
  </div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 管理员新评论通知 */
export function newCommentAdminHtml(opts: {
  site: string;
  nickname: string;
  content: string;
  targetTypeLabel: string; // 「说说」或「文章」
  targetLabel: string; // 文章标题 / 说说摘要
  url: string;
}): string {
  const { site, nickname, content, targetTypeLabel, targetLabel, url } = opts;
  return mailShell(
    `💬 新评论通知 · ${site}`,
    `<p>「${escHtml(nickname)}」在您的${escHtml(targetTypeLabel)}下发表了新评论：</p>
     <div style="background:#f6f5f0;border-left:3px solid #6b8e6f;border-radius:6px;padding:10px 14px;margin:10px 0;color:#3f4a40">${escHtml(content)}</div>
     <p style="font-size:13px;color:#888">${escHtml(targetTypeLabel)}：${escHtml(targetLabel)}</p>
     <p style="margin-top:18px"><a href="${escHtml(url)}" style="background:#6b8e6f;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px">前往查看</a></p>`
  );
}

/** 评论被回复通知（订阅者） */
export function replyNotifyHtml(opts: {
  site: string;
  replyNickname: string;
  replyContent: string;
  url: string;
}): string {
  const { site, replyNickname, replyContent, url } = opts;
  return mailShell(
    `📩 你的评论收到回复 · ${site}`,
    `<p>您订阅的评论收到了新回复：</p>
     <div style="background:#f6f5f0;border-left:3px solid #6b8e6f;border-radius:6px;padding:10px 14px;margin:10px 0;color:#3f4a40">
       <b>${escHtml(replyNickname)}</b>：${escHtml(replyContent)}
     </div>
     <p style="margin-top:18px"><a href="${escHtml(url)}" style="background:#6b8e6f;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px">查看回复</a></p>`
  );
}

/**
 * 评论创建后的邮件通知编排（异步执行，失败静默）：
 * 1. 新评论通知管理员（mail_notify_admin && mail_admin_to）
 * 2. 若评论者订阅且该评论是楼中楼回复，通知被回复的根评论者（mail_reply_notify）
 */
export interface CommentMailConfig {
  enabled: boolean;
  apiKey: string;
  from: string;
  adminTo: string;
  notifyAdmin: boolean;
  replyNotify: boolean;
}

export interface CommentNotifyOpts {
  mail: CommentMailConfig;
  notifySettings?: import("./security").NotifySettings; // Webhook 通知配置（含地址 + 分类开关）
  db: D1Database;
  site: string;
  comment: { id: number; nickname: string; content: string; parent_id: number; email?: string };
  targetTypeLabel: string; // 「说说」或「文章」
  targetLabel: string;
  url: string;
}

export async function handleCommentMailNotifications(opts: CommentNotifyOpts): Promise<void> {
  const { mail, notifySettings, db, site, comment, targetTypeLabel, targetLabel, url } = opts;

  // Webhook 新评论通知（走统一入口，受「新评论」开关控制）
  if (notifySettings) {
    try {
      const { notify } = await import("./security");
      const excerpt = comment.content.replace(/\n/g, " ").slice(0, 100);
      // 必须 await：本函数由 waitUntil 调用，丢弃 Promise 会导致 fetch 在上下文终止时被取消
      await notify(notifySettings, "comment", `💬 新评论 · ${comment.nickname}`, `${targetTypeLabel}「${targetLabel}」\n${excerpt}\n${url}`);
    } catch { /* 通知失败不影响主流程 */ }
  }

  if (!mail.enabled || !mail.apiKey || !mail.from) return;

  // 1. 管理员新评论通知
  if (mail.notifyAdmin && mail.adminTo && comment.email !== mail.adminTo) {
    await sendMail({
      apiKey: mail.apiKey,
      from: mail.from,
      to: mail.adminTo,
      subject: `新评论 · ${comment.nickname}`,
      html: newCommentAdminHtml({ site, nickname: comment.nickname, content: comment.content, targetTypeLabel, targetLabel, url }),
    });
  }

  // 2. 回复订阅通知：仅楼中楼回复（parent_id>0），且回复者不是被回复者本人
  if (mail.replyNotify && comment.parent_id > 0) {
    try {
      const root = await db
        .prepare(`SELECT nickname, email FROM comments WHERE id = ? LIMIT 1`)
        .bind(comment.parent_id)
        .first<{ nickname: string; email: string }>();
      if (root?.email && root.email !== comment.email) {
        await sendMail({
          apiKey: mail.apiKey,
          from: mail.from,
          to: root.email,
          subject: `你的评论收到新回复 · ${site}`,
          html: replyNotifyHtml({ site, replyNickname: comment.nickname, replyContent: comment.content, url }),
        });
      }
    } catch {
      // 查询失败不影响主流程
    }
  }
}