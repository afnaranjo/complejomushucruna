ALTER TABLE vocero_progress ADD COLUMN video_slots_configured TINYINT(1) NOT NULL DEFAULT 0 AFTER videos_unlocked;
ALTER TABLE vocero_videos ADD COLUMN enabled_at DATE NULL AFTER updated_at;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('005_vocero_video_enablement', UTC_TIMESTAMP());
