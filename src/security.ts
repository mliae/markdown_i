/**
 * 安全中心：攻击检测 / 自动封禁 / 告警通知 / 错误日志
 * - 规则库预编译正则，命中即停，静态资源由调用方跳过
 * - 封禁黑名单带 60s 内存缓存，正常访客零额外 D1 查询
 * - 告警走飞书/钉钉/企业微信兼容的 text webhook（后台配置）
 */

export interface AttackRule {
  name: string;
  label: string;
  level: "low" | "medium" | "high";
  regex: RegExp;
  /** true=命中直接返回 403；false=仅记录 */
  block: boolean;
  /** true=匹配 User-Agent；false=匹配 path+query */
  ua?: boolean;
}

/** 预编译规则库（按顺序匹配，命中即停） */
export const ATTACK_RULES: AttackRule[] = [
  {
    name: "php_backdoor",
    label: "PHP 后门探测",
    level: "high",
    block: true,
    regex:
      /(^|\/)([a-z0-9_%.-]*\.(?:php|phtml|php3|php5|php7|asp|aspx|jsp|jspx|cgi|pl|py|sh))($|\?|#)/i,
  },
  {
    name: "path_scan",
    label: "路径扫描",
    level: "high",
    block: true,
    regex:
      /(^|\/)(\.env|\.git|\.svn|\.DS_Store|\.htaccess|wp-admin|wp-login|xmlrpc\.php|config\.(php|ini|json|yml|yaml)|web\.config|backup|database|db\.sql|\.sql|\.bak|\.old|\.swp|adminer|phpmyadmin|pma|shell|webshell|cmd\.php|eval\.php|system\.php|1\.php|a\.php)(\/|$|\?|#)/i,
  },
  {
    name: "sqli",
    label: "SQL 注入",
    level: "high",
    block: true,
    regex:
      /(\bunion\b.{0,20}\bselect\b|(%27|')\s*(or|and)\s*(%27|'|"|\d)|sleep\s*\(\s*\d|benchmark\s*\(|information_schema|concat\s*\(|0x[0-9a-f]{8,}|%20or%201%3D1|'or'1'='1)/i,
  },
  {
    name: "xss",
    label: "XSS 攻击",
    level: "high",
    block: true,
    regex:
      /(<script|javascript:|vbscript:|onerror\s*=|onload\s*=|onclick\s*=|alert\s*\(|confirm\s*\(|prompt\s*\(|%3cscript|%3c\/script|%3e)/i,
  },
  {
    name: "admin_probe",
    label: "后台路径探测",
    level: "medium",
    block: false,
    regex:
      /(^|\/)(admin|manage|manager|administrator|login|signin|sign-in|wp-admin|user|member|backend|dashboard|cpanel|webmail)(\.php)?(\/|$|\?|#)/i,
  },
  {
    name: "bad_ua",
    label: "攻击工具 UA",
    level: "medium",
    block: false,
    ua: true,
    regex:
      /(sqlmap|nikto|nmap|masscan|hydra|acunetix|nessus|openvas|wpscan|joomscan|python-requests|libwww-perl|scrapy|zgrab|fuzz|gobuster|dirbuster|dirb|wfuzz|whatweb|theHarvester)/i,
  },
];

export interface AttackHit {
  rule: string;
  label: string;
  level: string;
  block: boolean;
}

/** 检测一次请求是否命中攻击规则；返回第一个命中的规则，无命中返回 null */
export function detectAttack(path: string, search: string, ua: string): AttackHit | null {
  const target = path + (search ? "?" + search : "");
  for (const r of ATTACK_RULES) {
    if (r.ua) {
      if (ua && r.regex.test(ua)) {
        return { rule: r.name, label: r.label, level: r.level, block: r.block };
      }
    } else {
      // 后台 API（/api/admin/*）是合法接口，不命中「后台路径探测」规则，但高危规则照常检测
      if (r.name === "admin_probe" && path.startsWith("/api/")) continue;
      if (r.regex.test(target)) {
        return { rule: r.name, label: r.label, level: r.level, block: r.block };
      }
    }
  }
  return null;
}

/* ==================== 封禁管理 ==================== */

const BLOCK_CACHE_TTL = 60_000; // 黑名单内存缓存 60s
let blockCache: { at: number; map: Map<string, string> } | null = null; // ip -> expires_at(ISO)

function refreshBlockCache(): void {
  blockCache = null;
}

/** 判断 IP 是否在封禁中（带 60s 缓存，正常请求零 D1 查询） */
export async function isBlocked(db: D1Database, ip: string): Promise<boolean> {
  if (!ip) return false;
  const now = Date.now();
  if (!blockCache || now - blockCache.at > BLOCK_CACHE_TTL) {
    const rows = await db
      .prepare(`SELECT ip, expires_at FROM blocked_ips WHERE expires_at > ?`)
      .bind(new Date(now).toISOString())
      .all<{ ip: string; expires_at: string }>();
    blockCache = {
      at: now,
      map: new Map((rows.results ?? []).map(r => [r.ip, r.expires_at])),
    };
  }
  const exp = blockCache.map.get(ip);
  return !!exp && new Date(exp).getTime() > now;
}

/** 封禁 IP（已存在则续期并更新原因）；同时使缓存失效 */
export async function banIp(
  db: D1Database,
  ip: string,
  opts: { reason: string; rule?: string; level?: string; durationHours: number }
): Promise<void> {
  if (!ip) return;
  const now = new Date();
  const expires = new Date(now.getTime() + opts.durationHours * 3600_000);
  await db
    .prepare(
      `INSERT INTO blocked_ips (ip, reason, rule, level, blocked_at, expires_at, note)
       VALUES (?, ?, ?, ?, ?, ?, '')
       ON CONFLICT(ip) DO UPDATE SET
         reason = excluded.reason,
         rule = excluded.rule,
         level = excluded.level,
         expires_at = excluded.expires_at`
    )
    .bind(ip, opts.reason.slice(0, 300), opts.rule || "", opts.level || "high", now.toISOString(), expires.toISOString())
    .run();
  refreshBlockCache();
}

/** 解封 IP */
export async function unbanIp(db: D1Database, ip: string): Promise<void> {
  await db.prepare(`DELETE FROM blocked_ips WHERE ip = ?`).bind(ip).run();
  refreshBlockCache();
}

/* ==================== 攻击日志 + 自动封禁 ==================== */

/**
 * 记录一次攻击。若为高危且启用自动封禁，统计最近 10 分钟同 IP 高危命中数，
 * 达到阈值则自动封禁（返回 true）。写入与封禁均异步执行，不阻塞响应。
 */
export async function recordAttack(
  db: D1Database,
  webhookUrl: string,
  hit: AttackHit,
  info: { ip: string; path: string; method: string; ua: string; country?: string },
  opts: { autoBan: boolean; threshold: number; durationHours: number }
): Promise<boolean> {
  let banned = false;
  try {
    const country = info.country || "";
    await db
      .prepare(
        `INSERT INTO attack_log (ip, path, method, ua, rule, level, blocked, country)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
      )
      .bind(info.ip, info.path.slice(0, 500), info.method.slice(0, 10), (info.ua || "").slice(0, 200), hit.rule, hit.level, country)
      .run();

    if (hit.level === "high" && opts.autoBan && info.ip) {
      const since = new Date(Date.now() - 10 * 60_000).toISOString();
      const cnt = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM attack_log WHERE ip = ? AND level = 'high' AND created_at > ?`
        )
        .bind(info.ip, since)
        .first<{ n: number }>();
      if (Number(cnt?.n ?? 0) >= opts.threshold) {
        const already = await isBlocked(db, info.ip);
        if (!already) {
          await banIp(db, info.ip, {
            reason: `10 分钟内命中 ${cnt?.n} 次高危规则（${hit.label}）`,
            rule: hit.rule,
            level: hit.level,
            durationHours: opts.durationHours,
          });
          banned = true;
          // 触发封禁时推送告警（必须 await：recordAttack 由 waitUntil 调用，丢弃 Promise 会导致 fetch 被取消）
          if (webhookUrl) {
            await sendWebhookAlert(
              webhookUrl,
              "🚨 自动封禁",
              `IP ${info.ip}${country ? `（${country}）` : ""} 因 ${hit.label} 被自动封禁 ${opts.durationHours} 小时`
            );
          }
        }
      }
    }
  } catch {
    // 安全模块自身失败不能影响主请求
  }
  return banned;
}

/* ==================== 告警通知 ==================== */

/** 通知事件分类（对应后台三个推送开关） */
export type NotifyCategory = "security" | "comment" | "system";

export interface NotifySettings {
  security_webhook_url: string;
  notify_security: boolean;
  notify_comment: boolean;
  notify_system: boolean;
}

/**
 * 全站统一 Webhook 通知入口：地址为空或对应分类开关关闭时静默跳过。
 * 所有业务事件（安全/评论/系统）都应走这里，不要直接调 sendWebhookAlert。
 */
export async function notify(
  s: NotifySettings,
  category: NotifyCategory,
  title: string,
  text: string
): Promise<void> {
  const url = s.security_webhook_url;
  if (!url) return;
  if (category === "security" && !s.notify_security) return;
  if (category === "comment" && !s.notify_comment) return;
  if (category === "system" && !s.notify_system) return;
  await sendWebhookAlert(url, title, text);
}

/** 发送 text 类型 webhook 告警：自动适配飞书 / 钉钉 / 企业微信 / 通用 JSON */
export async function sendWebhookAlert(webhookUrl: string, title: string, text: string): Promise<void> {
  if (!webhookUrl) return;
  try {
    const content = `${title}\n${text}`;
    let payload: unknown;
    if (webhookUrl.includes("qyapi.weixin.qq.com")) {
      // 企业微信：{ msgtype:"text", text:{ content } }
      payload = { msgtype: "text", text: { content } };
    } else if (webhookUrl.includes("oapi.dingtalk.com")) {
      // 钉钉：{ msgtype:"text", text:{ content } }
      payload = { msgtype: "text", text: { content } };
    } else {
      // 飞书 / 通用：{ msg_type:"text", content:{ text } }
      payload = { msg_type: "text", content: { text: content } };
    }
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // 告警失败不影响主流程
  }
}

/* ==================== 错误日志 ==================== */

export async function recordError(
  db: D1Database,
  info: { method: string; path: string; message: string; stack?: string }
): Promise<void> {
  try {
    await db
      .prepare(`INSERT INTO error_log (method, path, message, stack) VALUES (?, ?, ?, ?)`)
      .bind(info.method.slice(0, 10), info.path.slice(0, 500), (info.message || "").slice(0, 1000), (info.stack || "").slice(0, 4000))
      .run();
  } catch {
    // 忽略
  }
}