CREATE TABLE IF NOT EXISTS media_tour_people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  phone_enc TEXT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Activa',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_tour_people_status ON media_tour_people (status);

CREATE TABLE IF NOT EXISTS media_tour_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  profile_id INTEGER NOT NULL REFERENCES media_profiles(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'entrevista',
  status TEXT NOT NULL DEFAULT 'programada',
  place TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  canceled_at TEXT NULL,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_tour_visits_range ON media_tour_visits (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_media_tour_visits_profile ON media_tour_visits (profile_id, starts_at);

CREATE TABLE IF NOT EXISTS media_tour_visit_people (
  visit_id INTEGER NOT NULL REFERENCES media_tour_visits(id),
  person_id INTEGER NOT NULL REFERENCES media_tour_people(id),
  PRIMARY KEY (visit_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_media_tour_visit_people_person ON media_tour_visit_people (person_id);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('031_media_tour', CURRENT_TIMESTAMP);
