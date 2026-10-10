/**
 * 随机横幅背景图：本站代理 + R2 缓存（前缀 /api/bg）
 * - 按设置的「换图频率（小时）」把时间分桶，同桶内所有访客同一张图 → 高缓存命中
 * - 首次请求抓取图源（URL 含 {seed} 占位），校验为图片且 ≤5MB 后存 R2，后续直出
 * - 自动清理 30 天前的旧图，避免 R2 无限增长
 */
import { Hono } from "hono";
import type { HonoEnv } from "../types";
import { fail, ok } from "../respond";
import { getSettings, updateSettings, type SiteSettings } from "../settings";
import { requireAdmin } from "../auth";

const app = new Hono<HonoEnv>();

const MAX_BYTES = 5 * 1024 * 1024; // 单图上限 5MB
const KEEP_MS = 30 * 24 * 3600 * 1000; // 保留最近 30 天

/** 简易字符串哈希，用于把图源 URL 映射成短目录名 */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** 清理某图源目录下 30 天前的旧缓存图（不阻塞响应） */
async function pruneOld(R2: R2Bucket, prefix: string, now: number): Promise<void> {
  try {
    const cutoff = now - KEEP_MS;
    let cursor: string | undefined;
    const toDelete: string[] = [];
    do {
      const listed = await R2.list({ prefix, cursor, limit: 500 });
      for (const o of listed.objects) {
        const m = /(\d+)\.jpg$/i.exec(o.key);
        if (!m) continue;
        const bucket = Number(m[1]);
        if (Number.isFinite(bucket) && bucket < cutoff) toDelete.push(o.key);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    for (const k of toDelete) await R2.delete(k).catch(() => {});
  } catch {
    /* 清理失败不影响服务 */
  }
}

app.get("/", async c => {
  const s = await getSettings(c.env.DB);
  // 横幅随机背景 与 全站背景图 任一开启即服务（两者复用同一图源与时间桶缓存）
  if (s.banner_bg_mode !== "random" && !s.site_bg_enabled) return fail(c, "未启用随机背景", 404);

  const source = (s.banner_bg_source || "").trim();
  if (!/^https:\/\//i.test(source) || !source.includes("{seed}")) {
    return fail(c, "随机图源配置无效（需 https 且含 {seed}）", 500);
  }

  const hours = Math.max(1, Math.min(720, parseInt(s.banner_bg_interval, 10) || 24));
  const bucketMs = hours * 3600_000;
  const now = Date.now();
  const bucket = Math.floor(now / bucketMs) * bucketMs; // 对齐到时间桶起点（ms）
  const seed = String(bucket);
  const maxAge = Math.max(1, Math.floor((bucket + bucketMs - now) / 1000)); // 距下个桶的秒数

  const prefix = `bg/${hashStr(source)}/`;
  const key = `${prefix}${seed}.jpg`;

  // 命中 R2 缓存 → 直出
  const cached = await c.env.R2.get(key);
  if (cached) {
    const ct = cached.httpMetadata?.contentType || "image/jpeg";
    return new Response(cached.body, {
      headers: { "Content-Type": ct, "Cache-Control": `public, max-age=${maxAge}`, ETag: cached.httpEtag },
    });
  }

  // 未命中 → 抓取图源
  let res: Response;
  try {
    res = await fetch(source.replace("{seed}", seed), {
      headers: { "User-Agent": "moments-bg/1.0" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return fail(c, "图源抓取失败", 502);
  }
  if (!res.ok) return fail(c, "图源返回异常", 502);
  const ct = res.headers.get("content-type") || "";
  if (!/^image\//i.test(ct)) return fail(c, "图源返回的不是图片", 502);
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return fail(c, "图片为空或超过 5MB", 502);

  await c.env.R2.put(key, buf, { httpMetadata: { contentType: ct } });
  c.executionCtx.waitUntil(pruneOld(c.env.R2, prefix, now));

  return new Response(buf, {
    headers: { "Content-Type": ct, "Cache-Control": `public, max-age=${maxAge}` },
  });
});

/** 计算当前/下一时间桶的 R2 缓存键（random 模式） */
function bucketKeys(s: SiteSettings, now: number): string[] {
  const source = (s.banner_bg_source || "").trim();
  const hours = Math.max(1, Math.min(720, parseInt(s.banner_bg_interval, 10) || 24));
  const bucketMs = hours * 3600_000;
  const cur = Math.floor(now / bucketMs) * bucketMs;
  const prefix = `bg/${hashStr(source)}/`;
  return [`${prefix}${cur}.jpg`, `${prefix}${cur + bucketMs}.jpg`]; // 当前桶 + 可能已预热的下一桶
}

/**
 * 换一张（后台按钮）：random 模式删除当前桶 R2 缓存（下次访问重新抓随机图）；
 * 两种模式都递增 bg_version，让前台 URL 变化以击穿浏览器/边缘缓存
 */
app.post("/refresh", requireAdmin, async c => {
  const s = await getSettings(c.env.DB);
  if (s.banner_bg_mode === "random") {
    for (const k of bucketKeys(s, Date.now())) await c.env.R2.delete(k).catch(() => {});
  }
  const v = String((parseInt(s.bg_version, 10) || 0) + 1);
  const next = await updateSettings(c.env.DB, { bg_version: v });
  return ok(c, { settings: next });
});

/**
 * 解析动态图源最终 URL（static 模式 + 动态随机接口）：
 * 服务端跟随 302 拿到真实图地址，横幅与全站背景共用同一个最终 URL，保证同一张图；
 * 浏览器直连动态接口时每个请求各自跳转，会出现横幅/背景不一致。
 */
app.get("/resolve", async c => {
  const s = await getSettings(c.env.DB);
  const u = (s.banner_bg_image || "").trim();
  if (s.banner_bg_mode === "random" || !/^https?:\/\//i.test(u)) return ok(c, { url: "" });
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": "moments-bg/1.0" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    await res.body?.cancel().catch(() => {}); // 只要最终 URL，不下载图片
    return ok(c, { url: res.url || u });
  } catch {
    return ok(c, { url: u }); // 解析失败回退原 URL
  }
});

/**
 * 定时预热（cron 每分钟调用）：保证当前时间桶的图已在 R2，访客永不撞上 5 秒冷抓取；
 * 距桶切换不足 5 分钟时提前抓下一桶，实现无感换图。失败静默，下个分钟自动重试。
 */
export async function preheatBg(env: HonoEnv["Bindings"]): Promise<void> {
  const s = await getSettings(env.DB);
  // 仅"本站代理缓存"模式需要预热 R2；直连（固定/动态 URL）模式浏览器自行请求，不经过 R2
  if (s.banner_bg_mode !== "random") return;
  const source = (s.banner_bg_source || "").trim();
  if (!/^https:\/\//i.test(source) || !source.includes("{seed}")) return;

  const hours = Math.max(1, Math.min(720, parseInt(s.banner_bg_interval, 10) || 24));
  const bucketMs = hours * 3600_000;
  const now = Date.now();
  const cur = Math.floor(now / bucketMs) * bucketMs;
  const seeds = [cur];
  if (cur + bucketMs - now < 5 * 60_000) seeds.push(cur + bucketMs); // 临近换图：预热下一桶

  const prefix = `bg/${hashStr(source)}/`;
  for (const seed of seeds) {
    const key = `${prefix}${seed}.jpg`;
    try {
      if (await env.R2.head(key)) continue; // 已在缓存
      const res = await fetch(source.replace("{seed}", String(seed)), {
        headers: { "User-Agent": "moments-bg/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!/^image\//i.test(ct)) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) continue;
      await env.R2.put(key, buf, { httpMetadata: { contentType: ct } });
      console.log(`[bg-preheat] warmed ${key} (${buf.byteLength} bytes)`);
    } catch (e) {
      console.error("[bg-preheat] failed:", e);
    }
  }
  await pruneOld(env.R2, prefix, now);
}

export default app;
