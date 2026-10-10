-- 楼中楼回复：parent_id 指向“根评论”id（0 = 顶级评论；回复某条回复时也归一到根，只做两级）
ALTER TABLE comments ADD COLUMN parent_id INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (moment_id, parent_id, id);
