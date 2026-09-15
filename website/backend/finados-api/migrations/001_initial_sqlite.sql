PRAGMA foreign_keys = ON;

CREATE TABLE voceros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  submission_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Nuevo',
  full_name TEXT NOT NULL,
  cedula_enc TEXT NOT NULL,
  cedula_idx TEXT NOT NULL,
  birth_date_enc TEXT NOT NULL,
  age_at_submission INTEGER NOT NULL,
  whatsapp_enc TEXT NOT NULL,
  whatsapp_idx TEXT NOT NULL,
  email_enc TEXT NOT NULL,
  email_idx TEXT NOT NULL,
  city TEXT NOT NULL,
  tiktok TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  facebook TEXT NOT NULL DEFAULT '',
  main_network TEXT NOT NULL,
  previous_participation TEXT NOT NULL,
  community_source TEXT NOT NULL,
  kit_pickup TEXT NOT NULL,
  representative_name_enc TEXT NULL,
  representative_cedula_enc TEXT NULL,
  representative_cedula_idx TEXT NULL,
  representative_phone_enc TEXT NULL,
  representative_phone_idx TEXT NULL,
  representative_email_enc TEXT NULL,
  representative_email_idx TEXT NULL,
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  utm_content TEXT NOT NULL DEFAULT '',
  utm_term TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL

);

CREATE TABLE vocero_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocero_id INTEGER NOT NULL,
  consent_type TEXT NOT NULL,
  accepted INTEGER NOT NULL,
  text_version TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  ip_enc TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  source_url TEXT NOT NULL,
  method TEXT NOT NULL,
  CONSTRAINT uq_vocero_consent UNIQUE (vocero_id, consent_type, text_hash),
  CONSTRAINT fk_consent_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id)

);

CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NULL

);

CREATE TABLE vocero_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocero_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_note_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id),
  CONSTRAINT fk_note_author FOREIGN KEY (author_id) REFERENCES admin_users(id)

);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NULL,
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_public_id TEXT NULL,
  metadata_json TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES admin_users(id)

);

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  attempted_at TEXT NOT NULL

);

CREATE TABLE schema_migrations (
  version TEXT NOT NULL PRIMARY KEY,
  applied_at TEXT NOT NULL

);

CREATE INDEX idx_voceros_status_date ON voceros (status, submitted_at);
CREATE INDEX idx_voceros_name ON voceros (full_name);
CREATE INDEX idx_voceros_city ON voceros (city);
CREATE INDEX idx_audit_created ON audit_log (created_at);
CREATE INDEX idx_login_window ON login_attempts (username_hash, ip_hash, attempted_at);
