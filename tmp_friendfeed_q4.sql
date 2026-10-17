.mode column
.headers on
SELECT '=== friend_posts 表结构 ===' AS section;
SELECT sql FROM sqlite_master WHERE type='table' AND name='friend_posts';
SELECT '=== friend_posts 索引 ===' AS section;
SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='friend_posts';
SELECT '=== friend 5 全部 12 行 ===' AS section;
SELECT id, substr(title,1,28) AS title, substr(link,1,60) AS link, substr(published_at,1,19) AS pub, substr(created_at,1,19) AS created, substr(updated_at,1,19) AS updated FROM friend_posts WHERE friend_id=5 ORDER BY published_at DESC LIMIT 12;
SELECT '=== friend 5 库存修剪结果：最新 12 篇 published_at ===' AS section;
SELECT id, substr(published_at,1,19) AS pub FROM friend_posts WHERE friend_id=5 ORDER BY published_at DESC, id DESC LIMIT 12;