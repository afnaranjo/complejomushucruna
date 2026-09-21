CREATE TABLE IF NOT EXISTS media_photos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL UNIQUE,
  storage_key VARCHAR(500) NOT NULL UNIQUE,
  content_type VARCHAR(100) NOT NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  width INT UNSIGNED NOT NULL,
  height INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_media_photo_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE media_profiles ADD COLUMN channels TEXT NULL, ADD COLUMN tv_channels TEXT NULL;
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('014_media_channels_photo', UTC_TIMESTAMP());
