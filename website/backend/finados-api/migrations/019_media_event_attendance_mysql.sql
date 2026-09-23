-- Attendance per event: the medium confirms from its portal, coordination records who actually attended.
ALTER TABLE media_events ADD COLUMN place VARCHAR(160) NOT NULL DEFAULT '', ADD COLUMN details VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE media_event_coverage ADD COLUMN confirmation VARCHAR(3) NULL, ADD COLUMN confirmed_at DATETIME NULL, ADD COLUMN attended VARCHAR(3) NULL;
UPDATE media_event_coverage SET attended = 'no' WHERE attended IS NULL AND result = 'no_asistio';
UPDATE media_event_coverage SET attended = 'yes' WHERE attended IS NULL AND result IN ('link', 'mencion');
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('019_media_event_attendance', UTC_TIMESTAMP());
