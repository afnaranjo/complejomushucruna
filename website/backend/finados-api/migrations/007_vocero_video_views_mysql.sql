ALTER TABLE vocero_videos ADD COLUMN views_count BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER status;
CREATE INDEX idx_vocero_videos_views ON vocero_videos (views_count, status);
INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('007_vocero_video_views', UTC_TIMESTAMP());
