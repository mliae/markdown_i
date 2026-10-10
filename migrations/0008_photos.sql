-- 相册表：存储全站图片（说说图片、文章封面、后台手动上传）
-- visible=1 在前台 /photos 显示；sort_order 升序排列

CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  src         TEXT NOT NULL,              -- 图片可访问路径（/media/key 或 http(s) 外链）
  title       TEXT NOT NULL DEFAULT '',   -- 标题
  description TEXT NOT NULL DEFAULT '',   -- 描述
  sort_order  INTEGER NOT NULL DEFAULT 0, -- 排序（升序，值越小越靠前）
  visible     INTEGER NOT NULL DEFAULT 1, -- 1=前台显示 0=仅后台可见
  source_type TEXT NOT NULL DEFAULT 'upload', -- upload / moment / post
  source_id   INTEGER NOT NULL DEFAULT 0, -- 来源说说或文章 id（upload 时为 0）
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_visible_sort ON photos (visible DESC, sort_order ASC, id DESC);
