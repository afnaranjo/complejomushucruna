CREATE TABLE IF NOT EXISTS media_tour_people (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  role VARCHAR(120) NOT NULL DEFAULT '',
  phone_enc TEXT NULL,
  note TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Activa',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_media_tour_people_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_tour_visits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  profile_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'entrevista',
  status VARCHAR(20) NOT NULL DEFAULT 'programada',
  place VARCHAR(160) NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  canceled_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_media_tour_visits_range (starts_at, ends_at),
  INDEX idx_media_tour_visits_profile (profile_id, starts_at),
  CONSTRAINT fk_media_tour_visit_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_tour_visit_people (
  visit_id BIGINT UNSIGNED NOT NULL,
  person_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (visit_id, person_id),
  INDEX idx_media_tour_visit_people_person (person_id),
  CONSTRAINT fk_media_tour_member_visit FOREIGN KEY (visit_id) REFERENCES media_tour_visits(id),
  CONSTRAINT fk_media_tour_member_person FOREIGN KEY (person_id) REFERENCES media_tour_people(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('031_media_tour', UTC_TIMESTAMP());
