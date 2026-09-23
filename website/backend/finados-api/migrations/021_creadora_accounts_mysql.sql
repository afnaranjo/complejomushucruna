CREATE TABLE IF NOT EXISTS creadora_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  email_enc TEXT NOT NULL,
  email_idx CHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  privacy_version VARCHAR(32) NOT NULL,
  privacy_hash CHAR(64) NOT NULL,
  privacy_acknowledged_at DATETIME NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creadora_login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email_idx CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  succeeded TINYINT(1) NOT NULL,
  attempted_at DATETIME NOT NULL,
  INDEX idx_creadora_attempts (email_idx, attempted_at),
  INDEX idx_creadora_attempts_ip (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creadoras (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  account_id BIGINT UNSIGNED NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'Nuevo',
  origin VARCHAR(16) NOT NULL DEFAULT 'coordinacion',
  full_name VARCHAR(160) NOT NULL,
  name_idx CHAR(64) NOT NULL,
  whatsapp_enc TEXT NOT NULL,
  whatsapp_idx CHAR(64) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  main_network VARCHAR(32) NOT NULL DEFAULT '',
  social_link VARCHAR(400) NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  submitted_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_creadoras_status (status, full_name),
  INDEX idx_creadoras_name (name_idx),
  CONSTRAINT fk_creadora_account FOREIGN KEY (account_id) REFERENCES creadora_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creadora_consents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  creadora_id BIGINT UNSIGNED NOT NULL,
  consent_type VARCHAR(32) NOT NULL,
  accepted TINYINT(1) NOT NULL,
  text_version VARCHAR(32) NOT NULL,
  text_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  recorded_at DATETIME NOT NULL,
  INDEX idx_creadora_consents (creadora_id, consent_type),
  CONSTRAINT fk_creadora_consent FOREIGN KEY (creadora_id) REFERENCES creadoras(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creadora_password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_creadora_resets (account_id, expires_at),
  CONSTRAINT fk_creadora_reset_account FOREIGN KEY (account_id) REFERENCES creadora_accounts(id),
  CONSTRAINT fk_creadora_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creadora_shifts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  creadora_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  place VARCHAR(160) NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  canceled_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_creadora_shifts_range (starts_at, ends_at),
  INDEX idx_creadora_shifts_creadora (creadora_id, starts_at),
  CONSTRAINT fk_creadora_shift FOREIGN KEY (creadora_id) REFERENCES creadoras(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creadora_shift_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_id BIGINT UNSIGNED NULL,
  creadora_id BIGINT UNSIGNED NULL,
  action VARCHAR(16) NOT NULL,
  actor_name VARCHAR(160) NOT NULL,
  creadora_name VARCHAR(160) NOT NULL DEFAULT '',
  before_starts_at DATETIME NULL,
  before_ends_at DATETIME NULL,
  after_starts_at DATETIME NULL,
  after_ends_at DATETIME NULL,
  detail VARCHAR(400) NOT NULL DEFAULT '',
  recorded_at DATETIME NOT NULL,
  INDEX idx_creadora_shift_log_recent (recorded_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('021_creadora_accounts', UTC_TIMESTAMP());
