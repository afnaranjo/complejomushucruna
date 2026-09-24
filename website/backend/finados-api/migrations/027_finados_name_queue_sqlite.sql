CREATE TABLE IF NOT EXISTS finados_name_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  consent_given INTEGER NOT NULL CHECK (consent_given = 1),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_finados_name_queue_expiry ON finados_name_queue (expires_at, id);
