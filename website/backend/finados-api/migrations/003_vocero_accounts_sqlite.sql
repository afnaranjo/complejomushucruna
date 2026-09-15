PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vocero_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  email_enc TEXT NOT NULL,
  email_idx TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  privacy_hash TEXT NOT NULL,
  privacy_acknowledged_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS vocero_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_idx TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vocero_account_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL UNIQUE,
  vocero_id INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_vocero_account_link_account FOREIGN KEY (account_id) REFERENCES vocero_accounts(id),
  CONSTRAINT fk_vocero_account_link_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id)
);

CREATE TABLE IF NOT EXISTS vocero_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocero_id INTEGER NOT NULL UNIQUE,
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_vocero_photo_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id)
);

CREATE TABLE IF NOT EXISTS vocero_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_by_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_vocero_password_reset_account FOREIGN KEY (account_id) REFERENCES vocero_accounts(id),
  CONSTRAINT fk_vocero_password_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_vocero_login_window ON vocero_login_attempts (email_idx, ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_vocero_login_email_window ON vocero_login_attempts (email_idx, attempted_at);
CREATE INDEX IF NOT EXISTS idx_vocero_login_ip_window ON vocero_login_attempts (ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_vocero_password_reset_account ON vocero_password_resets (account_id, expires_at);
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('003_vocero_accounts', CURRENT_TIMESTAMP);
