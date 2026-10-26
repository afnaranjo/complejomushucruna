CREATE TABLE IF NOT EXISTS checklist_marks (board TEXT NOT NULL, item_key TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (board, item_key));
CREATE INDEX IF NOT EXISTS checklist_marks_updated ON checklist_marks (board, updated_at);
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('041_checklist_marks', CURRENT_TIMESTAMP);
