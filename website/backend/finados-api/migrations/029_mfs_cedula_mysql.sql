ALTER TABLE mfs_profiles
  ADD COLUMN cedula_enc TEXT NULL,
  ADD COLUMN cedula_idx CHAR(64) NULL,
  ADD INDEX idx_mfs_profiles_cedula (cedula_idx);

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('029_mfs_cedula', UTC_TIMESTAMP());
