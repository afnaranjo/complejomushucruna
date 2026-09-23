CREATE TABLE IF NOT EXISTS emprendedor_accounts (
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

CREATE TABLE IF NOT EXISTS emprendedor_login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email_idx CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  succeeded TINYINT(1) NOT NULL,
  attempted_at DATETIME NOT NULL,
  INDEX idx_emprendedor_login_email_window (email_idx, attempted_at),
  INDEX idx_emprendedor_login_ip_window (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emprendedor_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  account_id BIGINT UNSIGNED NOT NULL UNIQUE,
  status VARCHAR(40) NOT NULL DEFAULT 'Nuevo',
  traffic_light VARCHAR(12) NOT NULL DEFAULT 'red',
  full_name VARCHAR(160) NOT NULL,
  cedula_enc TEXT NOT NULL,
  cedula_idx CHAR(64) NOT NULL,
  birth_date_enc TEXT NOT NULL,
  age_at_submission TINYINT UNSIGNED NOT NULL,
  whatsapp_enc TEXT NOT NULL,
  whatsapp_idx CHAR(64) NOT NULL,
  city VARCHAR(100) NOT NULL,
  business_name VARCHAR(160) NOT NULL,
  product VARCHAR(300) NOT NULL,
  stand_code VARCHAR(40) NOT NULL DEFAULT '',
  main_network VARCHAR(20) NOT NULL,
  tiktok VARCHAR(300) NOT NULL DEFAULT '',
  instagram VARCHAR(300) NOT NULL DEFAULT '',
  facebook VARCHAR(300) NOT NULL DEFAULT '',
  previous_participation VARCHAR(60) NOT NULL,
  submitted_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_emprendedor_profiles_status_date (status, submitted_at),
  INDEX idx_emprendedor_profiles_name (full_name),
  INDEX idx_emprendedor_profiles_cedula (cedula_idx),
  INDEX idx_emprendedor_profiles_whatsapp (whatsapp_idx),
  CONSTRAINT fk_emprendedor_profile_account FOREIGN KEY (account_id) REFERENCES emprendedor_accounts(id),
  CONSTRAINT ck_emprendedor_profile_light CHECK (traffic_light IN ('red', 'yellow', 'green'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emprendedor_consents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL,
  consent_type VARCHAR(40) NOT NULL,
  accepted TINYINT(1) NOT NULL,
  text_version VARCHAR(80) NOT NULL,
  text_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  recorded_at DATETIME NOT NULL,
  INDEX idx_emprendedor_consents_profile (profile_id, consent_type, recorded_at),
  CONSTRAINT fk_emprendedor_consent_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emprendedor_photos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL UNIQUE,
  storage_key VARCHAR(500) NOT NULL UNIQUE,
  content_type VARCHAR(100) NOT NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  width INT UNSIGNED NOT NULL,
  height INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_emprendedor_photo_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emprendedor_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_emprendedor_notes_profile (profile_id, created_at),
  CONSTRAINT fk_emprendedor_note_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id),
  CONSTRAINT fk_emprendedor_note_author FOREIGN KEY (author_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emprendedor_password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_emprendedor_password_reset_account (account_id, expires_at),
  CONSTRAINT fk_emprendedor_password_reset_account FOREIGN KEY (account_id) REFERENCES emprendedor_accounts(id),
  CONSTRAINT fk_emprendedor_password_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emprendedor_progress (
  profile_id BIGINT UNSIGNED PRIMARY KEY,
  followers_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_emprendedor_progress_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id) ON DELETE CASCADE,
  CONSTRAINT ck_emprendedor_progress_level CHECK (level BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emprendedor_videos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id BIGINT UNSIGNED NOT NULL,
  slot TINYINT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'empty',
  views_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_emprendedor_video_slot (profile_id, slot),
  INDEX idx_emprendedor_videos_views (views_count),
  CONSTRAINT fk_emprendedor_video_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id) ON DELETE CASCADE,
  CONSTRAINT ck_emprendedor_video_slot CHECK (slot BETWEEN 1 AND 5),
  CONSTRAINT ck_emprendedor_video_status CHECK (status IN ('empty', 'submitted', 'approved', 'rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emprendedor_video_schedule (
  slot TINYINT UNSIGNED PRIMARY KEY,
  enabled_at DATE NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT ck_emprendedor_video_schedule_slot CHECK (slot BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO emprendedor_video_schedule (slot, enabled_at, updated_at) VALUES
  (1, NULL, UTC_TIMESTAMP()),
  (2, NULL, UTC_TIMESTAMP()),
  (3, NULL, UTC_TIMESTAMP()),
  (4, NULL, UTC_TIMESTAMP()),
  (5, NULL, UTC_TIMESTAMP());

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('017_emprendedor_accounts', UTC_TIMESTAMP());
