CREATE TABLE IF NOT EXISTS media_plan (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('030_media_plan', CURRENT_TIMESTAMP);
