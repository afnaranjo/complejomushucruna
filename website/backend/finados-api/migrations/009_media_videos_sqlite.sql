PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT uq_media_video_url UNIQUE (profile_id, url_hash),
  CONSTRAINT fk_media_video_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_media_videos_profile ON media_videos (profile_id, created_at);
ALTER TABLE media_profiles ADD COLUMN social_link TEXT NOT NULL DEFAULT '';
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('009_media_videos', CURRENT_TIMESTAMP);
