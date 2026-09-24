ALTER TABLE mfs_profiles ADD COLUMN cedula_enc TEXT NULL;
ALTER TABLE mfs_profiles ADD COLUMN cedula_idx TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_mfs_profiles_cedula ON mfs_profiles (cedula_idx);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('029_mfs_cedula', CURRENT_TIMESTAMP);
