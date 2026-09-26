-- Edicion: cada video grabado puede ligarse al guion del que salio y el editor lo marca como editado.
-- Solo agrega columnas: no borra ni cambia guiones, contenidos ni turnos.
ALTER TABLE creadora_shift_content ADD COLUMN script_id BIGINT UNSIGNED NULL, ADD COLUMN edited_at DATETIME NULL, ADD COLUMN edited_by VARCHAR(120) NULL, ADD COLUMN edited_url VARCHAR(500) NOT NULL DEFAULT '', ADD COLUMN edit_note VARCHAR(1000) NOT NULL DEFAULT '';
ALTER TABLE creadora_shift_script ADD COLUMN edited_at DATETIME NULL, ADD COLUMN edited_by VARCHAR(120) NULL, ADD COLUMN edited_url VARCHAR(500) NOT NULL DEFAULT '', ADD COLUMN edit_note VARCHAR(1000) NOT NULL DEFAULT '';

CREATE INDEX idx_creadora_content_script ON creadora_shift_content (script_id);

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('033_creadora_editing', UTC_TIMESTAMP());
