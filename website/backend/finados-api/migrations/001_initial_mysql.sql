CREATE TABLE voceros (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  submission_id CHAR(32) NOT NULL UNIQUE,
  status VARCHAR(40) NOT NULL DEFAULT 'Nuevo',
  full_name VARCHAR(160) NOT NULL,
  cedula_enc TEXT NOT NULL,
  cedula_idx CHAR(64) NOT NULL,
  birth_date_enc TEXT NOT NULL,
  age_at_submission TINYINT UNSIGNED NOT NULL,
  whatsapp_enc TEXT NOT NULL,
  whatsapp_idx CHAR(64) NOT NULL,
  email_enc TEXT NOT NULL,
  email_idx CHAR(64) NOT NULL,
  city VARCHAR(100) NOT NULL,
  tiktok VARCHAR(300) NOT NULL DEFAULT '',
  instagram VARCHAR(300) NOT NULL DEFAULT '',
  facebook VARCHAR(300) NOT NULL DEFAULT '',
  main_network VARCHAR(20) NOT NULL,
  previous_participation VARCHAR(60) NOT NULL,
  community_source VARCHAR(80) NOT NULL,
  kit_pickup VARCHAR(80) NOT NULL,
  representative_name_enc TEXT NULL,
  representative_cedula_enc TEXT NULL,
  representative_cedula_idx CHAR(64) NULL,
  representative_phone_enc TEXT NULL,
  representative_phone_idx CHAR(64) NULL,
  representative_email_enc TEXT NULL,
  representative_email_idx CHAR(64) NULL,
  utm_source VARCHAR(180) NOT NULL DEFAULT '',
  utm_medium VARCHAR(180) NOT NULL DEFAULT '',
  utm_campaign VARCHAR(180) NOT NULL DEFAULT '',
  utm_content VARCHAR(180) NOT NULL DEFAULT '',
  utm_term VARCHAR(180) NOT NULL DEFAULT '',
  submitted_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_voceros_status_date (status, submitted_at),
  INDEX idx_voceros_name (full_name),
  INDEX idx_voceros_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocero_consents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vocero_id BIGINT UNSIGNED NOT NULL,
  consent_type VARCHAR(24) NOT NULL,
  accepted TINYINT(1) NOT NULL,
  text_version VARCHAR(80) NOT NULL,
  text_hash CHAR(64) NOT NULL,
  accepted_at DATETIME NOT NULL,
  ip_enc TEXT NOT NULL,
  user_agent VARCHAR(500) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  method VARCHAR(40) NOT NULL,
  UNIQUE KEY uq_vocero_consent (vocero_id, consent_type, text_hash),
  CONSTRAINT fk_consent_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocero_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vocero_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_note_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id),
  CONSTRAINT fk_note_author FOREIGN KEY (author_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(80) NOT NULL,
  subject_type VARCHAR(40) NOT NULL,
  subject_public_id CHAR(32) NULL,
  metadata_json TEXT NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  succeeded TINYINT(1) NOT NULL,
  attempted_at DATETIME NOT NULL,
  INDEX idx_login_window (username_hash, ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schema_migrations (
  version VARCHAR(80) PRIMARY KEY,
  applied_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
