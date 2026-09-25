CREATE TABLE IF NOT EXISTS production_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  board VARCHAR(20) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#94165e',
  duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_production_items_board (board, archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  board VARCHAR(20) NOT NULL,
  item_id BIGINT UNSIGNED NULL,
  title VARCHAR(160) NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#94165e',
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planificado',
  owner VARCHAR(160) NOT NULL DEFAULT '',
  place VARCHAR(160) NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  canceled_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_production_entries_range (board, starts_at),
  CONSTRAINT fk_production_entry_item FOREIGN KEY (item_id) REFERENCES production_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('032_production_boards', UTC_TIMESTAMP());
