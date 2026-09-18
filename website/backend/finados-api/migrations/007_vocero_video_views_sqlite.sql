ALTER TABLE vocero_videos ADD COLUMN views_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_vocero_videos_views ON vocero_videos (views_count, status);
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('007_vocero_video_views', CURRENT_TIMESTAMP);
