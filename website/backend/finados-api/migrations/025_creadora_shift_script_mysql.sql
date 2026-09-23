-- El cuaderno del turno: la referencia de lo que se va a grabar y el guion de lo que se va a hacer.
CREATE TABLE IF NOT EXISTS creadora_shift_script (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  shift_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  reference_url VARCHAR(500) NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_creadora_script_shift (shift_id, position, id),
  CONSTRAINT fk_creadora_script_shift FOREIGN KEY (shift_id) REFERENCES creadora_shifts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('025_creadora_shift_script', UTC_TIMESTAMP());
