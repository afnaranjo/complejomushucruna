ALTER TABLE media_profiles ADD COLUMN paid_media TEXT NOT NULL DEFAULT 'no';
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('016_media_paid', CURRENT_TIMESTAMP);
