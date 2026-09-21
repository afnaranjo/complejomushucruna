ALTER TABLE media_profiles ADD COLUMN media_types TEXT NOT NULL DEFAULT '';
ALTER TABLE media_profiles ADD COLUMN radio_stations TEXT NULL;
ALTER TABLE media_profiles ADD COLUMN audience_count INTEGER NULL;
ALTER TABLE media_profiles ADD COLUMN radio_genre TEXT NOT NULL DEFAULT '';
ALTER TABLE media_profiles ADD COLUMN tv_channel TEXT NOT NULL DEFAULT '';
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('013_media_types_radio', CURRENT_TIMESTAMP);
