CREATE TABLE IF NOT EXISTS vocero_video_schedule (
  slot TINYINT UNSIGNED PRIMARY KEY,
  enabled_at DATE NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT ck_vocero_video_schedule_slot CHECK (slot BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO vocero_video_schedule (slot, enabled_at, updated_at) VALUES
  (1, NULL, UTC_TIMESTAMP()),
  (2, NULL, UTC_TIMESTAMP()),
  (3, NULL, UTC_TIMESTAMP()),
  (4, NULL, UTC_TIMESTAMP()),
  (5, NULL, UTC_TIMESTAMP());

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('006_vocero_video_schedule', UTC_TIMESTAMP());
