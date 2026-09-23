-- Check-in del día del evento: el medio escanea el QR y confirma que llegó.
ALTER TABLE media_event_coverage ADD COLUMN checked_in_at DATETIME NULL;
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('020_media_event_checkin', UTC_TIMESTAMP());
