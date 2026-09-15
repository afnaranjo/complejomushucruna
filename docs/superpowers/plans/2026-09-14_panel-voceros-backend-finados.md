---
titulo: "Plan de implementación del panel y backend de Voceros"
responsable: "Alex Naranjo"
estado: aprobado
ultima_actualizacion: 2026-09-14
fuente: "diseño aprobado del panel y backend de Voceros"
confidencialidad: interno
---

# Panel y backend de Voceros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un panel funcional en `complejomushucruna.com/admin/` para administrar los registros de Voceros mediante una API privada en `finados.complejomushucruna.com/api/`, con un usuario inicial `admin` creado de forma segura por SSH.

**Architecture:** El sitio principal conserva su generador estático y añade exclusivamente las rutas y activos administrativos. PHP y MySQL/MariaDB implementan autenticación, consulta, cambios y auditoría; el endpoint público de Voceros escribe en la misma base y mantiene Google Sheets como sincronización secundaria. La API privada usa sesiones de servidor y CORS con credenciales limitado al origen institucional.

**Tech Stack:** Node.js ESM, `node:test`, HTML5, CSS moderno, JavaScript de navegador sin framework, PHP 8.1+, PDO, MySQL/MariaDB, SQLite solo para pruebas locales, Apache/cPanel, SSH y curl.

**Spec:** `docs/superpowers/specs/2026-09-14_panel-voceros-backend-finados-diseno.md`

## Global Constraints

- Solo se modifican el formulario de Voceros, `/admin/`, `/admin/voceros/`, sus activos, la API privada y los scripts/documentos necesarios para probar y desplegar este módulo.
- No se altera la portada, la navegación, el contenido ni el diseño de las demás páginas.
- Todo el frontend permanece en `complejomushucruna.com`; las funciones privadas viven en `finados.complejomushucruna.com/api/`.
- El formulario público conserva un endpoint de mismo origen y MySQL/MariaDB pasa a ser la fuente canónica.
- Google Sheets queda como sincronización secundaria y un fallo suyo no invalida un registro confirmado en MySQL.
- No se guarda ninguna contraseña, hash operativo, llave, cookie, credencial de base de datos o clave de cifrado en Git, HTML, JavaScript, logs de prueba o chat.
- El primer usuario se llama `admin`; su contraseña se establece mediante un prompt oculto por SSH y no existe contraseña predeterminada.
- No hay eliminación física de registros o consentimientos.
- Las rutas administrativas llevan `noindex, nofollow, noarchive` y no se añaden a la navegación pública.
- Ningún despliegue usa `--delete` ni borra archivos remotos exclusivos.

---

## Mapa de archivos

### Frontend

- `website/src/admin/page.mjs`: HTML del login, tablero, listado, filtros y detalle.
- `website/src/admin/admin.css`: sistema visual aislado del panel.
- `website/src/admin/admin.js`: sesión, API, render seguro, filtros, estados, notas y exportación.
- `website/src/pages.mjs`: registra únicamente `/admin/` y `/admin/voceros/`.
- `website/scripts/build.mjs`: copia los dos activos administrativos.
- `website/tests/admin.test.mjs`: comportamiento puro del frontend.
- `website/tests/build.test.mjs`: rutas, metadatos y aislamiento del resto del sitio.

### Backend compartido y privado

- `website/backend/finados-api/src/Config.php`: carga y valida configuración privada.
- `website/backend/finados-api/src/Database.php`: PDO, transacciones y migraciones.
- `website/backend/finados-api/src/Crypto.php`: cifrado AES-256-GCM e índices HMAC.
- `website/backend/finados-api/src/Http.php`: JSON, CORS, cookies, CSRF y errores.
- `website/backend/finados-api/src/Auth.php`: login, sesión, límites y autorización.
- `website/backend/finados-api/src/VocerosRepository.php`: escritura, lectura, filtros, estados, notas y exportación.
- `website/backend/finados-api/src/Audit.php`: auditoría append-only.
- `website/backend/finados-api/src/Router.php`: despacho de rutas privadas.
- `website/backend/finados-api/public/index.php`: único front controller del subdominio.
- `website/backend/finados-api/public/.htaccess`: reescritura a `index.php` y bloqueo de listados.
- `website/backend/finados-api/migrations/001_initial_mysql.sql`: esquema productivo.
- `website/backend/finados-api/migrations/001_initial_sqlite.sql`: esquema equivalente de pruebas.
- `website/backend/finados-api/bin/create-admin.php`: alta o rotación segura de `admin`.
- `website/backend/finados-api/bin/import-voceros.php`: importación idempotente de CSV.
- `website/backend/finados-api/bin/backup.php`: volcado cifrado o delegación segura al mecanismo del hosting.
- `website/backend/finados-api/tests/run.php`: suite PHP sin dependencias externas.

### Integración del formulario y despliegue

- `website/public/api/voceros/index.php`: usa el repositorio MySQL y conserva validación/Sheets.
- `website/public/api/_voceros-bootstrap.php`: carga el núcleo instalado fuera del docroot.
- `website/scripts/deploy-finados-backend.mjs`: prevuelo, respaldo, subida y verificación del subdominio.
- `website/scripts/deploy-cpanel.mjs`: instala el bootstrap público sin sobrescribir configuración privada.
- `website/deploy.env.example`: documenta rutas ficticias del backend, sin datos reales.
- `website/.gitignore`: excluye configuración local y artefactos sensibles del backend.
- `website/README.md`: corrige la descripción del stack y documenta operación segura.

---

### Task 1: Contrato de configuración y entorno PHP

**Files:**
- Create: `website/backend/finados-api/src/Config.php`
- Create: `website/backend/finados-api/tests/Test.php`
- Create: `website/backend/finados-api/tests/config_test.php`
- Create: `website/backend/finados-api/tests/run.php`
- Modify: `website/package.json`
- Modify: `website/.gitignore`

**Interfaces:**
- Produces: `Finados\Config::fromFile(string $path): Config`, `Config::databaseDsn(): string`, `Config::allowedOrigin(): string`, `Config::encryptionKey(): string`, `Config::hmacKey(): string`, `Config::isProduction(): bool`.
- Configuration path in production: `FINADOS_CONFIG_PATH`, validada para que resuelva fuera de `public_html`; el ejemplo versionado usa `/home/usuario_cpanel/private-data/finados-backend.json`, mode `0600`.

- [ ] **Step 1: Escribir la prueba fallida del contrato de configuración**

```php
<?php
use Finados\Config;

$path = temp_file(json_encode([
    'environment' => 'test',
    'databaseDsn' => 'sqlite::memory:',
    'databaseUser' => '',
    'databasePassword' => '',
    'allowedOrigin' => 'http://127.0.0.1:4173',
    'encryptionKey' => base64_encode(str_repeat('e', 32)),
    'hmacKey' => base64_encode(str_repeat('h', 32)),
]));
$config = Config::fromFile($path);
same('sqlite::memory:', $config->databaseDsn());
same('http://127.0.0.1:4173', $config->allowedOrigin());
throws(fn() => Config::fromFile(temp_file('{}')), RuntimeException::class);
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el rojo**

Run: `cd website && php backend/finados-api/tests/run.php config_test.php`

Expected: FAIL porque `Finados\Config` todavía no existe.

- [ ] **Step 3: Implementar el cargador estricto**

```php
final class Config
{
    public static function fromFile(string $path): self;
    public function databaseDsn(): string;
    public function databaseUser(): string;
    public function databasePassword(): string;
    public function allowedOrigin(): string;
    public function encryptionKey(): string;
    public function hmacKey(): string;
    public function isProduction(): bool;
}
```

Validar lista exacta de claves, HTTPS en producción, dos claves decodificadas de 32 bytes y DSN limitado a `mysql:` o `sqlite:`. Los mensajes no deben incluir valores privados.

- [ ] **Step 4: Integrar PHP en la suite principal**

```json
{
  "scripts": {
    "test:node": "node --test --test-concurrency=1 tests/*.test.mjs",
    "test:php": "php backend/finados-api/tests/run.php",
    "test": "npm run test:node && npm run test:php"
  }
}
```

Añadir a `.gitignore`: `.env.backend`, `backend/finados-api/var/`, `*finados-backend.json`, `*.sqlite`, `*.sqlite3`, `*.sql.gz` y `*.backup.enc`.

- [ ] **Step 5: Ejecutar pruebas y confirmar verde**

Run: `cd website && npm run test:php`

Expected: PASS, incluida la negativa por configuración incompleta.

- [ ] **Step 6: Commit**

```bash
git add website/package.json website/.gitignore website/backend/finados-api/src/Config.php website/backend/finados-api/tests
git commit -m "Crear configuración segura del backend de Voceros"
```

### Task 2: Base de datos, cifrado y repositorio de Voceros

**Files:**
- Create: `website/backend/finados-api/src/Database.php`
- Create: `website/backend/finados-api/src/Crypto.php`
- Create: `website/backend/finados-api/src/VocerosRepository.php`
- Create: `website/backend/finados-api/src/Audit.php`
- Create: `website/backend/finados-api/migrations/001_initial_mysql.sql`
- Create: `website/backend/finados-api/migrations/001_initial_sqlite.sql`
- Create: `website/backend/finados-api/tests/repository_test.php`

**Interfaces:**
- Produces: `Database::connect(Config $config): PDO`, `Crypto::encrypt(string): string`, `Crypto::decrypt(string): string`, `Crypto::lookup(string): string`.
- Produces: `VocerosRepository::create(array $record, array $consents): string`, `list(array $filters): array`, `find(string $publicId): ?array`, `changeStatus(string $publicId, string $status, int $actorId): void`, `addNote(string $publicId, string $text, int $actorId): void`.

- [ ] **Step 1: Escribir pruebas fallidas de transacción, idempotencia y cifrado**

```php
$id = 'a1b2c3d4e5f60123456789abcdef0123';
$publicId = $repository->create(vocero_fixture(['submission_id' => $id]), consent_fixture($id));
$repeatedPublicId = $repository->create(vocero_fixture(['submission_id' => $id]), consent_fixture($id));
same($publicId, $repeatedPublicId);
same(1, count($repository->list(['search' => '', 'status' => '', 'page' => 1])['items']));
same(3, count($repository->find($publicId)['consents']));
not_contains('0995874566', raw_database_dump($pdo));
same('0995874566', $repository->find($publicId)['whatsapp']);
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el rojo**

Run: `cd website && php backend/finados-api/tests/run.php repository_test.php`

Expected: FAIL por clases y tablas inexistentes.

- [ ] **Step 3: Crear ambos esquemas equivalentes**

El esquema debe crear `admin_users`, `voceros`, `vocero_consents`, `vocero_notes`, `audit_log`, `login_attempts` y `schema_migrations`. `voceros.public_id` y `submission_id` serán únicos; los consentimientos usarán `UNIQUE(vocero_id, consent_type, text_hash)`.

```sql
CREATE TABLE voceros (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  submission_id CHAR(32) NOT NULL UNIQUE,
  status VARCHAR(40) NOT NULL DEFAULT 'Nuevo',
  full_name VARCHAR(160) NOT NULL,
  cedula_enc TEXT NOT NULL,
  cedula_idx CHAR(64) NOT NULL,
  birth_date_enc TEXT NOT NULL,
  age_at_submission TINYINT UNSIGNED NOT NULL,
  whatsapp_enc TEXT NOT NULL,
  whatsapp_idx CHAR(64) NOT NULL,
  email_enc TEXT NOT NULL,
  email_idx CHAR(64) NOT NULL,
  city VARCHAR(100) NOT NULL,
  tiktok VARCHAR(300) NOT NULL DEFAULT '',
  instagram VARCHAR(300) NOT NULL DEFAULT '',
  facebook VARCHAR(300) NOT NULL DEFAULT '',
  main_network VARCHAR(20) NOT NULL,
  previous_participation VARCHAR(60) NOT NULL,
  community_source VARCHAR(80) NOT NULL,
  kit_pickup VARCHAR(80) NOT NULL,
  representative_name_enc TEXT NULL,
  representative_cedula_enc TEXT NULL,
  representative_cedula_idx CHAR(64) NULL,
  representative_phone_enc TEXT NULL,
  representative_phone_idx CHAR(64) NULL,
  representative_email_enc TEXT NULL,
  representative_email_idx CHAR(64) NULL,
  utm_source VARCHAR(180) NOT NULL DEFAULT '',
  utm_medium VARCHAR(180) NOT NULL DEFAULT '',
  utm_campaign VARCHAR(180) NOT NULL DEFAULT '',
  utm_content VARCHAR(180) NOT NULL DEFAULT '',
  utm_term VARCHAR(180) NOT NULL DEFAULT '',
  submitted_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_voceros_status_date (status, submitted_at),
  INDEX idx_voceros_name (full_name),
  INDEX idx_voceros_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocero_consents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vocero_id BIGINT UNSIGNED NOT NULL,
  consent_type VARCHAR(24) NOT NULL,
  accepted TINYINT(1) NOT NULL,
  text_version VARCHAR(80) NOT NULL,
  text_hash CHAR(64) NOT NULL,
  accepted_at DATETIME NOT NULL,
  ip_enc TEXT NOT NULL,
  user_agent VARCHAR(500) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  method VARCHAR(40) NOT NULL,
  UNIQUE KEY uq_vocero_consent (vocero_id, consent_type, text_hash),
  CONSTRAINT fk_consent_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(32) NOT NULL UNIQUE,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocero_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vocero_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_note_vocero FOREIGN KEY (vocero_id) REFERENCES voceros(id),
  CONSTRAINT fk_note_author FOREIGN KEY (author_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(80) NOT NULL,
  subject_type VARCHAR(40) NOT NULL,
  subject_public_id CHAR(32) NULL,
  metadata_json TEXT NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  succeeded TINYINT(1) NOT NULL,
  attempted_at DATETIME NOT NULL,
  INDEX idx_login_window (username_hash, ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schema_migrations (
  version VARCHAR(80) PRIMARY KEY,
  applied_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

El esquema SQLite conservará los mismos nombres, restricciones únicas e índices, reemplazando `AUTO_INCREMENT`, tipos y claves foráneas por sus equivalentes SQLite con `PRAGMA foreign_keys = ON`.

- [ ] **Step 4: Implementar cifrado y repositorio con consultas preparadas**

AES-256-GCM debe generar IV aleatorio por valor y serializar `base64(iv || tag || ciphertext)`. `lookup()` debe normalizar y calcular `hash_hmac('sha256', $value, $hmacKey)` para búsqueda exacta. `create()` debe envolver ficha y tres consentimientos en una única transacción.

- [ ] **Step 5: Ejecutar pruebas y confirmar verde**

Run: `cd website && npm run test:php`

Expected: PASS para cifrado reversible, datos no visibles en volcado, tres consentimientos, rollback e idempotencia.

- [ ] **Step 6: Commit**

```bash
git add website/backend/finados-api
git commit -m "Persistir Voceros con cifrado y auditoría"
```

### Task 3: Convertir MySQL en fuente canónica del formulario público

**Files:**
- Create: `website/public/api/_voceros-bootstrap.php`
- Modify: `website/public/api/voceros/index.php`
- Modify: `website/tests/build.test.mjs`
- Create: `website/backend/finados-api/tests/public_registration_test.php`

**Interfaces:**
- Consumes: `VocerosRepository::create(array $record, array $consents): string`.
- Produces: respuesta `200 { ok: true, registrationId: string, database: "stored", googleSheets: "synced"|"queued" }`.

- [ ] **Step 1: Cambiar las pruebas para exigir DB primero y Sheets secundario**

```js
assert.match(endpoint, /VocerosRepository/);
assert.match(endpoint, /'database'\s*=>\s*'stored'/);
assert.doesNotMatch(endpoint, /\$googleSheetsStatus !== 'synced'[\s\S]*json_response\(503/);
```

```php
$response = submit_fixture($endpoint, ['submission_id' => 'aa11aa11aa11aa11aa11aa11aa11aa11']);
same(200, $response->status);
same('stored', $response->json['database']);
same('queued', $response->json['googleSheets']);
same(1, database_count('voceros'));
```

- [ ] **Step 2: Ejecutar pruebas y confirmar el rojo**

Run Node: `cd website && node --test --test-concurrency=1 --test-name-pattern="Voceros|registro" tests/build.test.mjs`

Run PHP: `cd website && php backend/finados-api/tests/run.php public_registration_test.php`

Expected: FAIL porque Sheets todavía bloquea el éxito y no se usa el repositorio.

- [ ] **Step 3: Implementar el bootstrap compartido y la transacción**

`_voceros-bootstrap.php` debe localizar únicamente la ruta privada definida por configuración del servidor, comprobar que está fuera del docroot y cargar `Config`, `Database`, `Crypto`, `Audit` y `VocerosRepository`. El endpoint conserva todas sus validaciones actuales, crea la ficha en DB, intenta Sheets después y encola el fallo sin devolver error al usuario.

Asignar `Pendiente de autorización` a participantes de 16 o 17 años y `Nuevo` al resto. El ID devuelto al comprobante público continúa siendo el `submission_id`; el `public_id` distinto se reserva para rutas administrativas.

- [ ] **Step 4: Añadir deduplicación y límite de abuso**

Repetir `submission_id` devuelve el mismo éxito sin duplicar. Cédula, correo o WhatsApp ya registrados devuelven `409` con un mensaje genérico. Permitir como máximo cinco envíos reales por índice HMAC de IP en quince minutos, responder `429` con `Retry-After: 900` y mantener el honeypot sin guardar IP completa en listados administrativos.

- [ ] **Step 5: Ejecutar suite completa**

Run: `cd website && npm test`

Expected: todas las pruebas Node y PHP pasan; el formulario conserva campos, consentimientos y comprobante.

- [ ] **Step 6: Commit**

```bash
git add website/public/api website/tests/build.test.mjs website/backend/finados-api/tests/public_registration_test.php
git commit -m "Guardar registros de Voceros en la base propia"
```

### Task 4: Autenticación, sesión y creación segura de `admin`

**Files:**
- Create: `website/backend/finados-api/src/Http.php`
- Create: `website/backend/finados-api/src/Auth.php`
- Create: `website/backend/finados-api/bin/create-admin.php`
- Create: `website/backend/finados-api/tests/auth_test.php`

**Interfaces:**
- Produces: `Auth::login(string $username, string $password, string $ip): array`, `requireUser(): array`, `logout(): void`, `csrfToken(): string`, `verifyCsrf(string $token): void`.
- CLI de prueba: `php bin/create-admin.php --username admin --config /private/tmp/finados-backend-test.json`.

- [ ] **Step 1: Escribir pruebas fallidas de login y sesión**

```php
$adminId = create_admin_fixture('admin', 'Clave-larga-de-prueba-2026!');
$session = $auth->login('admin', 'Clave-larga-de-prueba-2026!', '127.0.0.1');
same($adminId, $session['user']['id']);
truthy(strlen($session['csrf']) >= 32);
throws(fn() => $auth->login('admin', 'incorrecta', '127.0.0.1'), Unauthorized::class);
truthy(login_is_blocked_after_limit('admin', '127.0.0.1'));
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el rojo**

Run: `cd website && php backend/finados-api/tests/run.php auth_test.php`

Expected: FAIL porque no existen `Auth`, sesiones ni limitador.

- [ ] **Step 3: Implementar autenticación segura**

Usar `password_hash` con `PASSWORD_ARGON2ID` cuando `PASSWORD_ARGON2ID` exista y `PASSWORD_BCRYPT` como alternativa. Regenerar el ID de sesión tras login; cookie host-only `HttpOnly`, `Secure` en producción, `SameSite=Strict`, expiración por inactividad de 30 minutos y absoluta de 12 horas. Bloquear durante quince minutos después de cinco intentos fallidos dentro de quince minutos para el mismo par usuario/IP HMAC. Responder siempre `Credenciales incorrectas` para usuario o contraseña inválidos.

- [ ] **Step 4: Implementar el CLI interactivo**

El comando debe aceptar únicamente `admin` en la primera entrega, leer la contraseña dos veces con eco desactivado, exigir mínimo 14 caracteres, insertar o rotar el hash en transacción y escribir solo `Usuario admin creado` o `Contraseña de admin actualizada`.

- [ ] **Step 5: Probar cookies, CSRF, bloqueo y CLI sin secretos**

Run: `cd website && npm run test:php`

Expected: PASS; ninguna salida de prueba contiene la contraseña fixture ni el hash.

- [ ] **Step 6: Commit**

```bash
git add website/backend/finados-api/src website/backend/finados-api/bin/create-admin.php website/backend/finados-api/tests/auth_test.php
git commit -m "Proteger el panel de Voceros con sesión segura"
```

### Task 5: API privada del panel

**Files:**
- Create: `website/backend/finados-api/src/Router.php`
- Create: `website/backend/finados-api/public/index.php`
- Create: `website/backend/finados-api/public/.htaccess`
- Create: `website/backend/finados-api/tests/api_test.php`

**Interfaces:**
- Produces: endpoints definidos en la especificación bajo `/api/`.
- JSON list: `{ items: VoceroSummary[], pagination: { page, pageSize, total, pages } }`.
- JSON error: `{ ok: false, code: string, message: string }`.

- [ ] **Step 1: Escribir pruebas fallidas de autorización y rutas**

```php
same(401, request('GET', '/api/voceros')->status);
same(204, request('OPTIONS', '/api/auth/session', origin: 'https://complejomushucruna.com')->status);
same(403, request('GET', '/api/voceros', origin: 'https://malicioso.example')->status);
$client = authenticated_client('admin');
same(200, $client->get('/api/dashboard')->status);
same(200, $client->get('/api/voceros?page=1&status=Nuevo')->status);
same(422, $client->patch('/api/voceros/abc', ['status' => 'Inventado'])->status);
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el rojo**

Run: `cd website && php backend/finados-api/tests/run.php api_test.php`

Expected: FAIL porque no existen router ni front controller.

- [ ] **Step 3: Implementar CORS y rutas de autenticación**

Responder `Access-Control-Allow-Origin` únicamente cuando `Origin` coincide exactamente con configuración, añadir `Vary: Origin`, `Access-Control-Allow-Credentials: true` y limitar métodos/cabeceras. Login exige token CSRF previo; logout destruye datos y cookie.

- [ ] **Step 4: Implementar dashboard, listado, detalle y mutaciones**

La búsqueda parcial se limita a nombre/ciudad; ID, cédula, teléfono y correo usan coincidencia exacta mediante índice HMAC. Estados válidos: `Nuevo`, `En revisión`, `Aprobado`, `Rechazado`, `Pendiente de autorización`. Notas: 1–2000 caracteres. Toda mutación y exportación requiere CSRF y genera auditoría.

- [ ] **Step 5: Implementar CSV protegido**

CSV UTF-8 con BOM, valores protegidos contra fórmulas que empiecen por `=`, `+`, `-` o `@`, cabeceras de descarga, `Cache-Control: no-store` y entrada de auditoría con filtros y cantidad, nunca con datos completos.

- [ ] **Step 6: Ejecutar suite y confirmar verde**

Run: `cd website && npm run test:php`

Expected: PASS para 401, CORS, paginación, filtros, estados, notas, exportación, CSRF y auditoría.

- [ ] **Step 7: Commit**

```bash
git add website/backend/finados-api
git commit -m "Crear API privada del panel de Voceros"
```

### Task 6: Login y panel estático en el dominio principal

**Files:**
- Create: `website/src/admin/page.mjs`
- Create: `website/src/admin/admin.css`
- Create: `website/src/admin/admin.js`
- Create: `website/tests/admin.test.mjs`
- Modify: `website/src/pages.mjs`
- Modify: `website/scripts/build.mjs`
- Modify: `website/tests/build.test.mjs`

**Interfaces:**
- Produces: `renderAdminLoginPage(page): string`, `renderAdminVocerosPage(page): string`.
- Produces JS exports: `maskId`, `maskPhone`, `normalizeFilters`, `renderSummary`, `createAdminClient`.
- API base: producción `https://finados.complejomushucruna.com/api`, local `http://127.0.0.1:4174/api` mediante meta de entorno generada solo para desarrollo.

- [ ] **Step 1: Escribir pruebas fallidas de rutas e aislamiento**

```js
assert.ok(files.includes('admin/index.html'));
assert.ok(files.includes('admin/voceros/index.html'));
assert.match(login, /<title>Iniciar sesión \| Complejo Mushuc Runa<\/title>/);
assert.match(login, /name="robots" content="noindex, nofollow, noarchive"/);
assert.match(login, />Iniciar sesión<\/button>/);
assert.match(panel, /data-admin-dashboard/);
assert.match(panel, /data-admin-voceros/);
assert.doesNotMatch(home, /href="\/admin\//);
assert.doesNotMatch(sitemap, /\/admin\//);
```

- [ ] **Step 2: Ejecutar pruebas y confirmar el rojo**

Run: `cd website && node --test --test-name-pattern="admin|Iniciar sesión" tests/*.test.mjs`

Expected: FAIL porque las rutas y activos no existen.

- [ ] **Step 3: Crear las páginas sin modificar layouts existentes**

Usar un render dedicado en `admin/page.mjs`; no añadir entradas a `primaryNavigation` ni modificar cuerpos de otras páginas. El login contiene usuario, contraseña, botón mostrar/ocultar, estado accesible y enlace de regreso a Voceros. El panel contiene tarjetas, filtros, tabla, paginación, panel de detalle, selector de estado, notas y exportación.

- [ ] **Step 4: Crear cliente de sesión y render seguro**

```js
export function createAdminClient(baseUrl, fetchImplementation = fetch) {
  const request = (path, options = {}) => fetchImplementation(`${baseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: { Accept: 'application/json', ...options.headers },
  });
  return { request };
}
```

Toda información recibida se inserta con `textContent` y nodos DOM; no usar `innerHTML`, `eval`, tokens en Web Storage ni URLs externas controladas por datos.

- [ ] **Step 5: Implementar experiencia responsive y accesible**

Diseño con línea Finados/Complejo, foco visible, teclado, tabla que se convierte en tarjetas en móvil, `aria-live` para carga/error, diálogo accesible de detalle y `prefers-reduced-motion`. Cédula y teléfono llegan enmascarados al listado.

- [ ] **Step 6: Ejecutar pruebas Node y build**

Run: `cd website && npm run test:node && npm run build && node scripts/check-dist.mjs`

Expected: PASS; dos rutas nuevas, activos presentes, cero enlaces admin en páginas ajenas y cero referencias rotas.

- [ ] **Step 7: Commit**

```bash
git add website/src/admin website/src/pages.mjs website/scripts/build.mjs website/tests
git commit -m "Crear login y panel visual de Voceros"
```

### Task 7: Importación idempotente, backup y operación

**Files:**
- Create: `website/backend/finados-api/bin/import-voceros.php`
- Create: `website/backend/finados-api/bin/backup.php`
- Create: `website/backend/finados-api/tests/import_test.php`
- Create: `website/backend/finados-api/tests/backup_test.php`

**Interfaces:**
- CLI import de prueba: `php bin/import-voceros.php --config /private/tmp/finados-backend-test.json --voceros tests/fixtures/voceros.csv --consents tests/fixtures/consentimientos.csv --dry-run`.
- CLI backup de prueba: `php bin/backup.php --config /private/tmp/finados-backend-test.json --output /private/tmp/finados-backups`.

- [ ] **Step 1: Escribir pruebas fallidas de importación repetible**

```php
$first = run_import($fixtureVoceros, $fixtureConsents);
$second = run_import($fixtureVoceros, $fixtureConsents);
same(['inserted' => 2, 'skipped' => 0, 'errors' => 0], $first);
same(['inserted' => 0, 'skipped' => 2, 'errors' => 0], $second);
same(2, database_count('voceros'));
same(6, database_count('vocero_consents'));
```

- [ ] **Step 2: Ejecutar pruebas y confirmar el rojo**

Run: `cd website && php backend/finados-api/tests/run.php import_test.php backup_test.php`

Expected: FAIL porque los comandos no existen.

- [ ] **Step 3: Implementar `--dry-run` e importación transaccional**

Validar cabeceras exactas, codificación UTF-8/BOM, IDs de 32 hexadecimales y relación de consentimientos. Antes de escribir, crear copia de los CSV en un directorio privado fechado. Reportar solo cantidades y números de línea, nunca cédulas/teléfonos/correos.

Mapear el estado histórico `Registrado` a `Nuevo` y `Pendiente de autorización del representante` a `Pendiente de autorización`; cualquier otro valor detiene esa fila y la reporta sin datos personales.

- [ ] **Step 4: Implementar backup verificable**

En MySQL, invocar `mysqldump` mediante argumentos separados y comprimir fuera del docroot con permisos `0600`; si el hosting no ofrece el binario, fallar con instrucción explícita de usar Backup Wizard de cPanel. Verificar que el archivo no esté vacío y registrar SHA-256 en un manifiesto privado.

- [ ] **Step 5: Ejecutar pruebas y confirmar verde**

Run: `cd website && npm run test:php`

Expected: PASS para dry-run, segunda importación sin duplicados, CSV inválido sin escritura y backup no vacío.

- [ ] **Step 6: Commit**

```bash
git add website/backend/finados-api/bin website/backend/finados-api/tests
git commit -m "Añadir migración y respaldo de registros de Voceros"
```

### Task 8: Despliegue seguro del subdominio y documentación

**Files:**
- Create: `website/scripts/deploy-finados-backend.mjs`
- Modify: `website/scripts/deploy-cpanel.mjs`
- Modify: `website/tests/deploy.test.mjs`
- Modify: `website/deploy.env.example`
- Modify: `website/README.md`
- Modify: `website/package.json`

**Interfaces:**
- Produces scripts: `backend:validate`, `backend:check`, `backend:deploy`, `backend:admin`, `backend:import:check` y `backend:import`.
- Consumes configuración local ignorada y la configuración privada remota; nunca imprime sus valores.

- [ ] **Step 1: Escribir pruebas fallidas del despliegue aislado**

```js
const transport = createRecordingTransport(remoteFixture({
  phpVersion: '8.2.12',
  phpModules: ['PDO', 'pdo_mysql', 'openssl', 'session'],
  databaseProbe: '1',
}));
const result = await checkBackend(fixtureConfig(), transport);
assert.equal(result.healthUrl, 'https://finados.complejomushucruna.com/api/health');
assert.equal(result.database, 'ready');
assert.equal(transport.writes.length, 0);
assert.ok(transport.commands.every(command => !command.includes('--delete') && !command.includes('rm -rf')));
assert.doesNotMatch(transport.output.join('\n'), /fixture-password|fixture-key/);
```

La prueba debe ejecutar el prevuelo contra un transporte controlado y afirmar sus efectos observables; no debe limitarse a buscar cadenas dentro del archivo fuente.

- [ ] **Step 2: Ejecutar la prueba y confirmar el rojo**

Run: `cd website && node --test --test-name-pattern="backend|subdominio" tests/deploy.test.mjs`

Expected: FAIL porque no existe el despliegue del backend.

- [ ] **Step 3: Implementar prevuelo remoto de solo lectura**

Comprobar rama `main` limpia/sincronizada, PHP 8.1+, `pdo`, `pdo_mysql`, `openssl`, sesión, docroot exacto, acceso a directorio privado y conexión DB con `SELECT 1`. No crear tablas durante `backend:check`.

- [ ] **Step 4: Implementar respaldo y transferencia sin borrado**

Crear copia fechada del backend remoto, obtener backup de base, transferir un artefacto tar a una carpeta de versión y cambiar `current` solo después de PHP lint y migraciones. Si no se permiten symlinks, copiar sobre el docroot únicamente después del respaldo, sin eliminar archivos exclusivos.

- [ ] **Step 5: Documentar configuración y recuperación**

Actualizar README para reconocer PHP/MySQL, separar despliegue de frontend/backend, explicar creación de DB en cPanel cuando UAPI no esté disponible, creación interactiva de `admin`, importación, backup y rollback. Los ejemplos deben usar los valores ficticios `usuario_cpanel`, `/home/usuario_cpanel/apps/finados-api` y `/home/usuario_cpanel/private-data/finados-backend.json`.

- [ ] **Step 6: Ejecutar suite completa**

Run: `cd website && npm run check`

Expected: Node, PHP, build y validador pasan sin credenciales o referencias rotas.

- [ ] **Step 7: Commit**

```bash
git add website/scripts website/tests/deploy.test.mjs website/deploy.env.example website/README.md website/package.json
git commit -m "Automatizar despliegue seguro del backend de Voceros"
```

### Task 9: Verificación local, revisión independiente y publicación

**Files:**
- Modify: `AGENTS.md`
- Modify: `vault/_memoria-del-proyecto.md`
- Modify: `vault/_pendientes.md`
- Modify: `docs/superpowers/plans/2026-09-14_panel-voceros-backend-finados.md`

**Interfaces:**
- Consumes: todos los comandos y rutas anteriores.
- Produces: frontend y backend verificados, usuario `admin` creado sin revelar contraseña y bitácora final sanitizada.

- [ ] **Step 1: Ejecutar verificación local completa**

Run: `cd website && npm ci && npm run check`

Expected: cero fallos; build con `/admin/` y `/admin/voceros/`.

- [ ] **Step 2: Levantar los dos orígenes localmente**

Run frontend: `cd website && php -S 127.0.0.1:4173 -t dist`

Run API: `cd website/backend/finados-api/public && FINADOS_CONFIG_PATH=/private/tmp/finados-backend-test.json php -S 127.0.0.1:4174`

Expected: login visible en `http://127.0.0.1:4173/admin/`; API health 200; datos 401 sin sesión.

- [ ] **Step 3: Ejecutar QA de navegador**

Comprobar escritorio 1440×900 y móvil 390×844: login, error, sesión, tablero, búsqueda, filtros, detalle, cambio de estado, nota, exportación y logout; confirmar teclado, foco y ausencia de desbordamiento.

- [ ] **Step 4: Obtener revisión independiente del diff**

Revisar específicamente exposición de secretos, autorización rota, SQL injection, XSS, CSRF, CORS, cookies, deduplicación, cifrado, logs, respaldo y cambios fuera del alcance. Corregir todo hallazgo crítico o alto antes de continuar.

- [ ] **Step 5: Commit de la implementación validada**

```bash
git add AGENTS.md vault/_memoria-del-proyecto.md vault/_pendientes.md docs/superpowers/plans/2026-09-14_panel-voceros-backend-finados.md website
git commit -m "Implementar panel y backend de Voceros"
```

- [ ] **Step 6: Ejecutar prevuelo remoto**

Run: `cd website && npm run backend:check && npm run deploy:check`

Expected: rama sincronizada, módulos presentes, DB responde `SELECT 1`, ambos destinos accesibles, PHP lint y suite aprobados; ninguna escritura pública.

- [ ] **Step 7: Desplegar backend y crear `admin`**

Run: `cd website && npm run backend:deploy`

Run interactivo: `cd website && npm run backend:admin`

Expected: respaldo previo confirmado; Alex introduce la contraseña dos veces en el prompt oculto; la salida solo confirma la creación.

- [ ] **Step 8: Importar registros existentes**

Ejecutar primero `--dry-run`; comparar cantidades con CSV/Sheets; ejecutar sin `--dry-run` solo si no hay errores. Repetir una segunda vez y exigir `inserted: 0` para probar idempotencia.

- [ ] **Step 9: Desplegar frontend y verificar producción**

Run: `cd website && npm run deploy`

Expected: `/admin/` y `/admin/voceros/` responden 200 y no aparecen en menú/sitemap; API health 200; datos anónimos 401; login, listado, cambio auditado, exportación y logout funcionan por HTTPS.

- [ ] **Step 10: Probar recuperación, cerrar bitácora y publicar Git**

Restaurar el backup en una base temporal o validar con el mecanismo de restauración de cPanel sin sobrescribir producción. Marcar las casillas completadas, documentar commit, despliegue, pruebas, riesgos y pendientes sin incluir identificadores privados ni secretos. Crear un segundo commit con la evidencia real del despliegue y, solo entonces, integrar la rama corta en `main` y ejecutar `git push origin main`; nunca registrar como publicado algo que todavía no fue verificado.
