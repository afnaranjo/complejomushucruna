CREATE TABLE IF NOT EXISTS media_videos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL,
  url_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_media_video_url (profile_id, url_hash),
  INDEX idx_media_videos_profile (profile_id, created_at),
  CONSTRAINT fk_media_video_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE media_profiles ADD COLUMN social_link VARCHAR(300) NOT NULL DEFAULT '' AFTER frequency_channel;
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('009_media_videos', UTC_TIMESTAMP());
