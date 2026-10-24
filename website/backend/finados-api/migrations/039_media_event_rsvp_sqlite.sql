PRAGMA foreign_keys = ON;
ALTER TABLE media_events ADD COLUMN rsvp_deadline TEXT NULL;
ALTER TABLE media_event_coverage ADD COLUMN live_stream TEXT NULL;
ALTER TABLE media_event_coverage ADD COLUMN live_channels TEXT NULL;
ALTER TABLE media_event_coverage ADD COLUMN live_detail TEXT NULL;
ALTER TABLE media_event_coverage ADD COLUMN conditions_at TEXT NULL;
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('039_media_event_rsvp', CURRENT_TIMESTAMP);
