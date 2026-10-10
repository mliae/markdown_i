-- 友情链接表：友站信息 + 申请审核状态
CREATE TABLE IF NOT EXISTS friends (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  avatar      TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'approved', -- approved / pending / rejected
  last_checked TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends (status, sort_order ASC, id DESC);
