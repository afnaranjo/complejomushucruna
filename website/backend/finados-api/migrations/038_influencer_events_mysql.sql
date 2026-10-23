ALTER TABLE influencer_event
  ADD COLUMN slug VARCHAR(64) NOT NULL DEFAULT 'guaynaa' AFTER id,
  ADD UNIQUE INDEX idx_influencer_event_slug (slug);

ALTER TABLE influencer_guests
  ADD COLUMN event_id TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD COLUMN message_variant VARCHAR(10) NOT NULL DEFAULT 'registro' AFTER kind,
  ADD INDEX idx_influencer_guests_event_kind (event_id, kind, archived_at),
  ADD INDEX idx_influencer_guests_event_whatsapp (event_id, whatsapp_lookup, archived_at);

INSERT IGNORE INTO influencer_event (id, slug, title, event_date, event_time, place, details, updated_at)
  VALUES (2, 'inauguracion', 'Inauguración Oficial de Finados Mushuc Runa', '2026-10-30', '12:00', 'Complejo Intercultural y Deportivo Mushuc Runa · Santa Lucía, Tisaleo · Panamericana Sur km 12, vía Ambato–Riobamba', '', UTC_TIMESTAMP());

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('038_influencer_events', UTC_TIMESTAMP());
