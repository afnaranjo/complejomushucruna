ALTER TABLE media_profiles ADD COLUMN traffic_light TEXT NOT NULL DEFAULT 'red';
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('015_media_traffic_light', CURRENT_TIMESTAMP);
