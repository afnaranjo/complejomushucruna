CREATE TABLE IF NOT EXISTS golden_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  cedula_enc TEXT NOT NULL,
  cedula_idx TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valido',
  note TEXT NOT NULL DEFAULT '',
  archived_at TEXT NULL,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_golden_passes_cedula ON golden_passes (cedula_idx, archived_at);
CREATE INDEX IF NOT EXISTS idx_golden_passes_archived ON golden_passes (archived_at, created_at);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('037_golden_pass', CURRENT_TIMESTAMP);
