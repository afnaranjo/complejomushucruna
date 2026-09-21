PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL UNIQUE,
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_media_photo_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
);

ALTER TABLE media_profiles ADD COLUMN channels TEXT NULL;
ALTER TABLE media_profiles ADD COLUMN tv_channels TEXT NULL;
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('014_media_channels_photo', CURRENT_TIMESTAMP);
