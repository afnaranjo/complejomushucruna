PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vocero_progress (
  vocero_id INTEGER PRIMARY KEY,
  followers_count INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  traffic_light TEXT NOT NULL DEFAULT 'red',
  videos_unlocked INTEGER NOT NULL DEFAULT 0,
  kit_status TEXT NOT NULL DEFAULT 'pendiente',
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_vocero_progress_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id) ON DELETE CASCADE,
  CONSTRAINT ck_vocero_progress_level CHECK (level BETWEEN 0 AND 6),
  CONSTRAINT ck_vocero_progress_light CHECK (traffic_light IN ('red', 'yellow', 'green')),
  CONSTRAINT ck_vocero_progress_videos CHECK (videos_unlocked BETWEEN 0 AND 5),
  CONSTRAINT ck_vocero_progress_kit CHECK (kit_status IN ('pendiente', 'retirado'))
);

CREATE TABLE IF NOT EXISTS vocero_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocero_id INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'empty',
  submitted_at TEXT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_vocero_video_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id) ON DELETE CASCADE,
  CONSTRAINT uq_vocero_video_slot UNIQUE (vocero_id, slot),
  CONSTRAINT ck_vocero_video_slot CHECK (slot BETWEEN 1 AND 5),
  CONSTRAINT ck_vocero_video_status CHECK (status IN ('empty', 'submitted', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_vocero_videos_vocero ON vocero_videos (vocero_id, slot);
INSERT OR IGNORE INTO vocero_progress (vocero_id, updated_at)
  SELECT id, CURRENT_TIMESTAMP FROM voceros;
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('004_vocero_progress', CURRENT_TIMESTAMP);
