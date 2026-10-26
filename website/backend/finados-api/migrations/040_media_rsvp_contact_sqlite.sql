PRAGMA foreign_keys = ON;
ALTER TABLE media_event_coverage ADD COLUMN rsvp_contact_name TEXT NULL;
ALTER TABLE media_event_coverage ADD COLUMN rsvp_contact_phone_enc TEXT NULL;
ALTER TABLE media_event_coverage ADD COLUMN rsvp_via TEXT NULL;
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('040_media_rsvp_contact', CURRENT_TIMESTAMP);
