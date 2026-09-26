-- Edicion: cada video grabado puede ligarse al guion del que salio y el editor lo marca como editado.
-- Solo agrega columnas: no borra ni cambia guiones, contenidos ni turnos.
ALTER TABLE creadora_shift_content ADD COLUMN script_id INTEGER NULL;
ALTER TABLE creadora_shift_content ADD COLUMN edited_at TEXT NULL;
ALTER TABLE creadora_shift_content ADD COLUMN edited_by TEXT NULL;
ALTER TABLE creadora_shift_content ADD COLUMN edited_url TEXT NOT NULL DEFAULT '';
ALTER TABLE creadora_shift_content ADD COLUMN edit_note TEXT NOT NULL DEFAULT '';
ALTER TABLE creadora_shift_script ADD COLUMN edited_at TEXT NULL;
ALTER TABLE creadora_shift_script ADD COLUMN edited_by TEXT NULL;
ALTER TABLE creadora_shift_script ADD COLUMN edited_url TEXT NOT NULL DEFAULT '';
ALTER TABLE creadora_shift_script ADD COLUMN edit_note TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_creadora_content_script ON creadora_shift_content (script_id);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('033_creadora_editing', CURRENT_TIMESTAMP);
