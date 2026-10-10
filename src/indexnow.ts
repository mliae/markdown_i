/**
 * IndexNow 搜索推送服务
 * 文档：https://www.indexnow.org/documentation
 * 向各搜索引擎的 IndexNow 端点 POST { host, key, keyLocation, urlList }，
 * 告知指定 URL 已更新，请求其重新抓取。需配合站点根可访问的 key 校验文件。
 */
import type { D1Database } from "@cloudflare/workers-types";
import type { SiteSettings } from "./settings";

const LOG_KEEP = 200; // 最多保留最近 200 条推送记录

/** 从站点设置/请求 origin 推导主机（带 https://，无尾斜杠） */
export function indexNowHost(settings: SiteSettings, fallbackOrigin: string): string {
  const base = (settings.site_domain || fallbackOrigin || "").trim();
  return base.replace(/\/+$/, "");
}

/** key 校验文件的绝对 URL（搜索引擎据此验证 key 归属） */
export function indexNowKeyLocation(settings: SiteSettings, fallbackOrigin: string): string {
  return `${indexNowHost(settings, fallbackOrigin)}/indexnow-key.txt`;
}

function endpointsFrom(settings: SiteSettings): string[] {
  return (settings.indexnow_endpoints || "")
    .split("\n")
    .map(l => l.trim())
    .filter(l => /^https:\/\//i.test(l));
}

/** 写入一条推送记录，并修剪过旧记录 */
async function writeLog(db: D1Database, url: string, endpoint: string, status: "ok" | "fail", message: string) {
  try {
    await db
      .prepare(
        `INSERT INTO indexnow_log (url, endpoint, status, message) VALUES (?, ?, ?, ?)`
      )
      .bind(url.slice(0, 500), endpoint.slice(0, 200), status, message.slice(0, 300))
      .run();
    await db
      .prepare(
        `DELETE FROM indexnow_log WHERE id NOT IN (SELECT id FROM indexnow_log ORDER BY created_at DESC LIMIT ?)`
      )
      .bind(LOG_KEEP)
      .run();
  } catch {
    // 日志写入失败不影响推送主流程
  }
}

export interface PingResult {
  endpoint: string;
  status: "ok" | "fail";
  message: string;
}

/**
 * 推送一组 URL 到所有已配置端点。best-effort：单个端点失败不抛错，仅记录。
 * 返回每个端点的结果摘要。urls 传相对路径（如 /post/xxx），内部拼成绝对 URL。
 */
export async function pingIndexNow(
  db: D1Database,
  settings: SiteSettings,
  relUrls: string[],
  fallbackOrigin: string
): Promise<PingResult[]> {
  const key = (settings.indexnow_key || "").trim();
  if (!key) return [];
  const host = indexNowHost(settings, fallbackOrigin);
  if (!host) return [];
  const endpoints = endpointsFrom(settings);
  if (!endpoints.length || !relUrls.length) return [];

  const urlList = relUrls.map(u => {
    const path = u.startsWith("http") ? u : `${host}${u.startsWith("/") ? "" : "/"}${u}`;
    return path;
  });
  const keyLocation = indexNowKeyLocation(settings, fallbackOrigin);
  const payload = JSON.stringify({ host: host.replace(/^https?:\/\//, ""), key, keyLocation, urlList });

  const results: PingResult[] = [];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: payload,
      });
      const okStatus = res.status >= 200 && res.status < 300;
      const msg = okStatus ? `HTTP ${res.status}` : `HTTP ${res.status}`;
      results.push({ endpoint: ep, status: okStatus ? "ok" : "fail", message: msg });
      await writeLog(db, urlList.join(", "), ep, okStatus ? "ok" : "fail", msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ endpoint: ep, status: "fail", message: msg.slice(0, 200) });
      await writeLog(db, urlList.join(", "), ep, "fail", msg);
    }
  }
  return results;
}

/** 读取最近推送记录 */
export async function getIndexNowLog(db: D1Database, limit = 50): Promise<
  { id: number; url: string; endpoint: string; status: string; message: string; created_at: string }[]
> {
  const n = Math.min(200, Math.max(1, limit));
  const rows = await db
    .prepare(`SELECT id, url, endpoint, status, message, created_at FROM indexnow_log ORDER BY created_at DESC LIMIT ?`)
    .bind(n)
    .all<{ id: number; url: string; endpoint: string; status: string; message: string; created_at: string }>();
  return rows.results;
}

/**
 * 百度收录推送（独立 API，非 IndexNow）。
 * 文档：百度搜索资源平台 - 普通收录工具。POST 一行一个 URL 到
 * http://data.zz.baidu.com/urls?site=<site>&token=<token>
 * 成功返回 { remain, success }；失败返回 { error, message }。
 */
export async function baiduPush(
  db: D1Database,
  settings: SiteSettings,
  relUrls: string[],
  fallbackOrigin: string
): Promise<{ ok: boolean; message: string }> {
  const site = (settings.baidu_push_site || "").trim();
  const token = (settings.baidu_push_token || "").trim();
  if (!settings.baidu_push_enabled || !site || !token || !relUrls.length) {
    return { ok: false, message: "未启用或缺少 site/token" };
  }
  const host = indexNowHost(settings, fallbackOrigin);
  const urlList = relUrls.map(u => (u.startsWith("http") ? u : `${host}${u.startsWith("/") ? "" : "/"}${u}`));
  const body = urlList.join("\n");
  const ep = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(site)}&token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });
    const text = await res.text();
    let remain = "", success = "";
    try {
      const j = JSON.parse(text) as { remain?: number; success?: number; error?: number; message?: string };
      remain = j.remain != null ? `今日剩余额度 ${j.remain} 条` : "";
      success = j.success != null ? `成功推送 ${j.success} 条` : "";
      if (j.error) return logReturn(false, `百度返回错误 ${j.error}：${j.message || text.slice(0, 120)}`);
    } catch {
      /* 非 JSON，按 HTTP 状态判断 */
    }
    const okStatus = res.status >= 200 && res.status < 300;
    const msg = [okStatus ? "推送成功" : `推送失败（HTTP ${res.status}）`, success, remain].filter(Boolean).join("，");
    return logReturn(okStatus, msg);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return logReturn(false, msg.slice(0, 200));
  }

  async function logReturn(ok: boolean, message: string) {
    await writeLog(db, urlList.join(", "), "baidu", ok ? "ok" : "fail", message);
    return { ok, message };
  }
}
