/**
 * Markdown-i Node 自托管入口
 * 把 Hono app 挂到 @hono/node-server，并注入与 Cloudflare Workers 同构的 env：
 *   DB     → better-sqlite3（src/platform/sqlite-d1.ts）
 *   R2     → 本地磁盘（src/platform/disk-r2.ts）
 *   ASSETS → public/ 静态文件（src/platform/assets-fetcher.ts）
 *   AI     → OpenAI 兼容接口（可选，未配置则功能自动禁用）
 * Cron：node-cron 每分钟调用 handleScheduled（友圈抓取/监控/头像补偿/QQ 保活）。
 */
import { serve } from "@hono/node-server";
import cron from "node-cron";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

// ---- 极简 .env 加载（无第三方依赖）----
function loadEnvFile(): void {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnvFile();

import { app, handleScheduled } from "../index";
import { ensureSchema } from "../db";
import { installGlobalCache } from "./memory-cache";
import { SqliteD1 } from "./sqlite-d1";
import { DiskR2 } from "./disk-r2";
import { AssetsFetcher } from "./assets-fetcher";
import { OpenAiAi } from "./ai-openai";
import type { Env } from "../types";

// tsx 开发与 esbuild 打包后均以 process.cwd() 为根目录
const ROOT = resolve(process.cwd());
const DATA_DIR = resolve(process.env.DATA_DIR || join(ROOT, "data"));
const PUBLIC_DIR = resolve(process.env.PUBLIC_DIR || join(ROOT, "public"));
const PORT = Number(process.env.PORT || 8787);

mkdirSync(DATA_DIR, { recursive: true });

// Workers 全局 caches.default 垫片（必须在任何请求前装好）
installGlobalCache();

// ---- 构建与 Workers 同构的 env ----
const AI =
  process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL
    ? new OpenAiAi({
        baseUrl: process.env.AI_BASE_URL,
        apiKey: process.env.AI_API_KEY,
        model: process.env.AI_MODEL,
      })
    : undefined;

const env = {
  DB: new SqliteD1(join(DATA_DIR, "markdown-i.db")),
  R2: new DiskR2(join(DATA_DIR, "media")),
  ASSETS: new AssetsFetcher(PUBLIC_DIR),
  AI,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",
  SITE_NAME: process.env.SITE_NAME || "Markdown-i",
} as unknown as Env;

// 与 Workers ExecutionContext 同构：waitUntil 即发即忘，异常只记日志
const executionCtx: ExecutionContext = {
  waitUntil(p: Promise<unknown>): void {
    p.catch(e => console.error("[waitUntil]", e));
  },
  passThroughOnException(): void {
    /* Node 无此概念，空实现 */
  },
};

// Nginx 反代：把真实客户端 IP 补写进业务读取的 cf-connecting-ip 头
function withRealIp(req: Request): Request {
  if (req.headers.get("cf-connecting-ip")) return req;
  const real = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!real) return req;
  const headers = new Headers(req.headers);
  headers.set("cf-connecting-ip", real);
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  // multipart 上传等带 body 的请求需透传流并声明 duplex
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }
  return new Request(req.url, init);
}

/**
 * 旧版本兼容迁移：早期 Node 版只有 r2/b2 两个选项，其中 storage_mode=r2 实际写本地磁盘。
 * 引入 local/r2/b2 三模式后，新 r2 表示真正的 Cloudflare R2（必有 r2_endpoint），
 * 因此把「r2 且未配置 R2 S3 端点」的历史数据一次性改为 local，旧文件路径不受影响（无前缀=本地）。
 */
async function migrateLegacySettings(db: Env["DB"]): Promise<void> {
  const row = await db.prepare(`SELECT data FROM site_config WHERE id = 1`).first<{ data: string }>();
  if (!row || !row.data) return;
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    return;
  }
  if (cfg.storage_mode === "r2" && !cfg.r2_endpoint) {
    cfg.storage_mode = "local";
    await db.prepare(`UPDATE site_config SET data = ? WHERE id = 1`).bind(JSON.stringify(cfg)).run();
    console.log("[migrate] storage_mode r2(本地磁盘) -> local");
  }
}

// ---- 启动：建表 + HTTP 服务 + 定时任务 ----
async function main(): Promise<void> {
  await ensureSchema(env.DB);
  await migrateLegacySettings(env.DB);

  serve({
    fetch: (request: Request) => app.fetch(withRealIp(request), env, executionCtx),
    port: PORT,
    hostname: "0.0.0.0",
  });
  console.log(`[markdown-i] http://127.0.0.1:${PORT}  (data: ${DATA_DIR})`);

  // 每分钟一次，内部各自按间隔判断是否执行
  cron.schedule("* * * * *", () => {
    handleScheduled(env).catch(e => console.error("[cron]", e));
  });
}

main().catch(e => {
  console.error("[startup] fatal:", e);
  process.exit(1);
});
