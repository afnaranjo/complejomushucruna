PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS emprendedor_accounts (
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

CREATE TABLE IF NOT EXISTS emprendedor_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_idx TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emprendedor_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Nuevo',
  traffic_light TEXT NOT NULL DEFAULT 'red',
  full_name TEXT NOT NULL,
  cedula_enc TEXT NOT NULL,
  cedula_idx TEXT NOT NULL,
  birth_date_enc TEXT NOT NULL,
  age_at_submission INTEGER NOT NULL,
  whatsapp_enc TEXT NOT NULL,
  whatsapp_idx TEXT NOT NULL,
  city TEXT NOT NULL,
  business_name TEXT NOT NULL,
  product TEXT NOT NULL,
  stand_code TEXT NOT NULL DEFAULT '',
  main_network TEXT NOT NULL,
  tiktok TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  facebook TEXT NOT NULL DEFAULT '',
  previous_participation TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_emprendedor_profile_account FOREIGN KEY (account_id) REFERENCES emprendedor_accounts(id),
  CONSTRAINT ck_emprendedor_profile_light CHECK (traffic_light IN ('red', 'yellow', 'green'))
);

CREATE INDEX IF NOT EXISTS idx_emprendedor_profiles_status_date ON emprendedor_profiles (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_emprendedor_profiles_cedula ON emprendedor_profiles (cedula_idx);
CREATE INDEX IF NOT EXISTS idx_emprendedor_profiles_whatsapp ON emprendedor_profiles (whatsapp_idx);

CREATE TABLE IF NOT EXISTS emprendedor_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  consent_type TEXT NOT NULL,
  accepted INTEGER NOT NULL,
  text_version TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  CONSTRAINT fk_emprendedor_consent_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id)
);

CREATE TABLE IF NOT EXISTS emprendedor_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL UNIQUE,
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_emprendedor_photo_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id)
);

CREATE TABLE IF NOT EXISTS emprendedor_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_emprendedor_note_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id),
  CONSTRAINT fk_emprendedor_note_author FOREIGN KEY (author_id) REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS emprendedor_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_by_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_emprendedor_password_reset_account FOREIGN KEY (account_id) REFERENCES emprendedor_accounts(id),
  CONSTRAINT fk_emprendedor_password_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS emprendedor_progress (
  profile_id INTEGER PRIMARY KEY,
  followers_count INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_emprendedor_progress_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id) ON DELETE CASCADE,
  CONSTRAINT ck_emprendedor_progress_level CHECK (level BETWEEN 0 AND 6)
);

CREATE TABLE IF NOT EXISTS emprendedor_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'empty',
  views_count INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (profile_id, slot),
  CONSTRAINT fk_emprendedor_video_profile FOREIGN KEY (profile_id) REFERENCES emprendedor_profiles(id) ON DELETE CASCADE,
  CONSTRAINT ck_emprendedor_video_slot CHECK (slot BETWEEN 1 AND 5),
  CONSTRAINT ck_emprendedor_video_status CHECK (status IN ('empty', 'submitted', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS emprendedor_video_schedule (
  slot INTEGER PRIMARY KEY,
  enabled_at TEXT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT ck_emprendedor_video_schedule_slot CHECK (slot BETWEEN 1 AND 5)
);

INSERT OR IGNORE INTO emprendedor_video_schedule (slot, enabled_at, updated_at) VALUES
  (1, NULL, CURRENT_TIMESTAMP),
  (2, NULL, CURRENT_TIMESTAMP),
  (3, NULL, CURRENT_TIMESTAMP),
  (4, NULL, CURRENT_TIMESTAMP),
  (5, NULL, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('017_emprendedor_accounts', CURRENT_TIMESTAMP);
