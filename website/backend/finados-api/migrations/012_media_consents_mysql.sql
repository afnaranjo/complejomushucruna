CREATE TABLE IF NOT EXISTS media_consents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL,
  consent_type VARCHAR(40) NOT NULL,
  accepted TINYINT(1) NOT NULL,
  text_version VARCHAR(80) NOT NULL,
  text_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  recorded_at DATETIME NOT NULL,
  INDEX idx_media_consents_profile (profile_id, consent_type, recorded_at),
  CONSTRAINT fk_media_consent_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('012_media_consents', UTC_TIMESTAMP());
