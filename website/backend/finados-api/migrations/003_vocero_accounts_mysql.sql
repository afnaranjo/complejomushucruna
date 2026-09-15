CREATE TABLE IF NOT EXISTS vocero_accounts (
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

CREATE TABLE IF NOT EXISTS vocero_login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email_idx CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  succeeded TINYINT(1) NOT NULL,
  attempted_at DATETIME NOT NULL,
  INDEX idx_vocero_login_window (email_idx, ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vocero_account_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL UNIQUE,
  vocero_id BIGINT UNSIGNED NOT NULL UNIQUE,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_vocero_account_link_account FOREIGN KEY (account_id) REFERENCES vocero_accounts(id),
  CONSTRAINT fk_vocero_account_link_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vocero_photos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vocero_id BIGINT UNSIGNED NOT NULL UNIQUE,
  storage_key VARCHAR(500) NOT NULL UNIQUE,
  content_type VARCHAR(100) NOT NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_vocero_photo_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vocero_password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_vocero_password_reset_account (account_id, expires_at),
  CONSTRAINT fk_vocero_password_reset_account FOREIGN KEY (account_id) REFERENCES vocero_accounts(id),
  CONSTRAINT fk_vocero_password_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('003_vocero_accounts', UTC_TIMESTAMP());
