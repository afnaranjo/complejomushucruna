PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_accounts (
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

CREATE TABLE IF NOT EXISTS media_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_idx TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Nuevo',
  media_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  frequency_channel TEXT NOT NULL,
  program_name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  contract TEXT NOT NULL,
  people_count INTEGER NOT NULL,
  team_enc TEXT NOT NULL,
  phone_enc TEXT NOT NULL,
  contact_email_enc TEXT NOT NULL,
  conditions_version TEXT NOT NULL,
  conditions_hash TEXT NOT NULL,
  conditions_accepted_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_media_profile_account FOREIGN KEY (account_id) REFERENCES media_accounts(id)
);

CREATE TABLE IF NOT EXISTS media_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_media_note_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id),
  CONSTRAINT fk_media_note_author FOREIGN KEY (author_id) REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS media_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_by_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_media_password_reset_account FOREIGN KEY (account_id) REFERENCES media_accounts(id),
  CONSTRAINT fk_media_password_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_media_login_email_window ON media_login_attempts (email_idx, attempted_at);
CREATE INDEX IF NOT EXISTS idx_media_login_ip_window ON media_login_attempts (ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_media_profiles_status_date ON media_profiles (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_media_profiles_name ON media_profiles (media_name);
CREATE INDEX IF NOT EXISTS idx_media_notes_profile ON media_notes (profile_id, created_at);
CREATE INDEX IF NOT EXISTS idx_media_password_reset_account ON media_password_resets (account_id, expires_at);
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('008_media_accounts', CURRENT_TIMESTAMP);
