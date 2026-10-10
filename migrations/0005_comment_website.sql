-- 评论增强：网站字段（填了网址后头像可点击跳转）
ALTER TABLE comments ADD COLUMN website TEXT NOT NULL DEFAULT '';
