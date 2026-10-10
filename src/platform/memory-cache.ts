/**
 * Cache API 垫片（caches.default）：进程内 LRU + TTL
 * 替代 Cloudflare 边缘缓存，仅缓存 GET 200 响应；
 * TTL 取 Cache-Control 的 s-maxage / max-age，无指令默认 120 秒。
 */

interface Entry {
  status: number;
  buf: ArrayBuffer;
  headers: Array<[string, string]>;
  expires: number;
  bytes: number;
}

const DEFAULT_TTL = 120_000;
const MAX_ENTRIES = 300;
const MAX_BYTES = 256 * 1024 * 1024; // 256MB

function ttlOf(headers: Headers): number {
  const cc = headers.get("cache-control") || "";
  const sm = /s-maxage\s*=\s*(\d+)/i.exec(cc);
  if (sm) return Number(sm[1]) * 1000;
  const m = /max-age\s*=\s*(\d+)/i.exec(cc);
  if (m) return Number(m[1]) * 1000;
  return DEFAULT_TTL;
}

export class MemoryCache implements Cache {
  private map = new Map<string, Entry>();
  private totalBytes = 0;

  private keyOf(req: RequestInfo): string {
    const url = typeof req === "string" ? req : req.url;
    return url;
  }

  private evict(): void {
    while (this.map.size >= MAX_ENTRIES || this.totalBytes > MAX_BYTES) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(request: RequestInfo): boolean {
    const k = this.keyOf(request);
    const old = this.map.get(k);
    if (!old) return false;
    this.totalBytes -= old.bytes;
    this.map.delete(k);
    return true;
  }

  async match(request: RequestInfo): Promise<Response | undefined> {
    const k = this.keyOf(request);
    const e = this.map.get(k);
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.delete(k);
      return undefined;
    }
    // LRU 触达更新：删后重插排到末尾
    this.map.delete(k);
    this.map.set(k, e);
    return new Response(e.buf, { status: e.status, headers: new Headers(e.headers) });
  }

  async put(request: RequestInfo, response: Response): Promise<void> {
    if (response.status !== 200) return;
    const k = this.keyOf(request);
    const buf = await response.clone().arrayBuffer();
    const headers = [...response.headers.entries()];
    const e: Entry = {
      status: response.status,
      buf,
      headers,
      expires: Date.now() + ttlOf(response.headers),
      bytes: buf.byteLength,
    };
    const old = this.map.get(k);
    if (old) this.totalBytes -= old.bytes;
    this.map.set(k, e);
    this.totalBytes += e.bytes;
    this.evict();
  }
}

/** 安装全局 caches 垫片（必须在业务模块处理请求前调用） */
export function installGlobalCache(): void {
  const g = globalThis as unknown as { caches?: { default: Cache } };
  if (!g.caches) {
    g.caches = { default: new MemoryCache() };
  }
}
