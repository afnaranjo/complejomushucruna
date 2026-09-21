PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  consent_type TEXT NOT NULL,
  accepted INTEGER NOT NULL,
  text_version TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  CONSTRAINT fk_media_consent_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_media_consents_profile ON media_consents (profile_id, consent_type, recorded_at);
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('012_media_consents', CURRENT_TIMESTAMP);
