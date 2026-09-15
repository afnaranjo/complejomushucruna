CREATE TABLE IF NOT EXISTS sheets_outbox (
    submission_id CHAR(32) PRIMARY KEY,
    public_id CHAR(32) NOT NULL,
    payload_enc MEDIUMTEXT NULL,
    state VARCHAR(16) NOT NULL DEFAULT 'pending',
    lease_token CHAR(32) NULL,
    lease_until BIGINT NOT NULL DEFAULT 0,
    next_attempt_at BIGINT NOT NULL DEFAULT 0,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    INDEX idx_sheets_pending (state, next_attempt_at, lease_until),
    CONSTRAINT fk_sheets_submission FOREIGN KEY (submission_id) REFERENCES voceros(submission_id),
    CONSTRAINT fk_sheets_public FOREIGN KEY (public_id) REFERENCES voceros(public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
