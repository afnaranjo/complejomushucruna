ALTER TABLE media_profiles ADD COLUMN contact_name_enc TEXT NULL;
ALTER TABLE media_profiles ADD COLUMN facebook TEXT NOT NULL DEFAULT '';
ALTER TABLE media_profiles ADD COLUMN instagram TEXT NOT NULL DEFAULT '';
ALTER TABLE media_profiles ADD COLUMN tiktok TEXT NOT NULL DEFAULT '';
ALTER TABLE media_profiles ADD COLUMN youtube TEXT NOT NULL DEFAULT '';
ALTER TABLE media_profiles ADD COLUMN website TEXT NOT NULL DEFAULT '';
ALTER TABLE media_profiles ADD COLUMN other_link TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_media_profiles_location ON media_profiles (province, city);
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('011_media_contact_channels', CURRENT_TIMESTAMP);
