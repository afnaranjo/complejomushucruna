PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vocero_video_schedule (
  slot INTEGER PRIMARY KEY,
  enabled_at TEXT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT ck_vocero_video_schedule_slot CHECK (slot BETWEEN 1 AND 5)
);

INSERT OR IGNORE INTO vocero_video_schedule (slot, enabled_at, updated_at) VALUES
  (1, NULL, CURRENT_TIMESTAMP),
  (2, NULL, CURRENT_TIMESTAMP),
  (3, NULL, CURRENT_TIMESTAMP),
  (4, NULL, CURRENT_TIMESTAMP),
  (5, NULL, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('006_vocero_video_schedule', CURRENT_TIMESTAMP);
