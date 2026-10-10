-- 音乐库曲目标签：用于歌单筛选（/api/music/playlist.json?tag=xxx）
ALTER TABLE music_tracks ADD COLUMN tag TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_music_tracks_tag ON music_tracks (tag);
