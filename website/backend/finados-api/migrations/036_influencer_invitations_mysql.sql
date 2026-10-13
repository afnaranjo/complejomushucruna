CREATE TABLE IF NOT EXISTS influencer_event (
  id TINYINT UNSIGNED PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  event_date DATE NOT NULL,
  event_time VARCHAR(5) NOT NULL DEFAULT '',
  place VARCHAR(240) NOT NULL,
  details TEXT NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO influencer_event (id, title, event_date, event_time, place, details, updated_at)
  VALUES (1, 'Lanzamiento Guaynaa', '2026-10-15', '', 'Juan Montalvo y 12 de Noviembre, Ambato, Ecuador', '', UTC_TIMESTAMP());

CREATE TABLE IF NOT EXISTS influencer_guests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  kind VARCHAR(10) NOT NULL,
  invite_token CHAR(32) NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  whatsapp_enc TEXT NULL,
  whatsapp_lookup CHAR(64) NULL,
  social_link VARCHAR(500) NOT NULL DEFAULT '',
  followers INT UNSIGNED NULL,
  city VARCHAR(120) NOT NULL DEFAULT '',
  response VARCHAR(10) NOT NULL DEFAULT 'pendiente',
  responded_at DATETIME NULL,
  opened_at DATETIME NULL,
  approval VARCHAR(10) NOT NULL DEFAULT 'aprobado',
  note TEXT NOT NULL,
  consent_at DATETIME NULL,
  ip_hash CHAR(64) NULL,
  archived_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_influencer_guests_kind (kind, archived_at),
  INDEX idx_influencer_guests_whatsapp (whatsapp_lookup),
  INDEX idx_influencer_guests_ip (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('036_influencer_invitations', UTC_TIMESTAMP());
