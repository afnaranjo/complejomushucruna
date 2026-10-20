CREATE TABLE IF NOT EXISTS golden_passes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  cedula_enc TEXT NOT NULL,
  cedula_idx CHAR(64) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'valido',
  note TEXT NOT NULL,
  archived_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_golden_passes_cedula (cedula_idx, archived_at),
  INDEX idx_golden_passes_archived (archived_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('037_golden_pass', UTC_TIMESTAMP());
