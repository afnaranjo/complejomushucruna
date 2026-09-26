-- Usuarios del panel con roles: cada persona entra con su propia cuenta y solo ve los modulos de su rol.
-- Solo agrega tablas y columnas. La cuenta admin existente queda con el rol Administracion, que ve todo.
CREATE TABLE IF NOT EXISTS admin_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  modules TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE admin_users ADD COLUMN role_id INTEGER NULL;
ALTER TABLE admin_users ADD COLUMN full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE admin_users ADD COLUMN created_by_admin_id INTEGER NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users (role_id);

CREATE TABLE IF NOT EXISTS admin_setup_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT NULL,
  created_by_admin_id INTEGER NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_admin_setup_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
);
CREATE INDEX IF NOT EXISTS idx_admin_setup_user ON admin_setup_tokens (admin_user_id);

INSERT OR IGNORE INTO admin_roles (public_id, name, description, modules, is_system, created_at, updated_at) VALUES
  ('a0000000000000000000000000000001', 'Administración', 'Ve y administra todo, incluidos los usuarios.', '["*"]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a0000000000000000000000000000002', 'Comunicación', 'Solo Medios.', '["medios"]', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a0000000000000000000000000000003', 'Community', 'Solo Creadoras.', '["creadoras"]', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a0000000000000000000000000000004', 'Producción', 'Solo Producción.', '["produccion"]', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE admin_users SET role_id = (SELECT id FROM admin_roles WHERE public_id = 'a0000000000000000000000000000001'), full_name = 'Administración' WHERE username = 'admin' AND role_id IS NULL;

INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('034_admin_roles', CURRENT_TIMESTAMP);
