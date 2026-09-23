CREATE TABLE IF NOT EXISTS campaign_phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '#94165e',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaign_phases_range ON campaign_phases (starts_on, ends_on);

CREATE TABLE IF NOT EXISTS campaign_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  starts_on TEXT NULL,
  ends_on TEXT NULL,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1', '2026-08-25', '2026-09-02', 'Fundamentos', '', '#e6187d', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2', '2026-09-03', '2026-09-16', 'Expectativa + Participación', '', '#f07d1a', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3', '2026-09-17', '2026-10-02', 'Revelación + Preventa', 'Comercial · mixto · feria', '#f5bf2f', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4', '2026-10-03', '2026-10-11', 'Conversión triste', 'Recuerdo', '#14a08a', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5', '2026-10-12', '2026-10-25', 'Orientación familiar emocional', 'Legado y tradición', '#3b6ef5', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6', '2026-10-26', '2026-10-30', 'En vivo · invitación masiva', 'CTA: tu destino Finados', '#e6187d', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7', '2026-10-31', '2026-11-03', 'Cierre', '', '#f0671a', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('024_campaign_news', CURRENT_TIMESTAMP);
