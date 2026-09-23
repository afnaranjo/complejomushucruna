ALTER TABLE creadoras ADD COLUMN cedula_enc TEXT NOT NULL, ADD COLUMN cedula_idx CHAR(64) NOT NULL DEFAULT '', ADD COLUMN birth_date_enc TEXT NOT NULL, ADD COLUMN contact_email_enc TEXT NOT NULL, ADD COLUMN tiktok VARCHAR(400) NOT NULL DEFAULT '', ADD COLUMN instagram VARCHAR(400) NOT NULL DEFAULT '', ADD COLUMN facebook VARCHAR(400) NOT NULL DEFAULT '', ADD COLUMN followers_count BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE creadoras ADD INDEX idx_creadoras_cedula (cedula_idx);
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('022_creadora_identity', UTC_TIMESTAMP());
