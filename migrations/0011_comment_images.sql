-- 评论图片：JSON 数组，存图片 URL 列表
ALTER TABLE comments ADD COLUMN images TEXT DEFAULT '';
