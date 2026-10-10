/**
 * D1Database 适配器：better-sqlite3 实现
 * 业务代码使用的 D1 接口子集：prepare/bind/all/first/run/batch/exec。
 * SQL 方言与 D1 同为 SQLite，schema 与查询零改动。
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** D1 参数 → better-sqlite3 参数（布尔转 0/1，undefined 转 null） */
function norm(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Uint8Array) return Buffer.from(v);
  return v;
}

class SqliteStatement implements D1PreparedStatement {
  private readonly db: Database.Database;
  private readonly sql: string;
  private binds: unknown[] = [];

  constructor(db: Database.Database, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.binds = values.map(norm);
    return this;
  }

  /** 编译并执行（SELECT / INSERT ... RETURNING 都用 all() 拿行） */
  private rows(): unknown[] {
    const stmt = this.db.prepare(this.sql);
    return stmt.all(...(this.binds as never[])) as unknown[];
  }

  async all<T>(): Promise<D1Result<T>> {
    const rows = this.rows() as T[];
    return { results: rows, success: true, meta: {} };
  }

  async first<T>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...(this.binds as never[])) as Record<string, unknown> | undefined;
    if (row === undefined) return null;
    if (colName) return (row[colName] ?? null) as T;
    return row as T;
  }

  async run<T>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...(this.binds as never[]));
    return {
      results: [],
      success: true,
      meta: {
        last_row_id: Number(info.lastInsertRowid),
        changes: info.changes,
        rows_written: info.changes,
      },
    };
  }

  async raw<T>(): Promise<T[]> {
    return this.rows() as T[];
  }

  /**
   * batch() 内部使用：在事务里执行单条语句。
   * D1 batch 允许读写混合，且 SELECT 的结果行也要在 D1Result.results 里返回；
   * 用 better-sqlite3 的 stmt.reader 判断：读语句 all()，写语句 run()，
   * 不能无条件 all()——DELETE/UPDATE 会抛“This statement does not return data”。
   */
  _execInTx(): D1Result {
    const stmt = this.db.prepare(this.sql);
    if (stmt.reader) {
      return { results: stmt.all(...(this.binds as never[])) as unknown[], success: true, meta: {} };
    }
    const info = stmt.run(...(this.binds as never[]));
    return {
      results: [],
      success: true,
      meta: {
        last_row_id: Number(info.lastInsertRowid),
        changes: info.changes,
        rows_written: info.changes,
      },
    };
  }
}

export class SqliteD1 implements D1Database {
  readonly raw: Database.Database;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.raw = new Database(filePath);
    this.raw.pragma("journal_mode = WAL");
    this.raw.pragma("foreign_keys = ON");
    this.raw.pragma("busy_timeout = 5000");
  }

  prepare(query: string): D1PreparedStatement {
    return new SqliteStatement(this.raw, query);
  }

  async exec(query: string): Promise<D1Result> {
    this.raw.exec(query);
    return { results: [], success: true, meta: {} };
  }

  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const tx = this.raw.transaction((items: SqliteStatement[]) =>
      items.map(s => s._execInTx() as D1Result<T>)
    );
    return tx(statements as SqliteStatement[]);
  }

  close(): void {
    this.raw.close();
  }
}
