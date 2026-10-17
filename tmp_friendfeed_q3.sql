.mode column
.headers on
SELECT '=== site_config 表结构 ===' AS section;
SELECT sql FROM sqlite_master WHERE type='table' AND name='site_config';
SELECT '=== site_config 内容（截取） ===' AS section;
SELECT * FROM site_config LIMIT 1;
SELECT '=== 近24小时新增文章 ===' AS section;
SELECT COUNT(*) AS new_posts_24h FROM friend_posts WHERE created_at > datetime('now','-1 day');
SELECT '=== 近24小时被触碰文章 ===' AS section;
SELECT COUNT(*) AS touched_24h FROM friend_posts WHERE updated_at > datetime('now','-1 day');
SELECT '=== 各源最新 updated_at ===' AS section;
SELECT friend_id, COUNT(*) AS cnt, MAX(created_at) AS max_created, MAX(updated_at) AS max_updated FROM friend_posts GROUP BY friend_id ORDER BY friend_id;
SELECT '=== 各源最新 feed_status ===' AS section;
SELECT id, name, feed_status, feed_enabled FROM friends WHERE feed_url != '' ORDER BY id;