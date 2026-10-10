-- 评论泛化：同一张 comments 表同时承载“说说评论”和“文章评论”
-- moment_id → (target_type, target_id)：target_type ∈ ('moment','post')
-- SQLite 无法直接改列，重建表并迁移存量数据
CREATE TABLE comments_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type  TEXT NOT NULL DEFAULT 'moment',
  target_id    INTEGER NOT NULL,
  parent_id    INTEGER NOT NULL DEFAULT 0,
  nickname     TEXT NOT NULL,
  content      TEXT NOT NULL,
  is_owner     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  qq           TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT NOT NULL DEFAULT '',
  website      TEXT NOT NULL DEFAULT ''
);

INSERT INTO comments_new
  (id, target_type, target_id, parent_id, nickname, content, is_owner, created_at, qq, email, avatar_url, website)
SELECT id, 'moment', moment_id, parent_id, nickname, content, is_owner, created_at, qq, email, avatar_url, website
FROM comments;

DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;

CREATE INDEX IF NOT EXISTS idx_comments_target ON comments (target_type, target_id, parent_id, id);
