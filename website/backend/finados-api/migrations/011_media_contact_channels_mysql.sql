ALTER TABLE media_profiles ADD COLUMN contact_name_enc TEXT NULL, ADD COLUMN facebook VARCHAR(300) NOT NULL DEFAULT '', ADD COLUMN instagram VARCHAR(300) NOT NULL DEFAULT '', ADD COLUMN tiktok VARCHAR(300) NOT NULL DEFAULT '', ADD COLUMN youtube VARCHAR(300) NOT NULL DEFAULT '', ADD COLUMN website VARCHAR(300) NOT NULL DEFAULT '', ADD COLUMN other_link VARCHAR(300) NOT NULL DEFAULT '';
CREATE INDEX idx_media_profiles_location ON media_profiles (province, city);
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('011_media_contact_channels', UTC_TIMESTAMP());
