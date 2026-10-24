-- Confirmación de asistencia de medios con plazo y datos de transmisión en vivo.
ALTER TABLE media_events ADD COLUMN rsvp_deadline DATETIME NULL;
ALTER TABLE media_event_coverage ADD COLUMN live_stream VARCHAR(10) NULL, ADD COLUMN live_channels TEXT NULL, ADD COLUMN live_detail VARCHAR(300) NULL, ADD COLUMN conditions_at DATETIME NULL;
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('039_media_event_rsvp', UTC_TIMESTAMP());
