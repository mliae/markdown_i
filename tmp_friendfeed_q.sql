.mode column
.headers on
SELECT '=== settings friends_fetch_enabled ===' AS section;
SELECT key, value FROM settings WHERE key LIKE '%friend%' OR key='friends_fetch_enabled';
SELECT '=== kv_store 抓取游标 ===' AS section;
SELECT key, value FROM kv_store WHERE key IN ('friends_fetch_last','friends_fetch_cursor');
SELECT '=== friends 表（启用抓取的） ===' AS section;
SELECT id, name, feed_enabled, feed_status, substr(feed_url,1,45) AS url40 FROM friends WHERE feed_url != '' ORDER BY id LIMIT 20;
SELECT '=== friend_posts 最新5条 ===' AS section;
SELECT id, friend_id, substr(title,1,30) AS title, substr(published_at,1,19) AS pub, substr(created_at,1,19) AS created FROM friend_posts ORDER BY id DESC LIMIT 5;
SELECT '=== friend_posts 计数 ===' AS section;
SELECT COUNT(*) AS total FROM friend_posts;
SELECT '=== 每源库存 ===' AS section;
SELECT friend_id, COUNT(*) AS cnt, MAX(created_at) AS last_created FROM friend_posts GROUP BY friend_id ORDER BY friend_id;