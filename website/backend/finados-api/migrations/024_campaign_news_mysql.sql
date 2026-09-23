-- El tema central de cada tramo de la campaña, que todos los paneles muestran arriba.
CREATE TABLE IF NOT EXISTS campaign_phases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  title VARCHAR(160) NOT NULL,
  detail VARCHAR(300) NOT NULL DEFAULT '',
  accent CHAR(7) NOT NULL DEFAULT '#94165e',
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_campaign_phases_range (starts_on, ends_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_notices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  body VARCHAR(400) NOT NULL,
  starts_on DATE NULL,
  ends_on DATE NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_campaign_notices_range (starts_on, ends_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1', '2026-08-25', '2026-09-02', 'Fundamentos', '', '#e6187d', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());
INSERT IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2', '2026-09-03', '2026-09-16', 'Expectativa + Participación', '', '#f07d1a', 2, UTC_TIMESTAMP(), UTC_TIMESTAMP());
INSERT IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3', '2026-09-17', '2026-10-02', 'Revelación + Preventa', 'Comercial · mixto · feria', '#f5bf2f', 3, UTC_TIMESTAMP(), UTC_TIMESTAMP());
INSERT IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4', '2026-10-03', '2026-10-11', 'Conversión triste', 'Recuerdo', '#14a08a', 4, UTC_TIMESTAMP(), UTC_TIMESTAMP());
INSERT IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5', '2026-10-12', '2026-10-25', 'Orientación familiar emocional', 'Legado y tradición', '#3b6ef5', 5, UTC_TIMESTAMP(), UTC_TIMESTAMP());
INSERT IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6', '2026-10-26', '2026-10-30', 'En vivo · invitación masiva', 'CTA: tu destino Finados', '#e6187d', 6, UTC_TIMESTAMP(), UTC_TIMESTAMP());
INSERT IGNORE INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES ('c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7', '2026-10-31', '2026-11-03', 'Cierre', '', '#f0671a', 7, UTC_TIMESTAMP(), UTC_TIMESTAMP());

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('024_campaign_news', UTC_TIMESTAMP());
