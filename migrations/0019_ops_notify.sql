-- 运维告警记录（用于去重：同一轮故障 60 分钟内不重复推送）
CREATE TABLE IF NOT EXISTS ops_notify_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  type       TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ops_notify_type_time ON ops_notify_log (type, created_at DESC);