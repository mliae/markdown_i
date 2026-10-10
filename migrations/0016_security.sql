-- 安全中心：攻击日志 / 封禁列表 / 错误日志
CREATE TABLE IF NOT EXISTS attack_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ip         TEXT NOT NULL DEFAULT '',
  path       TEXT NOT NULL DEFAULT '',
  method     TEXT NOT NULL DEFAULT '',
  ua         TEXT NOT NULL DEFAULT '',
  rule       TEXT NOT NULL DEFAULT '',
  level      TEXT NOT NULL DEFAULT 'low',
  blocked    INTEGER NOT NULL DEFAULT 0,
  country    TEXT NOT NULL DEFAULT '',
  region     TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_attack_log_created ON attack_log (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_attack_log_ip ON attack_log (ip);

CREATE TABLE IF NOT EXISTS blocked_ips (
  ip         TEXT PRIMARY KEY,
  reason     TEXT NOT NULL DEFAULT '',
  rule       TEXT NOT NULL DEFAULT '',
  level      TEXT NOT NULL DEFAULT 'high',
  blocked_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON blocked_ips (expires_at);

CREATE TABLE IF NOT EXISTS error_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  method     TEXT NOT NULL DEFAULT '',
  path       TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  stack      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_error_log_created ON error_log (created_at DESC, id DESC);