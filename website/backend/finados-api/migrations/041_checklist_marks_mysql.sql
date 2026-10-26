-- Marcas del checklist público de coordinación (inauguración). Tabla nueva; no toca datos existentes.
CREATE TABLE IF NOT EXISTS checklist_marks (board VARCHAR(40) NOT NULL, item_key VARCHAR(80) NOT NULL, value VARCHAR(1200) NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY (board, item_key), KEY checklist_marks_updated (board, updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('041_checklist_marks', UTC_TIMESTAMP());
