ALTER TABLE media_videos ADD COLUMN views_count BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER url_hash;
CREATE INDEX idx_media_videos_views ON media_videos (views_count);
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('010_media_video_views', UTC_TIMESTAMP());
