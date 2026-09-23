-- Records may now be created by coordination without an account; the account is linked later.
ALTER TABLE media_profiles MODIFY account_id BIGINT UNSIGNED NULL;
ALTER TABLE media_profiles ADD COLUMN origin VARCHAR(16) NOT NULL DEFAULT 'cuenta', ADD COLUMN representatives TEXT NULL, ADD COLUMN followers_validated BIGINT UNSIGNED NULL, ADD COLUMN claim_account_id BIGINT UNSIGNED NULL, ADD COLUMN claim_requested_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS media_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  event_date DATE NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_media_events_date (event_date, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_event_coverage (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  profile_id BIGINT UNSIGNED NOT NULL,
  contracted VARCHAR(3) NULL,
  result VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  people_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  links TEXT NULL,
  note TEXT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_media_event_coverage (event_id, profile_id),
  INDEX idx_media_event_coverage_profile (profile_id),
  CONSTRAINT fk_media_coverage_event FOREIGN KEY (event_id) REFERENCES media_events(id),
  CONSTRAINT fk_media_coverage_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_media_invitations_profile (profile_id, expires_at),
  CONSTRAINT fk_media_invitation_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id),
  CONSTRAINT fk_media_invitation_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('018_media_coverage', UTC_TIMESTAMP());
