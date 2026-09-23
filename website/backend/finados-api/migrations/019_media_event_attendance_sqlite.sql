PRAGMA foreign_keys = ON;
ALTER TABLE media_events ADD COLUMN place TEXT NOT NULL DEFAULT '';
ALTER TABLE media_events ADD COLUMN details TEXT NOT NULL DEFAULT '';
ALTER TABLE media_event_coverage ADD COLUMN confirmation TEXT NULL;
ALTER TABLE media_event_coverage ADD COLUMN confirmed_at TEXT NULL;
ALTER TABLE media_event_coverage ADD COLUMN attended TEXT NULL;
UPDATE media_event_coverage SET attended = 'no' WHERE attended IS NULL AND result = 'no_asistio';
UPDATE media_event_coverage SET attended = 'yes' WHERE attended IS NULL AND result IN ('link', 'mencion');
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('019_media_event_attendance', CURRENT_TIMESTAMP);
