-- La ficha guarda ahora los datos de identidad y contacto de la persona.
ALTER TABLE creadoras ADD COLUMN cedula_enc TEXT NOT NULL DEFAULT '';
ALTER TABLE creadoras ADD COLUMN cedula_idx TEXT NOT NULL DEFAULT '';
ALTER TABLE creadoras ADD COLUMN birth_date_enc TEXT NOT NULL DEFAULT '';
ALTER TABLE creadoras ADD COLUMN contact_email_enc TEXT NOT NULL DEFAULT '';
ALTER TABLE creadoras ADD COLUMN tiktok TEXT NOT NULL DEFAULT '';
ALTER TABLE creadoras ADD COLUMN instagram TEXT NOT NULL DEFAULT '';
ALTER TABLE creadoras ADD COLUMN facebook TEXT NOT NULL DEFAULT '';
ALTER TABLE creadoras ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_creadoras_cedula ON creadoras (cedula_idx);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('022_creadora_identity', CURRENT_TIMESTAMP);
