CREATE TABLE IF NOT EXISTS creadora_shift_script (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  shift_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  reference_url TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_creadora_script_shift FOREIGN KEY (shift_id) REFERENCES creadora_shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_creadora_script_shift ON creadora_shift_script (shift_id, position, id);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('025_creadora_shift_script', CURRENT_TIMESTAMP);
