-- Un turno puede reunir a varias creadoras en la misma caja, y cada una marca su propia asistencia.
CREATE TABLE IF NOT EXISTS creadora_shift_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL,
  creadora_id INTEGER NOT NULL,
  attended TEXT NULL,
  attendance_at TEXT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT uq_creadora_shift_member UNIQUE (shift_id, creadora_id),
  CONSTRAINT fk_creadora_member_shift FOREIGN KEY (shift_id) REFERENCES creadora_shifts(id),
  CONSTRAINT fk_creadora_member_creadora FOREIGN KEY (creadora_id) REFERENCES creadoras(id)
);

CREATE INDEX IF NOT EXISTS idx_creadora_shift_member_creadora ON creadora_shift_members (creadora_id, shift_id);

INSERT OR IGNORE INTO creadora_shift_members (shift_id, creadora_id, attended, attendance_at, created_at)
  SELECT id, creadora_id, attended, attendance_at, created_at FROM creadora_shifts;

-- Cada guion y cada contenido puede ser de una creadora concreta, y el guion sabe si ya se grabó.
ALTER TABLE creadora_shift_script ADD COLUMN creadora_id INTEGER NULL;
ALTER TABLE creadora_shift_script ADD COLUMN recorded_at TEXT NULL;
ALTER TABLE creadora_shift_content ADD COLUMN creadora_id INTEGER NULL;

UPDATE creadora_shift_script SET creadora_id = (SELECT s.creadora_id FROM creadora_shifts s WHERE s.id = creadora_shift_script.shift_id) WHERE creadora_id IS NULL;
UPDATE creadora_shift_content SET creadora_id = (SELECT s.creadora_id FROM creadora_shifts s WHERE s.id = creadora_shift_content.shift_id) WHERE creadora_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_creadora_script_creadora ON creadora_shift_script (creadora_id);
CREATE INDEX IF NOT EXISTS idx_creadora_content_creadora ON creadora_shift_content (creadora_id);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('026_creadora_shift_members', CURRENT_TIMESTAMP);
