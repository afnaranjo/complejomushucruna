ALTER TABLE media_profiles ADD COLUMN paid_media VARCHAR(3) NOT NULL DEFAULT 'no';
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('016_media_paid', UTC_TIMESTAMP());
