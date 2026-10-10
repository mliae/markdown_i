-- IndexNow 推送记录表
CREATE TABLE IF NOT EXISTS indexnow_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL DEFAULT '',
  endpoint   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_indexnow_log_created ON indexnow_log (created_at DESC);
