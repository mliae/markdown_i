-- moments 初始表结构：动态(moments) / 文章(posts) / 评论(comments) / 点赞(likes)
-- 时间统一 UTC ISO8601（strftime），应用层格式化本地时区。

CREATE TABLE IF NOT EXISTS moments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content     TEXT NOT NULL DEFAULT '',
  images      TEXT NOT NULL DEFAULT '[]',  -- JSON 数组：本站 R2 key（/media/... 由 key 拼出），0~9 张
  video       TEXT NOT NULL DEFAULT '{}',  -- JSON：{kind:'mp4'|'hls', src}；src 为 /media/key 或外链 URL
  location    TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_moments_created ON moments (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  excerpt     TEXT NOT NULL DEFAULT '',
  content_md  TEXT NOT NULL DEFAULT '',
  cover       TEXT NOT NULL DEFAULT '',    -- 图片 key 或外链 URL
  status      TEXT NOT NULL DEFAULT 'published', -- published / draft
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts (status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  moment_id   INTEGER NOT NULL,
  nickname    TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_owner    INTEGER NOT NULL DEFAULT 0,  -- 1 = 站主回复（解锁态发布）
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_moment ON comments (moment_id, id);

CREATE TABLE IF NOT EXISTS likes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  moment_id   INTEGER NOT NULL,
  voter_id    TEXT NOT NULL,              -- 访客浏览器 localStorage uuid（匿名去重）
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (moment_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_moment ON likes (moment_id);
