ALTER TABLE media_profiles ADD COLUMN media_types VARCHAR(120) NOT NULL DEFAULT '', ADD COLUMN radio_stations TEXT NULL, ADD COLUMN audience_count BIGINT UNSIGNED NULL, ADD COLUMN radio_genre VARCHAR(60) NOT NULL DEFAULT '', ADD COLUMN tv_channel VARCHAR(120) NOT NULL DEFAULT '';
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('013_media_types_radio', UTC_TIMESTAMP());
