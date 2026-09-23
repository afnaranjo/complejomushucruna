-- Un turno puede reunir a varias creadoras en la misma caja, y cada una marca su propia asistencia.
CREATE TABLE IF NOT EXISTS creadora_shift_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_id BIGINT UNSIGNED NOT NULL,
  creadora_id BIGINT UNSIGNED NOT NULL,
  attended VARCHAR(3) NULL,
  attendance_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_creadora_shift_member (shift_id, creadora_id),
  INDEX idx_creadora_shift_member_creadora (creadora_id, shift_id),
  CONSTRAINT fk_creadora_member_shift FOREIGN KEY (shift_id) REFERENCES creadora_shifts(id),
  CONSTRAINT fk_creadora_member_creadora FOREIGN KEY (creadora_id) REFERENCES creadoras(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO creadora_shift_members (shift_id, creadora_id, attended, attendance_at, created_at)
  SELECT id, creadora_id, attended, attendance_at, created_at FROM creadora_shifts;

-- Cada guion y cada contenido puede ser de una creadora concreta, y el guion sabe si ya se grabó.
ALTER TABLE creadora_shift_script ADD COLUMN creadora_id BIGINT UNSIGNED NULL, ADD COLUMN recorded_at DATETIME NULL;
ALTER TABLE creadora_shift_content ADD COLUMN creadora_id BIGINT UNSIGNED NULL;

UPDATE creadora_shift_script g JOIN creadora_shifts s ON s.id = g.shift_id SET g.creadora_id = s.creadora_id WHERE g.creadora_id IS NULL;
UPDATE creadora_shift_content k JOIN creadora_shifts s ON s.id = k.shift_id SET k.creadora_id = s.creadora_id WHERE k.creadora_id IS NULL;

CREATE INDEX idx_creadora_script_creadora ON creadora_shift_script (creadora_id);
CREATE INDEX idx_creadora_content_creadora ON creadora_shift_content (creadora_id);

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('026_creadora_shift_members', UTC_TIMESTAMP());
