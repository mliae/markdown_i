.mode column
.headers on
SELECT '=== site_config 中 friends 相关 ===' AS section;
SELECT key, value FROM site_config WHERE key LIKE '%friend%';
SELECT '=== 服务器当前时间 ===' AS section;
SELECT datetime('now') AS utc_now, datetime('now','localtime') AS local_now;