/**
 * ASSETS 绑定适配器：本地 public/ 静态文件服务
 * 文件存在则返回文件，其余路径回退 index.html（SPA 兜底）。
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { Readable } from "node:stream";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".wasm": "application/wasm",
};

export class AssetsFetcher implements Fetcher {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private respondFile(absPath: string, urlPath: string): Response {
    const st = statSync(absPath);
    if (!st.isFile()) return this.respondIndex();
    const type = MIME[extname(absPath).toLowerCase()] || "application/octet-stream";
    const body = Readable.toWeb(createReadStream(absPath)) as ReadableStream;
    // 带版本号 query（?v=...）的资源可强缓存；index.html 短缓存
    const immutable = /[?&]v=\w+/.test(urlPath) && extname(absPath) !== ".html";
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": type,
        "content-length": String(st.size),
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=60",
        "last-modified": st.mtime.toUTCString(),
      },
    });
  }

  private respondIndex(): Response {
    const idx = join(this.root, "index.html");
    if (!existsSync(idx)) return new Response("Not Found", { status: 404 });
    const st = statSync(idx);
    return new Response(Readable.toWeb(createReadStream(idx)) as ReadableStream, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-length": String(st.size),
        "cache-control": "public, max-age=60",
      },
    });
  }

  async fetch(input: RequestInfo | URL): Promise<Response> {
    let pathname = "/";
    let search = "";
    try {
      const u = typeof input === "string" || input instanceof URL ? new URL(input.toString(), "http://local") : new URL(input.url);
      pathname = decodeURIComponent(u.pathname);
      search = u.search;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // 防目录穿越
    const safe = join(this.root, pathname);
    if (resolve(safe) !== this.root && !resolve(safe).startsWith(this.root + "\\") && !resolve(safe).startsWith(this.root + "/")) {
      return new Response("Forbidden", { status: 403 });
    }

    const abs = join(this.root, pathname);
    if (pathname !== "/" && existsSync(abs)) return this.respondFile(abs, pathname + search);
    if (pathname === "/" || existsSync(join(this.root, "index.html"))) return this.respondIndex();
    return new Response("Not Found", { status: 404 });
  }
}
