-- Usuarios del panel con roles: cada persona entra con su propia cuenta y solo ve los modulos de su rol.
-- Solo agrega tablas y columnas. La cuenta admin existente queda con el rol Administracion, que ve todo.
CREATE TABLE IF NOT EXISTS admin_roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(240) NOT NULL DEFAULT '',
  modules TEXT NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE admin_users ADD COLUMN role_id BIGINT UNSIGNED NULL, ADD COLUMN full_name VARCHAR(160) NOT NULL DEFAULT '', ADD COLUMN created_by_admin_id BIGINT UNSIGNED NULL;
CREATE INDEX idx_admin_users_role ON admin_users (role_id);

CREATE TABLE IF NOT EXISTS admin_setup_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_admin_setup_user (admin_user_id),
  CONSTRAINT fk_admin_setup_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO admin_roles (public_id, name, description, modules, is_system, created_at, updated_at) VALUES
  ('a0000000000000000000000000000001', 'Administración', 'Ve y administra todo, incluidos los usuarios.', '["*"]', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  ('a0000000000000000000000000000002', 'Comunicación', 'Solo Medios.', '["medios"]', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  ('a0000000000000000000000000000003', 'Community', 'Solo Creadoras.', '["creadoras"]', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  ('a0000000000000000000000000000004', 'Producción', 'Solo Producción.', '["produccion"]', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP());

UPDATE admin_users SET role_id = (SELECT id FROM admin_roles WHERE public_id = 'a0000000000000000000000000000001'), full_name = 'Administración' WHERE username = 'admin' AND role_id IS NULL;

INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES ('034_admin_roles', UTC_TIMESTAMP());
