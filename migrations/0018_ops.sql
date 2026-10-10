-- 运维增强：可用性监控 + 性能监控
CREATE TABLE IF NOT EXISTS uptime_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  url        TEXT NOT NULL DEFAULT '',
  status     INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_uptime_log_created ON uptime_log (created_at DESC);

CREATE TABLE IF NOT EXISTS perf_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  method       TEXT NOT NULL DEFAULT '',
  path         TEXT NOT NULL DEFAULT '',
  duration_ms  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_perf_log_created ON perf_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_log_path ON perf_log (path);