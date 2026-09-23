-- SQLite cannot relax NOT NULL in place: the table is rebuilt with account_id nullable. Test databases are empty at this point.
PRAGMA foreign_keys = OFF;

CREATE TABLE media_profiles_v018 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  account_id INTEGER NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Nuevo',
  media_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  frequency_channel TEXT NOT NULL,
  program_name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  contract TEXT NOT NULL,
  people_count INTEGER NOT NULL,
  team_enc TEXT NOT NULL,
  phone_enc TEXT NOT NULL,
  contact_email_enc TEXT NOT NULL,
  conditions_version TEXT NOT NULL,
  conditions_hash TEXT NOT NULL,
  conditions_accepted_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  social_link TEXT NOT NULL DEFAULT '',
  contact_name_enc TEXT NULL,
  facebook TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  tiktok TEXT NOT NULL DEFAULT '',
  youtube TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  other_link TEXT NOT NULL DEFAULT '',
  media_types TEXT NOT NULL DEFAULT '',
  radio_stations TEXT NULL,
  audience_count INTEGER NULL,
  radio_genre TEXT NOT NULL DEFAULT '',
  tv_channel TEXT NOT NULL DEFAULT '',
  channels TEXT NULL,
  tv_channels TEXT NULL,
  traffic_light TEXT NOT NULL DEFAULT 'red',
  paid_media TEXT NOT NULL DEFAULT 'no',
  origin TEXT NOT NULL DEFAULT 'cuenta',
  representatives TEXT NULL,
  followers_validated INTEGER NULL,
  claim_account_id INTEGER NULL,
  claim_requested_at TEXT NULL,
  CONSTRAINT fk_media_profile_account FOREIGN KEY (account_id) REFERENCES media_accounts(id)
);

INSERT INTO media_profiles_v018 (id, public_id, account_id, status, media_name, media_type, frequency_channel, program_name, program_type, province, city, contract, people_count, team_enc, phone_enc, contact_email_enc, conditions_version, conditions_hash, conditions_accepted_at, submitted_at, updated_at, social_link, contact_name_enc, facebook, instagram, tiktok, youtube, website, other_link, media_types, radio_stations, audience_count, radio_genre, tv_channel, channels, tv_channels, traffic_light, paid_media)
  SELECT id, public_id, account_id, status, media_name, media_type, frequency_channel, program_name, program_type, province, city, contract, people_count, team_enc, phone_enc, contact_email_enc, conditions_version, conditions_hash, conditions_accepted_at, submitted_at, updated_at, social_link, contact_name_enc, facebook, instagram, tiktok, youtube, website, other_link, media_types, radio_stations, audience_count, radio_genre, tv_channel, channels, tv_channels, traffic_light, paid_media FROM media_profiles;

DROP TABLE media_profiles;
ALTER TABLE media_profiles_v018 RENAME TO media_profiles;
CREATE INDEX IF NOT EXISTS idx_media_profiles_location ON media_profiles (province, city);

CREATE TABLE IF NOT EXISTS media_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  event_date TEXT NULL,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_event_coverage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  contracted TEXT NULL,
  result TEXT NOT NULL DEFAULT 'pendiente',
  people_count INTEGER NOT NULL DEFAULT 0,
  links TEXT NULL,
  note TEXT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, profile_id),
  CONSTRAINT fk_media_coverage_event FOREIGN KEY (event_id) REFERENCES media_events(id),
  CONSTRAINT fk_media_coverage_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id)
);

CREATE TABLE IF NOT EXISTS media_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_by_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_media_invitation_profile FOREIGN KEY (profile_id) REFERENCES media_profiles(id),
  CONSTRAINT fk_media_invitation_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
);

PRAGMA foreign_keys = ON;
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('018_media_coverage', CURRENT_TIMESTAMP);
