CREATE TABLE IF NOT EXISTS vocero_progress (
  vocero_id BIGINT UNSIGNED PRIMARY KEY,
  followers_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  traffic_light VARCHAR(12) NOT NULL DEFAULT 'red',
  videos_unlocked TINYINT UNSIGNED NOT NULL DEFAULT 0,
  kit_status VARCHAR(16) NOT NULL DEFAULT 'pendiente',
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_vocero_progress_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id) ON DELETE CASCADE,
  CONSTRAINT ck_vocero_progress_level CHECK (level BETWEEN 0 AND 6),
  CONSTRAINT ck_vocero_progress_light CHECK (traffic_light IN ('red', 'yellow', 'green')),
  CONSTRAINT ck_vocero_progress_videos CHECK (videos_unlocked BETWEEN 0 AND 5),
  CONSTRAINT ck_vocero_progress_kit CHECK (kit_status IN ('pendiente', 'retirado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vocero_videos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vocero_id BIGINT UNSIGNED NOT NULL,
  slot TINYINT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'empty',
  submitted_at DATETIME NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_vocero_video_slot (vocero_id, slot),
  INDEX idx_vocero_videos_vocero (vocero_id, slot),
  CONSTRAINT fk_vocero_video_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id) ON DELETE CASCADE,
  CONSTRAINT ck_vocero_video_slot CHECK (slot BETWEEN 1 AND 5),
  CONSTRAINT ck_vocero_video_status CHECK (status IN ('empty', 'submitted', 'approved', 'rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO vocero_progress (vocero_id, updated_at)
  SELECT id, UTC_TIMESTAMP() FROM voceros;
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('004_vocero_progress', UTC_TIMESTAMP());
