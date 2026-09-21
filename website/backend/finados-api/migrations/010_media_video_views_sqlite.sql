ALTER TABLE media_videos ADD COLUMN views_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_media_videos_views ON media_videos (views_count);
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('010_media_video_views', CURRENT_TIMESTAMP);
