/**
 * Workers 运行时全局类型垫片（Node 自托管版）
 * 业务代码原本依赖 @cloudflare/workers-types，这里只声明实际用到的最小接口，
 * 由 src/platform/* 的适配器提供运行时实现，业务代码无需修改。
 */

/* ==================== D1（SQLite） ==================== */

interface D1Meta {
  duration?: number;
  last_row_id?: number;
  changes?: number;
  rows_read?: number;
  rows_written?: number;
  size_after?: number;
  served_by?: string;
  [k: string]: unknown;
}

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta: D1Meta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

/* ==================== R2（对象存储） ==================== */

interface R2HTTPMetadata {
  contentType?: string;
  contentEncoding?: string;
  contentDisposition?: string;
  contentLanguage?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

type R2Range =
  | { suffix: number }
  | { offset: number; length?: number }
  | { offset?: number; length?: number };

interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  httpMetadata?: R2HTTPMetadata;
  uploaded: Date;
  range?: R2Range;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  get(key: string, options: { range: R2Range }): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream | null,
    options?: R2PutOptions
  ): Promise<R2Object>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<R2Object | null>;
}

/* ==================== Workers 运行时杂项 ==================== */

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
