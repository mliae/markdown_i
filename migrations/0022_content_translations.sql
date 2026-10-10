-- 内容翻译缓存：访客点「翻译」后译文按原文哈希永久缓存，编辑后自动重译
CREATE TABLE IF NOT EXISTS content_translations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL,             -- post / moment / about
  content_id   TEXT NOT NULL,             -- 文章/说说数字 id；about 固定 'site'
  lang         TEXT NOT NULL,             -- zh-TW / en
  src_hash     TEXT NOT NULL,             -- sha-256(标题+正文 canonical)
  title        TEXT,                      -- 文章标题译文（其余类型为 NULL）
  content      TEXT NOT NULL DEFAULT '',  -- 译文正文；about 存 4 字段 JSON
  engine       TEXT NOT NULL DEFAULT 'local', -- local（简繁）/ ai（Workers AI）
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(content_type, content_id, lang)
);
CREATE INDEX IF NOT EXISTS idx_xlate_hash ON content_translations (content_type, content_id, lang, src_hash);

-- 翻译接口防刷：同 IP 60 秒窗口计数
CREATE TABLE IF NOT EXISTS translate_rate (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_translate_rate_ip_time ON translate_rate (ip, created_at);
