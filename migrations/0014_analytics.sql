-- 访问统计：PV 明细（保留 90 天）+ IP 归属地缓存（按 IP 去重，避免重复调用 ip-api）
CREATE TABLE IF NOT EXISTS analytics_pv (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  path         TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  referrer     TEXT NOT NULL DEFAULT '',
  utm_source   TEXT NOT NULL DEFAULT '',
  utm_medium   TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  country      TEXT NOT NULL DEFAULT '',
  region       TEXT NOT NULL DEFAULT '',
  city         TEXT NOT NULL DEFAULT '',
  isp          TEXT NOT NULL DEFAULT '',
  ip           TEXT NOT NULL DEFAULT '',
  device       TEXT NOT NULL DEFAULT '',  -- desktop / mobile / tablet
  browser      TEXT NOT NULL DEFAULT '',
  os           TEXT NOT NULL DEFAULT '',
  sid          TEXT NOT NULL DEFAULT '',  -- 会话 id（前端 sessionStorage 生成）
  duration     INTEGER NOT NULL DEFAULT 0 -- 停留秒数，离开时回写
);
CREATE INDEX IF NOT EXISTS idx_analytics_pv_created ON analytics_pv (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_pv_path ON analytics_pv (path);
CREATE INDEX IF NOT EXISTS idx_analytics_pv_sid ON analytics_pv (sid);

CREATE TABLE IF NOT EXISTS analytics_ip_geo (
  ip         TEXT PRIMARY KEY,
  country    TEXT NOT NULL DEFAULT '',
  region     TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT '',
  isp        TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
