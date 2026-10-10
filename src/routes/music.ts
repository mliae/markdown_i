/**
 * 音乐路由 = 网易云解析代理（/163 系列，旧文章 [music=纯数字] 卡片用）
 *          + 中央音乐库代理（music-api 服务，[music=tN] / 胶囊歌单 / 后台曲库管理）
 *
 * GET /api/music/163/playlist?id=xxx
 *   → { id, name, cover, creator, songs: [{ id, name, artist, pic, duration }], total }
 *
 * GET /api/music/163?id=xxx
 *   → { url, title, artist, cover, available, proxied? }
 *   优先用网易云官方 outer URL 302 重定向拿 CDN 直链；
 *   若官方返回 404（VIP/下架/区域限制），降级为同源流代理
 *   （/api/music/163/stream?id= 让 <audio> 走后端转发）。
 *
 * GET /api/music/163/stream?id=xxx
 *   → 音频二进制流（Content-Type: audio/mpeg），供 <audio> 直接播放。
 *
 * GET /api/music/163/lyric?id=xxx
 *   → { lyric: "LRC 原文" }（无歌词时为空字符串）
 */
import { Hono } from "hono";
import { ok, fail } from "../respond";
import type { HonoEnv } from "../types";
import type { Context } from "hono";
import { requireAdmin } from "../auth";
import { getSettings } from "../settings";

const app = new Hono<HonoEnv>();

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/** 通过网易云 outer URL 302 重定向获取真实 CDN 播放地址 */
async function getOuterUrl(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://music.163.com/song/media/outer/url?id=${id}.mp3`, {
      headers: { "User-Agent": UA, Referer: "https://music.163.com/" },
      redirect: "manual",
    });
    const location = res.headers.get("location") || res.headers.get("Location") || "";
    if (res.status === 302 && location && !location.endsWith("/404")) {
      return location.replace(/^http:/, "https:");
    }
  } catch {
    // 忽略，走降级
  }
  return null;
}

/** http 资源升级为 https（HTTPS 页面混合内容会被浏览器拦截） */
function toHttps(url: string): string {
  return url ? url.replace(/^http:\/\//i, "https://") : "";
}

/** 获取歌曲元信息（歌名/歌手/封面）；found=false 表示歌曲已下架/ID 无效 */
async function getSongMeta(
  id: string
): Promise<{ title: string; artist: string; cover: string; found: boolean }> {
  try {
    const res = await fetch(
      `https://music.163.com/api/song/detail?ids=${encodeURIComponent(`[${id}]`)}`,
      { headers: { "User-Agent": UA, Referer: "https://music.163.com/" } }
    );
    const data = (await res.json()) as {
      songs?: Array<{
        name?: string;
        artists?: Array<{ name?: string }>;
        album?: { picUrl?: string };
      }>;
    };
    const s = data.songs?.[0];
    if (!s?.name) return { title: "", artist: "", cover: "", found: false };
    return {
      title: s.name,
      artist: s.artists?.map(a => a.name).filter(Boolean).join(" / ") || "未知歌手",
      cover: toHttps(s.album?.picUrl || ""),
      found: true,
    };
  } catch {
    return { title: "", artist: "", cover: "", found: false };
  }
}

interface PlaylistSong {
  id: number;
  name: string;
  artist: string;
  pic: string;
  duration: number;
}

function normalizeTrack(t: Record<string, unknown>): PlaylistSong | null {
  const id = Number(t.id);
  const name = String(t.name ?? "");
  if (!id || !name) return null;
  const artists = Array.isArray(t.artists) ? (t.artists as Array<{ name?: string }>) : [];
  const album = (t.album as { name?: string; picUrl?: string } | undefined) || {};
  return {
    id,
    name,
    artist: artists.map(a => a.name).filter(Boolean).join(" / ") || "未知歌手",
    pic: toHttps(album.picUrl || ""),
    duration: Number(t.duration ?? 0),
  };
}

/** 歌单只返回 trackIds 时，用 song/detail 批量补齐歌曲信息（每批 100） */
async function getTracksByIds(ids: number[]): Promise<PlaylistSong[]> {
  const songs: PlaylistSong[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const res = await fetch(
        `https://music.163.com/api/song/detail?ids=${encodeURIComponent(JSON.stringify(chunk))}`,
        { headers: { "User-Agent": UA, Referer: "https://music.163.com/" } }
      );
      const data = (await res.json()) as { songs?: Array<Record<string, unknown>> };
      for (const t of data.songs || []) {
        const song = normalizeTrack(t);
        if (song) songs.push(song);
      }
    } catch {
      // 单批失败不影响其他批次
    }
  }
  return songs;
}

/** 获取 LRC 歌词原文 */
async function getLyric(id: string): Promise<string> {
  const res = await fetch(
    `https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`,
    { headers: { "User-Agent": UA, Referer: "https://music.163.com/" } }
  );
  const data = (await res.json()) as { lrc?: { lyric?: string }; nolyric?: boolean };
  if (data.nolyric) return "";
  return data.lrc?.lyric || "";
}

/** 获取歌单详情 */
async function getPlaylistDetail(id: string): Promise<{
  id: number;
  name: string;
  cover: string;
  creator: string;
  songs: PlaylistSong[];
}> {
  const res = await fetch(
    `https://music.163.com/api/v6/playlist/detail?id=${encodeURIComponent(id)}&n=1000`,
    { headers: { "User-Agent": UA, Referer: "https://music.163.com/", Cookie: `NMTID=${Math.random().toString(36).slice(2)}` } }
  );
  const data = (await res.json()) as {
    code: number;
    playlist?: {
      id?: number;
      name?: string;
      coverImgUrl?: string;
      creator?: { nickname?: string };
      tracks?: Array<Record<string, unknown>>;
      trackIds?: Array<{ id: number }>;
    };
  };
  const pl = data.playlist;
  if (!pl || data.code !== 200) {
    throw new Error("歌单不存在或解析失败");
  }

  // v6 内联 tracks 只含前若干首，完整列表在 trackIds；优先用 trackIds 逐首补齐
  const ids = Array.isArray(pl.trackIds) ? pl.trackIds.map(t => t.id).filter(Boolean) : [];
  let songs: PlaylistSong[];
  if (ids.length > 0) {
    songs = await getTracksByIds(ids);
  } else {
    songs = (pl.tracks || [])
      .map(normalizeTrack)
      .filter((s): s is PlaylistSong => s !== null);
  }

  return {
    id: pl.id || Number(id),
    name: pl.name || "未知歌单",
    cover: toHttps(pl.coverImgUrl || ""),
    creator: pl.creator?.nickname || "",
    songs,
  };
}

/** 解析歌曲播放地址：GET /api/music/163?id=xxx */
app.get("/163", async c => {
  const id = c.req.query("id") || "";
  if (!/^\d+$/.test(id)) return fail(c, "无效的歌曲 ID", 400);

  const [meta, url] = await Promise.all([getSongMeta(id), getOuterUrl(id)]);

  // 网易云曲库查不到该歌曲：已下架 / ID 无效 / 区域版权不可用
  if (!meta.found) {
    return ok(
      c,
      { url: "", title: "", artist: "", cover: "", available: false },
      "歌曲不可用（已下架或版权限制）"
    );
  }

  if (url) {
    return ok(c, { url: toHttps(url), title: meta.title, artist: meta.artist, cover: meta.cover, available: true }, "解析成功");
  }

  // 降级：同源流代理（VIP 歌曲通常为试听片段）
  const proxiedUrl = `/api/music/163/stream?id=${id}`;
  return ok(
    c,
    { url: proxiedUrl, title: meta.title, artist: meta.artist, cover: meta.cover, available: true, proxied: true },
    "解析成功（流代理）"
  );
});

/** 音频流代理：GET /api/music/163/stream?id=xxx
 *  透传 Range 请求支持拖拽快进 */
app.get("/163/stream", async c => {
  const id = c.req.query("id") || "";
  if (!/^\d+$/.test(id)) return fail(c, "无效的歌曲 ID", 400);

  try {
    const range = c.req.header("range") || "";
    const upstreamHeaders: Record<string, string> = { "User-Agent": UA };
    if (range) upstreamHeaders.Range = range;

    const res = await fetch(`https://api.injahow.cn/meting/?type=url&id=${id}`, {
      headers: upstreamHeaders,
    });
    if (!res.body || (res.status !== 200 && res.status !== 206)) {
      return fail(c, "音频获取失败", 502);
    }
    // 上游对下架/无版权歌曲会返回 HTML 提示页而非音频，避免把 HTML 当音频下发
    const upstreamType = res.headers.get("content-type") || "";
    if (upstreamType.includes("text/html")) {
      return fail(c, "该歌曲暂无可用音源（版权或已下架）", 502);
    }

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") || "audio/mpeg");
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    headers.set("Accept-Ranges", res.headers.get("accept-ranges") || "bytes");
    const contentRange = res.headers.get("content-range");
    const contentLength = res.headers.get("content-length");
    if (contentRange) headers.set("Content-Range", contentRange);
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(res.body, { status: res.status, headers });
  } catch {
    return fail(c, "音频代理请求失败", 502);
  }
});

/** 封面图代理：GET /api/music/163/cover?url=xxx
 *  网易云 p1/p2.music.126.net 有防盗链，浏览器直链会被 403，走 Worker 中转 */
app.get("/163/cover", async c => {
  const url = c.req.query("url") || "";
  if (!url || !/^https?:\/\/.+\.music\.126\.net\//.test(url)) {
    return fail(c, "无效的封面地址", 400);
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://music.163.com/" },
    });
    if (!res.body || res.status >= 400) return fail(c, "封面获取失败", 502);
    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return new Response(res.body, { status: res.status, headers });
  } catch {
    return fail(c, "封面代理失败", 502);
  }
});

/** LRC 歌词：GET /api/music/163/lyric?id=xxx */
app.get("/163/lyric", async c => {
  const id = c.req.query("id") || "";
  if (!/^\d+$/.test(id)) return fail(c, "无效的歌曲 ID", 400);

  try {
    const lyric = await getLyric(id);
    return ok(c, { lyric }, lyric ? "歌词获取成功" : "该歌曲暂无歌词");
  } catch {
    return fail(c, "歌词获取失败", 502);
  }
});

/** 歌单详情：GET /api/music/163/playlist?id=xxx */
app.get("/163/playlist", async c => {
  const id = c.req.query("id") || "";
  if (!/^\d+$/.test(id)) return fail(c, "无效的歌单 ID", 400);

  try {
    const playlist = await getPlaylistDetail(id);
    return ok(c, { ...playlist, total: playlist.songs.length }, "歌单获取成功");
  } catch {
    return fail(c, "歌单获取失败，请检查歌单 ID 是否正确", 502);
  }
});

/* ============================================================
 * 中央音乐库代理（music-api 服务）
 * 本地不再落库：搜索/试听/入库/曲库管理全部带 X-Api-Key 转发到中央服务；
 * /track、/playlist.json 为公开读取直通（无需 ApiKey）。
 * 服务地址与 ApiKey 在「后台 - 音乐」配置（music_api_url / music_api_key）。
 * ============================================================ */

interface MusicApiCfg {
  base: string;
  key: string;
}

/** 读取中央服务配置；未配置返回 null */
async function musicApiCfg(c: Context<HonoEnv>): Promise<MusicApiCfg | null> {
  const s = await getSettings(c.env.DB);
  const base = s.music_api_url.replace(/\/+$/, "");
  if (!base) return null;
  return { base, key: s.music_api_key };
}

interface ProxyInit {
  method?: string;
  json?: unknown; // JSON body（自动加 Content-Type）
  raw?: ArrayBuffer; // 原始 body（multipart 直通，保留 boundary）
  rawType?: string; // 原始 body 的 Content-Type
  auth?: boolean; // 默认 true=带 X-Api-Key；公开读取端点传 false
}

/** JSON 直通代理：转发到中央服务并把 {code,message,data} 原样回给前端；transform 可改写 data */
async function proxyMusicJson(
  c: Context<HonoEnv>,
  path: string,
  init: ProxyInit = {},
  transform?: (data: Record<string, unknown>) => void
): Promise<Response> {
  const cfg = await musicApiCfg(c);
  if (!cfg) return fail(c, "未配置中央音乐服务：请到「后台 - 音乐」填写服务地址与 ApiKey", 503);
  const headers: Record<string, string> = {};
  if (init.auth !== false && cfg.key) headers["X-Api-Key"] = cfg.key;
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  } else if (init.raw) {
    headers["Content-Type"] = init.rawType || "application/octet-stream";
    body = init.raw;
  }
  let res: Response;
  try {
    res = await fetch(`${cfg.base}${path}`, { method: init.method || "GET", headers, body });
  } catch {
    return fail(c, "中央音乐服务连接失败", 502);
  }
  const text = await res.text();
  let payload: { data?: unknown } | null = null;
  try {
    payload = JSON.parse(text) as { data?: unknown };
  } catch {
    // 非 JSON：原样透传
  }
  if (!payload || typeof payload !== "object") {
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  }
  if (transform && payload.data && typeof payload.data === "object") {
    transform(payload.data as Record<string, unknown>);
  }
  return new Response(JSON.stringify(payload), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 入库类响应：数字 id → "tN"（前台按 [music=tN] 插入编辑器） */
function prefixTrackId(data: Record<string, unknown>) {
  if (data.id != null && !String(data.id).startsWith("t")) data.id = `t${data.id}`;
}

/** 五平台聚合搜索（管理端）：GET /api/music/search?kw=xxx */
app.get("/search", requireAdmin, async c => {
  const kw = (c.req.query("kw") || "").trim();
  if (!kw) return fail(c, "请输入搜索关键词", 400);
  return proxyMusicJson(c, `/api/search?kw=${encodeURIComponent(kw)}`);
});

/** 试听地址解析（管理端）：GET /api/music/preview?source=&id=&title=&artist= */
app.get("/preview", requireAdmin, c => {
  const q = new URL(c.req.url).searchParams;
  return proxyMusicJson(c, `/api/resolve?${q.toString()}`);
});

/** 试听音频代理（管理端）：GET /api/music/stream?url=xxx
 *  汽水等平台直链有防盗链，浏览器 <audio> 直接请求 403，
 *  通过 Worker 代理 fetch 绕过（入库也走 Worker fetch 所以没问题） */
app.get("/stream", requireAdmin, async c => {
  const url = c.req.query("url") || "";
  if (!/^https?:\/\//i.test(url)) return fail(c, "参数错误", 400);
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!resp.ok) return fail(c, `音频获取失败 HTTP ${resp.status}`, 502);
  const ct = resp.headers.get("Content-Type") || "audio/mpeg";
  const cl = resp.headers.get("Content-Length") || "";
  return new Response(resp.body, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "no-store",
      ...(cl ? { "Content-Length": cl } : {}),
      "Accept-Ranges": "bytes",
    },
  });
});

/** 搜索结果入库（管理端）：POST /api/music/import { source, songId, ... } */
app.post("/import", requireAdmin, async c => {
  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, "参数错误", 400);
  return proxyMusicJson(c, "/api/ingest", { method: "POST", json: body }, prefixTrackId);
});

/** 异步入库提交（管理端）：POST /api/music/import/async → 立即返回 { job_id } */
app.post("/import/async", requireAdmin, async c => {
  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, "参数错误", 400);
  return proxyMusicJson(c, "/api/ingest/async", { method: "POST", json: body });
});

/** 入库任务进度（管理端）：GET /api/music/import/progress/:jobId */
app.get("/import/progress/:jobId", requireAdmin, c =>
  proxyMusicJson(c, `/api/ingest/progress/${c.req.param("jobId")}`)
);

/** 本地上传入库（管理端）：POST /api/music/upload（multipart 直通） */
app.post("/upload", requireAdmin, async c => {
  const raw = await c.req.arrayBuffer();
  return proxyMusicJson(
    c,
    "/api/ingest/upload",
    { method: "POST", raw, rawType: c.req.header("content-type") || "" },
    prefixTrackId
  );
});

/** 网络地址转存（管理端）：POST /api/music/url { url, title?, artist?, cover? } */
app.post("/url", requireAdmin, async c => {
  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, "参数错误", 400);
  return proxyMusicJson(c, "/api/ingest/url", { method: "POST", json: body }, prefixTrackId);
});

/** 站内曲目元数据（公开）：GET /api/music/track?id=tN */
app.get("/track", async c => {
  const m = /^t(\d+)$/.exec(c.req.query("id") || "");
  if (!m) return fail(c, "无效的曲目 ID", 400);
  return proxyMusicJson(c, `/track/${m[1]}`, { auth: false });
});

/** 胶囊播放器歌单（公开）：GET /api/music/playlist.json[?tag=xxx]
 *  中央服务返回纯数组（非信封），原样透传并保留边缘缓存头 */
app.get("/playlist.json", async c => {
  const cfg = await musicApiCfg(c);
  if (!cfg) return c.json([]); // 未配置时返回空歌单，避免前台播放器报错
  const tag = (c.req.query("tag") || "").trim().slice(0, 30);
  try {
    const res = await fetch(`${cfg.base}/playlist.json${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300" },
    });
  } catch {
    return c.json([]);
  }
});

/** 音乐库列表（管理端）：GET /api/music/library */
app.get("/library", requireAdmin, c =>
  proxyMusicJson(c, "/api/library", {}, data => {
    const list = (data as { list?: Array<Record<string, unknown>> }).list;
    if (Array.isArray(list)) list.forEach(t => prefixTrackId(t));
  })
);

/** 曲库管理操作直通（管理端）：tag / fill / edit / toggle / delete */
for (const op of ["tag", "fill", "edit", "toggle", "delete"] as const) {
  app.post(`/library/${op}`, requireAdmin, async c => {
    const body = await c.req.json().catch(() => null);
    if (!body) return fail(c, "参数错误", 400);
    return proxyMusicJson(c, `/api/library/${op}`, { method: "POST", json: body });
  });
}

export default app;
