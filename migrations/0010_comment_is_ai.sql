-- 0010: 评论表增加 is_ai 字段（1 = Workers AI 机器人自动回复，0 = 普通用户评论）
ALTER TABLE comments ADD COLUMN is_ai INTEGER NOT NULL DEFAULT 0;
