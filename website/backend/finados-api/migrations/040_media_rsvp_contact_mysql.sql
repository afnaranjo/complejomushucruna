-- Confirmación directa de medios sin cuenta: responsable del día y por dónde llegó la respuesta.
ALTER TABLE media_event_coverage ADD COLUMN rsvp_contact_name VARCHAR(160) NULL, ADD COLUMN rsvp_contact_phone_enc TEXT NULL, ADD COLUMN rsvp_via VARCHAR(16) NULL;
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('040_media_rsvp_contact', UTC_TIMESTAMP());
