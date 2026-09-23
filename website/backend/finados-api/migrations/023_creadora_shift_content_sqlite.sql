ALTER TABLE creadora_shifts ADD COLUMN attended TEXT NULL;
ALTER TABLE creadora_shifts ADD COLUMN attendance_at TEXT NULL;

CREATE TABLE IF NOT EXISTS creadora_shift_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  shift_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_creadora_content_shift FOREIGN KEY (shift_id) REFERENCES creadora_shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_creadora_content_shift ON creadora_shift_content (shift_id, created_at);

-- La bitácora admite dos acciones más: la asistencia y el contenido registrado.
PRAGMA foreign_keys = OFF;

CREATE TABLE creadora_shift_log_v023 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NULL,
  creadora_id INTEGER NULL,
  action TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  creadora_name TEXT NOT NULL DEFAULT '',
  before_starts_at TEXT NULL,
  before_ends_at TEXT NULL,
  after_starts_at TEXT NULL,
  after_ends_at TEXT NULL,
  detail TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL,
  CONSTRAINT ck_creadora_log_action CHECK (action IN ('created', 'moved', 'resized', 'reassigned', 'edited', 'canceled', 'restored', 'attendance', 'content'))
);

INSERT INTO creadora_shift_log_v023 (id, shift_id, creadora_id, action, actor_name, creadora_name, before_starts_at, before_ends_at, after_starts_at, after_ends_at, detail, recorded_at)
  SELECT id, shift_id, creadora_id, action, actor_name, creadora_name, before_starts_at, before_ends_at, after_starts_at, after_ends_at, detail, recorded_at FROM creadora_shift_log;

DROP TABLE creadora_shift_log;
ALTER TABLE creadora_shift_log_v023 RENAME TO creadora_shift_log;
CREATE INDEX IF NOT EXISTS idx_creadora_shift_log_recent ON creadora_shift_log (recorded_at, id);

PRAGMA foreign_keys = ON;
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('023_creadora_shift_content', CURRENT_TIMESTAMP);
