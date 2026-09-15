CREATE TABLE IF NOT EXISTS sheets_outbox (
    submission_id TEXT PRIMARY KEY REFERENCES voceros(submission_id),
    public_id TEXT NOT NULL REFERENCES voceros(public_id),
    payload_enc TEXT,
    state TEXT NOT NULL DEFAULT 'pending',
    lease_token TEXT,
    lease_until INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sheets_pending ON sheets_outbox(state, next_attempt_at, lease_until);
