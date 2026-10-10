-- 评论头像补偿：记录头像拉取重试次数，cron 任务只重试近期失败且未达上限的评论
ALTER TABLE comments ADD COLUMN avatar_tries INTEGER NOT NULL DEFAULT 0;
