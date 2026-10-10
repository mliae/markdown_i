-- 评论增强：QQ 号 / 邮箱 / 头像（输入 QQ 号自动获取昵称和头像）
ALTER TABLE comments ADD COLUMN qq TEXT NOT NULL DEFAULT '';
ALTER TABLE comments ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE comments ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
