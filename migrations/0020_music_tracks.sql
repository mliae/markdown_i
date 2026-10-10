-- 站内音乐库：后台搜歌聚合解析后，音频/封面下载到 R2，文章 [music=ID] 直接引用
CREATE TABLE IF NOT EXISTS music_tracks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL DEFAULT '',
  artist     TEXT NOT NULL DEFAULT '',
  album      TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'netease', -- netease / qq / upload / url
  source_id  TEXT NOT NULL DEFAULT '',
  vip        INTEGER NOT NULL DEFAULT 0,      -- 0=免费 1=平台标为 VIP/付费
  audio_key  TEXT NOT NULL DEFAULT '',        -- R2 object key（music/audio-*）
  cover_key  TEXT NOT NULL DEFAULT '',        -- R2 object key（music/cover-*）
  lyric      TEXT NOT NULL DEFAULT '',
  duration   INTEGER NOT NULL DEFAULT 0,      -- 秒
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_music_tracks_enabled ON music_tracks (enabled, id);