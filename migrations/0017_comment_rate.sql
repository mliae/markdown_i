-- 评论防刷：同 IP 高频评论频控表（60 秒窗口计数）
CREATE TABLE IF NOT EXISTS comment_rate (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_comment_rate_ip_time ON comment_rate (ip, created_at);