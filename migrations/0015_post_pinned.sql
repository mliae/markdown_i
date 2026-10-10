-- 文章置顶：pinned=1 的已发布文章在文章列表与首页混合流最前面展示
ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts (status, pinned, id DESC);
