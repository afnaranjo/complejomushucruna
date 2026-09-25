CREATE TABLE IF NOT EXISTS production_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  board TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#94165e',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  archived_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_production_items_board ON production_items (board, archived_at);

CREATE TABLE IF NOT EXISTS production_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  board TEXT NOT NULL,
  item_id INTEGER NULL REFERENCES production_items(id),
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94165e',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planificado',
  owner TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  canceled_at TEXT NULL,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_production_entries_range ON production_entries (board, starts_at);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('032_production_boards', CURRENT_TIMESTAMP);
