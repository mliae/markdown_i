-- 站点配置：单行表（id 恒为 1），data 为整个设置对象的 JSON
CREATE TABLE IF NOT EXISTS site_config (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  data        TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
