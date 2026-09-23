PRAGMA foreign_keys = ON;
ALTER TABLE media_event_coverage ADD COLUMN checked_in_at TEXT NULL;
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('020_media_event_checkin', CURRENT_TIMESTAMP);
