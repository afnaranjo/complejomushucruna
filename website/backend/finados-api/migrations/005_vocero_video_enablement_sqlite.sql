PRAGMA foreign_keys = ON;

ALTER TABLE vocero_progress ADD COLUMN video_slots_configured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocero_videos ADD COLUMN enabled_at TEXT NULL;

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('005_vocero_video_enablement', CURRENT_TIMESTAMP);
