CREATE TABLE IF NOT EXISTS influencer_event (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO influencer_event (id, title, event_date, event_time, place, details, updated_at)
  VALUES (1, 'Lanzamiento Guaynaa', '2026-10-15', '', 'Juan Montalvo y 12 de Noviembre, Ambato, Ecuador', '', CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS influencer_guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  invite_token TEXT NULL UNIQUE,
  full_name TEXT NOT NULL,
  whatsapp_enc TEXT NULL,
  whatsapp_lookup TEXT NULL,
  social_link TEXT NOT NULL DEFAULT '',
  followers INTEGER NULL,
  city TEXT NOT NULL DEFAULT '',
  response TEXT NOT NULL DEFAULT 'pendiente',
  responded_at TEXT NULL,
  opened_at TEXT NULL,
  approval TEXT NOT NULL DEFAULT 'aprobado',
  note TEXT NOT NULL DEFAULT '',
  consent_at TEXT NULL,
  ip_hash TEXT NULL,
  archived_at TEXT NULL,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_influencer_guests_kind ON influencer_guests (kind, archived_at);
CREATE INDEX IF NOT EXISTS idx_influencer_guests_whatsapp ON influencer_guests (whatsapp_lookup);
CREATE INDEX IF NOT EXISTS idx_influencer_guests_ip ON influencer_guests (ip_hash, created_at);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('036_influencer_invitations', CURRENT_TIMESTAMP);
