PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mfs_accounts (
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

CREATE TABLE IF NOT EXISTS mfs_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_idx TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mfs_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Nuevo',
  full_name TEXT NOT NULL,
  stage_name TEXT NOT NULL DEFAULT '',
  whatsapp_enc TEXT NOT NULL,
  whatsapp_idx TEXT NOT NULL,
  audition_url TEXT NOT NULL,
  audition_submitted_at TEXT NOT NULL,
  video_declaration_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_mfs_profile_account FOREIGN KEY (account_id) REFERENCES mfs_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_mfs_profiles_status_date ON mfs_profiles (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_mfs_profiles_whatsapp ON mfs_profiles (whatsapp_idx);

CREATE TABLE IF NOT EXISTS mfs_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  consent_type TEXT NOT NULL,
  accepted INTEGER NOT NULL,
  text_version TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  CONSTRAINT fk_mfs_consent_profile FOREIGN KEY (profile_id) REFERENCES mfs_profiles(id)
);

CREATE TABLE IF NOT EXISTS mfs_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL UNIQUE,
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_mfs_photo_profile FOREIGN KEY (profile_id) REFERENCES mfs_profiles(id)
);

CREATE TABLE IF NOT EXISTS mfs_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_mfs_note_profile FOREIGN KEY (profile_id) REFERENCES mfs_profiles(id),
  CONSTRAINT fk_mfs_note_author FOREIGN KEY (author_id) REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS mfs_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_by_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_mfs_password_reset_account FOREIGN KEY (account_id) REFERENCES mfs_accounts(id),
  CONSTRAINT fk_mfs_password_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('028_mfs_accounts', CURRENT_TIMESTAMP);
