ALTER TABLE media_profiles ADD COLUMN traffic_light VARCHAR(10) NOT NULL DEFAULT 'red';
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('015_media_traffic_light', UTC_TIMESTAMP());
