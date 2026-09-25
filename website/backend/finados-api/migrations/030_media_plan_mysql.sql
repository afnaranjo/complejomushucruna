CREATE TABLE IF NOT EXISTS media_plan (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  data_json MEDIUMTEXT NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT chk_media_plan_single CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('030_media_plan', UTC_TIMESTAMP());
