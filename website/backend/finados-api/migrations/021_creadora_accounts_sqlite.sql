PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS creadora_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  email_enc TEXT NOT NULL,
  email_idx TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  privacy_hash TEXT NOT NULL,
  privacy_acknowledged_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS creadora_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_idx TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  attempted_at TEXT NOT NULL
);

-- account_id es nulo porque coordinación puede agregar una creadora antes de que ella tenga cuenta.
CREATE TABLE IF NOT EXISTS creadoras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  account_id INTEGER NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Nuevo',
  origin TEXT NOT NULL DEFAULT 'coordinacion',
  full_name TEXT NOT NULL,
  name_idx TEXT NOT NULL,
  whatsapp_enc TEXT NOT NULL DEFAULT '',
  whatsapp_idx TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  main_network TEXT NOT NULL DEFAULT '',
  social_link TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_by_admin_id INTEGER NULL,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_creadora_account FOREIGN KEY (account_id) REFERENCES creadora_accounts(id),
  CONSTRAINT ck_creadora_origin CHECK (origin IN ('coordinacion', 'cuenta'))
);

CREATE INDEX IF NOT EXISTS idx_creadoras_status ON creadoras (status, full_name);
CREATE INDEX IF NOT EXISTS idx_creadoras_name ON creadoras (name_idx);

CREATE TABLE IF NOT EXISTS creadora_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creadora_id INTEGER NOT NULL,
  consent_type TEXT NOT NULL,
  accepted INTEGER NOT NULL,
  text_version TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  CONSTRAINT fk_creadora_consent FOREIGN KEY (creadora_id) REFERENCES creadoras(id)
);

CREATE TABLE IF NOT EXISTS creadora_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_by_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_creadora_reset_account FOREIGN KEY (account_id) REFERENCES creadora_accounts(id),
  CONSTRAINT fk_creadora_reset_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
);

-- Un turno es una caja del calendario: a quién le toca, qué día y en qué horas.
CREATE TABLE IF NOT EXISTS creadora_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  creadora_id INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  place TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  canceled_at TEXT NULL,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_creadora_shift FOREIGN KEY (creadora_id) REFERENCES creadoras(id)
);

CREATE INDEX IF NOT EXISTS idx_creadora_shifts_range ON creadora_shifts (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_creadora_shifts_creadora ON creadora_shifts (creadora_id, starts_at);

-- Bitácora visible del calendario: quién cambió qué y cómo quedó. Solo se agrega, nunca se edita.
CREATE TABLE IF NOT EXISTS creadora_shift_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NULL,
  creadora_id INTEGER NULL,
  action TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  creadora_name TEXT NOT NULL DEFAULT '',
  before_starts_at TEXT NULL,
  before_ends_at TEXT NULL,
  after_starts_at TEXT NULL,
  after_ends_at TEXT NULL,
  detail TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL,
  CONSTRAINT ck_creadora_log_action CHECK (action IN ('created', 'moved', 'resized', 'reassigned', 'edited', 'canceled', 'restored'))
);

CREATE INDEX IF NOT EXISTS idx_creadora_shift_log_recent ON creadora_shift_log (recorded_at, id);

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('021_creadora_accounts', CURRENT_TIMESTAMP);
