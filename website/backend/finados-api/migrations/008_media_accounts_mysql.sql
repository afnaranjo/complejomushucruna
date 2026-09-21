CREATE TABLE IF NOT EXISTS media_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  email_enc TEXT NOT NULL,
  email_idx CHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  privacy_version VARCHAR(80) NOT NULL,
  privacy_hash CHAR(64) NOT NULL,
  privacy_acknowledged_at DATETIME NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email_idx CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  succeeded TINYINT(1) NOT NULL,
  attempted_at DATETIME NOT NULL,
  INDEX idx_media_login_email_window (email_idx, attempted_at),
  INDEX idx_media_login_ip_window (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  account_id BIGINT UNSIGNED NOT NULL UNIQUE,
  status VARCHAR(40) NOT NULL DEFAULT 'Nuevo',
  media_name VARCHAR(140) NOT NULL,
  media_type VARCHAR(40) NOT NULL,
  frequency_channel VARCHAR(120) NOT NULL,
  program_name VARCHAR(160) NOT NULL,
  program_type VARCHAR(40) NOT NULL,
  province VARCHAR(60) NOT NULL,
  city VARCHAR(100) NOT NULL,
  contract VARCHAR(4) NOT NULL,
  people_count TINYINT UNSIGNED NOT NULL,
  team_enc TEXT NOT NULL,
  phone_enc TEXT NOT NULL,
  contact_email_enc TEXT NOT NULL,
  conditions_version VARCHAR(80) NOT NULL,
  conditions_hash CHAR(64) NOT NULL,
  conditions_accepted_at DATETIME NOT NULL,
  submitted_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_media_profiles_status_date (status, submitted_at),
  INDEX idx_media_profiles_name (media_name),
  CONSTRAINT fk_media_profile_account FOREIGN KEY (account_id) REFERENCES media_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_media_notes_profile (profile_id, created_at),
  CONSTRAINT fk_media_note_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id),
  CONSTRAINT fk_media_note_author FOREIGN KEY (author_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_media_password_reset_account (account_id, expires_at),
  CONSTRAINT fk_media_password_reset_account FOREIGN KEY (account_id) REFERENCES media_accounts(id),
  CONSTRAINT fk_media_password_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('008_media_accounts', UTC_TIMESTAMP());
