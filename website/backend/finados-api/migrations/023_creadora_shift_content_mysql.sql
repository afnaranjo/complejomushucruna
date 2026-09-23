-- El turno guarda ahora lo que pasó: si la creadora asistió y qué contenido se grabó.
ALTER TABLE creadora_shifts ADD COLUMN attended VARCHAR(3) NULL, ADD COLUMN attendance_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS creadora_shift_content (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  shift_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(16) NOT NULL,
  title VARCHAR(200) NOT NULL,
  url VARCHAR(500) NOT NULL DEFAULT '',
  note VARCHAR(400) NOT NULL DEFAULT '',
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_creadora_content_shift (shift_id, created_at),
  CONSTRAINT fk_creadora_content_shift FOREIGN KEY (shift_id) REFERENCES creadora_shifts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('023_creadora_shift_content', UTC_TIMESTAMP());
