/**
 * R2Bucket 适配器：本地磁盘对象存储
 * - 对象内容存 <root>/<key>，HTTP 元数据（contentType 等）存 <key>.__meta.json sidecar
 * - 支持 R2 的 suffix / offset+length 范围读取（视频拖拽）
 * - 后续接 OSS 时新写一个同接口适配器即可，业务代码零改动
 */
import { createReadStream } from "node:fs";
import {
  mkdirSync,
  statSync,
  existsSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
  createWriteStream,
} from "node:fs";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";

const META_SUFFIX = ".__meta.json";

/** key 安全校验：禁止绝对路径与 `..` 越界（防目录穿越） */
function safePath(root: string, key: string): string {
  const clean = normalize(key).replace(/^[/\\]+/, "");
  const full = resolve(root, clean);
  if (full !== resolve(root) && !full.startsWith(resolve(root) + sep)) {
    throw new Error("invalid storage key: " + key);
  }
  return full;
}

async function collectBody(
  body: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream | null
): Promise<Buffer> {
  if (body === null || body === undefined) return Buffer.alloc(0);
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  // ReadableStream（Web）→ Node Buffer
  const nodeStream = Readable.fromWeb(body as ReadableStream<Uint8Array>);
  const chunks: Buffer[] = [];
  for await (const chunk of nodeStream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export class DiskR2 implements R2Bucket {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
  }

  private metaPath(p: string): string {
    return p + META_SUFFIX;
  }

  private readMeta(p: string): R2HTTPMetadata | undefined {
    const mp = this.metaPath(p);
    if (!existsSync(mp)) return undefined;
    try {
      return JSON.parse(readFileSync(mp, "utf8")) as R2HTTPMetadata;
    } catch {
      return undefined;
    }
  }

  private toObject(p: string, key: string, range?: R2Range): R2ObjectBody {
    const st = statSync(p);
    const httpMetadata = this.readMeta(p);
    const etag = `"${createHash("md5").update(`${st.size}-${st.mtimeMs}`).digest("hex")}"`;
    let start = 0;
    let end = st.size - 1;
    if (range) {
      if ("suffix" in range && typeof range.suffix === "number") {
        start = Math.max(0, st.size - range.suffix);
      } else if (range && "offset" in range && typeof range.offset === "number") {
        start = range.offset;
        if (typeof range.length === "number") end = start + range.length - 1;
      }
      end = Math.min(end, st.size - 1);
    }
    const nodeStream = createReadStream(p, range ? { start, end } : {});
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return {
      key,
      size: st.size,
      etag,
      httpEtag: etag,
      httpMetadata,
      uploaded: st.mtime,
      range,
      body: webStream,
      bodyUsed: false,
      async arrayBuffer() {
        return new Promise<ArrayBuffer>((res, rej) => {
          const chunks: Buffer[] = [];
          nodeStream.on("data", c => chunks.push(c as Buffer));
          nodeStream.on("end", () => res(Buffer.concat(chunks).buffer));
          nodeStream.on("error", rej);
        });
      },
      async text() {
        return (await this.arrayBuffer()) as unknown as string;
      },
      async json<T>() {
        return JSON.parse((await this.arrayBuffer()) as unknown as string) as T;
      },
      async blob() {
        return new Blob([await this.arrayBuffer()]);
      },
    };
  }

  async get(key: string, options?: { range: R2Range }): Promise<R2ObjectBody | null> {
    const p = safePath(this.root, key);
    if (!existsSync(p) || !statSync(p).isFile()) return null;
    return this.toObject(p, key, options?.range);
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream | null,
    options?: R2PutOptions
  ): Promise<R2Object> {
    const p = safePath(this.root, key);
    mkdirSync(dirname(p), { recursive: true });
    const buf = await collectBody(value);
    // 先写临时文件再 rename，避免并发读到半截文件
    const tmp = p + ".tmp-" + process.pid;
    await new Promise<void>((res, rej) => {
      const ws = createWriteStream(tmp);
      ws.on("error", rej);
      ws.on("finish", () => res());
      ws.end(buf);
    });
    const { renameSync } = await import("node:fs");
    renameSync(tmp, p);
    if (options?.httpMetadata) {
      writeFileSync(this.metaPath(p), JSON.stringify(options.httpMetadata));
    }
    const obj = this.toObject(p, key);
    return {
      key: obj.key,
      size: obj.size,
      etag: obj.etag,
      httpEtag: obj.httpEtag,
      httpMetadata: obj.httpMetadata,
      uploaded: obj.uploaded,
    };
  }

  async delete(key: string | string[]): Promise<void> {
    // 兼容 R2Bucket.delete(string | string[])：数组批量删除
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      const p = safePath(this.root, k);
      try {
        unlinkSync(p);
      } catch {
        /* 不存在视为已删除 */
      }
      try {
        unlinkSync(this.metaPath(p));
      } catch {
        /* ignore */
      }
    }
  }

  async head(key: string): Promise<R2Object | null> {
    const p = safePath(this.root, key);
    if (!existsSync(p) || !statSync(p).isFile()) return null;
    const o = this.toObject(p, key);
    return {
      key: o.key,
      size: o.size,
      etag: o.etag,
      httpEtag: o.httpEtag,
      httpMetadata: o.httpMetadata,
      uploaded: o.uploaded,
    };
  }
}
