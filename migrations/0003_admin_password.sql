-- 站主密码（后台可修改）：单行表，存 SHA-256 哈希。
-- 无记录时回退使用环境变量 / Secret ADMIN_PASSWORD。
CREATE TABLE IF NOT EXISTS admin_auth (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
