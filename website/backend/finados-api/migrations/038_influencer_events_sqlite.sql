ALTER TABLE influencer_event ADD COLUMN slug TEXT NOT NULL DEFAULT 'guaynaa';
CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_event_slug ON influencer_event (slug);

ALTER TABLE influencer_guests ADD COLUMN event_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE influencer_guests ADD COLUMN message_variant TEXT NOT NULL DEFAULT 'registro';
CREATE INDEX IF NOT EXISTS idx_influencer_guests_event_kind ON influencer_guests (event_id, kind, archived_at);
CREATE INDEX IF NOT EXISTS idx_influencer_guests_event_whatsapp ON influencer_guests (event_id, whatsapp_lookup, archived_at);

INSERT OR IGNORE INTO influencer_event (id, slug, title, event_date, event_time, place, details, updated_at)
  VALUES (2, 'inauguracion', 'Inauguración Oficial de Finados Mushuc Runa', '2026-10-30', '12:00', 'Complejo Intercultural y Deportivo Mushuc Runa · Santa Lucía, Tisaleo · Panamericana Sur km 12, vía Ambato–Riobamba', '', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('038_influencer_events', CURRENT_TIMESTAMP);
