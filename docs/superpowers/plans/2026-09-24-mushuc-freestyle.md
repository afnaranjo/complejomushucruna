# Mushuc Freestyle 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir Mushuc Freestyle 2026 como un módulo aislado de participantes, con landing pública, cuentas propias, foto, audición TikTok y revisión dentro del panel administrativo existente.

**Architecture:** El frontend añadirá la ruta pública `/finados/mfs/`, el portal de participante y la entrada `MFS` en el submenú de Finados. El backend añadirá una sesión `mfs`, tablas `mfs_*`, almacenamiento privado y endpoints propios; el panel admin compartirá login, sidebar y estilos, pero nunca reutilizará tablas de Voceros o Emprendedores. Las migraciones se ejecutarán mediante el mismo runner seguro y solo después de completar pruebas locales.

**Tech Stack:** Node.js ESM, renderer estático existente, Tailwind 4/CSS de Finados, módulos JavaScript nativos, PHP 8 con PDO, SQLite/MySQL, sesiones PHP, cifrado `Crypto`, pruebas Node/PHP e integración local del repositorio.

**Spec:** `docs/superpowers/specs/2026-09-24-mushuc-freestyle-design.md`

## Global Constraints

- El panel administrativo seguirá siendo único; MFS será una entrada adicional del sidebar actual.
- Las cuentas, tablas, endpoints, sesión y almacenamiento de MFS serán independientes de Voceros, Medios y Emprendedores.
- El MVP solo guardará nombres, nombre artístico opcional, teléfono, correo, fotografía, enlace de TikTok y consentimientos; no guardará cédula, fecha de nacimiento, ciudad/provincia ni talla.
- Las fotos vivirán fuera de `website/public`, cifradas y con acceso autenticado.
- El enlace de audición será HTTPS de TikTok, único e inmutable después del envío del participante.
- No se hará borrado físico desde la UI; el retiro será archivado y auditable.
- No se subirán credenciales, tokens, datos de participantes ni archivos de trabajo privados al repositorio.
- No se ejecutarán migraciones reales ni despliegues hasta una autorización explícita posterior.
- Todo texto nuevo usará español latino neutro, sin voseo.
- Se conservarán el key visual de Finados, Anton/DM Serif/Inter y la navegación existente.

## Review Focus

- **Reenvío o duplicación de correo:** una cuenta MFS existente debe producir una respuesta genérica y no crear otra cuenta ni revelar si el correo está registrado; se prueba en `mfs_auth_test.php`.
- **Foto inválida o maliciosa:** MIME real, dimensiones, tamaño y contenido no válido deben rechazarse sin dejar archivos huérfanos; se prueba en `mfs_photo_test.php`.
- **Audición no válida o segundo envío:** solo HTTPS de TikTok se acepta y una audición enviada no puede sustituirse desde el portal; se prueba en `mfs_profile_test.php`.
- **Separación de permisos:** una sesión de Vocero no puede leer MFS y una sesión MFS no puede ejecutar rutas admin; se prueba en `mfs_router_test.php`.
- **Origen espejo y navegación móvil:** el landing y portal deben cargar desde los orígenes principal y espejo con CSP/CORS correctos, sin desbordamiento en 375 px; se prueba en `mfs_routes.test.mjs` y en la revisión visual local.

## Mapa de archivos y responsabilidades

### Backend

- Crear `website/backend/finados-api/migrations/028_mfs_accounts_sqlite.sql` y `028_mfs_accounts_mysql.sql` con cuentas, perfiles, foto, audición, consentimientos, intentos, restablecimiento, notas y eventos.
- Crear `website/backend/finados-api/src/MfsAuth.php` para registro, login, logout, sesión, CSRF asociado y reactivación segura de cuentas archivadas.
- Crear `website/backend/finados-api/src/MfsPasswordReset.php` para tokens de un solo uso y expiración.
- Crear `website/backend/finados-api/src/MfsProfile.php` para validación de campos, guardado de ficha y bloqueo de audición.
- Crear `website/backend/finados-api/src/MfsPhotoStorage.php` para normalización y almacenamiento privado.
- Crear `website/backend/finados-api/src/MfsRepository.php` para listado, detalle, estados, notas y archivo administrativo.
- Modificar `website/backend/finados-api/src/Router.php` para cargar clases y despachar `/api/mfs/...` y `/api/mfs-participants/...`.
- Modificar `website/backend/finados-api/tests/run.php` para registrar las nuevas pruebas PHP.
- Crear `website/backend/finados-api/tests/mfs_schema_test.php`, `mfs_auth_test.php`, `mfs_profile_test.php`, `mfs_photo_test.php`, `mfs_router_test.php`.

### Frontend público y portal

- Crear `website/src/finados/mfs-page.mjs`, `mfs.css` y `mfs.js`.
- Crear `website/src/finados/mfs-portal-page.mjs`, `mfs-portal.css` y `mfs-portal.js`.
- Modificar `website/src/data/site.mjs` para añadir el hijo `MFS` al submenú de Finados.
- Modificar `website/src/pages.mjs` para registrar landing, acceso, ficha y restablecimiento.
- Modificar `website/scripts/build.mjs` para reconocer rutas `mfs` como páginas de cuenta y copiar scripts/estilos.
- Crear, tras aprobación visual durante la ejecución, `website/public/assets/finados/mfs/mfs-hero.webp` optimizado; el texto permanecerá en HTML.

### Panel administrativo

- Modificar `website/src/admin/page.mjs` para añadir `Mushuc Freestyle` a `ADMIN_FORMS`, `PANEL_LANDINGS` y el renderer de panel.
- Crear `website/src/admin/admin-mfs.js` con cliente API, filtros, detalle, foto, estados, notas, archivo y reset de acceso.
- Modificar `website/src/admin/admin.css` solo cuando una regla reutilizable no cubra la tabla/detalle MFS; evitar estilos globales que cambien Voceros.
- Modificar `website/scripts/build.mjs` para copiar el cliente admin MFS y mantener la CSP de `connect-src`.

### Verificación y documentación

- Crear `website/tests/mfs-routes.test.mjs`, `mfs-render.test.mjs` y `mfs-admin-client.test.mjs` usando los patrones de pruebas existentes.
- Actualizar `website/scripts/deploy-finados-backend.mjs` para incluir clases, migraciones y recursos MFS en el artefacto seguro y en las capacidades de validación.
- Actualizar `AGENTS.md` con una nota fechada de implementación, pruebas, commit, despliegue (si lo hubiera), riesgos y pendientes.

---

### Task 1: Esquema aislado de datos MFS

**Files:**
- Create: `website/backend/finados-api/migrations/028_mfs_accounts_sqlite.sql`
- Create: `website/backend/finados-api/migrations/028_mfs_accounts_mysql.sql`
- Create: `website/backend/finados-api/tests/mfs_schema_test.php`

**Interfaces:**
- Produces tables `mfs_accounts`, `mfs_profiles`, `mfs_photos`, `mfs_auditions`, `mfs_consents`, `mfs_login_attempts`, `mfs_password_resets`, `mfs_notes` and `mfs_review_events` for Tasks 2–3.
- Produces status values `Nuevo`, `En revisión`, `Aprobado`, `Rechazado`, `Seleccionado`, `Archivado`.

- [ ] **Step 1: Write the failing schema test.**

```php
public function testMfsMigrationCreatesOnlyPrefixedTables(): void
{
    $pdo = $this->sqlite();
    $this->applyMigration($pdo, __DIR__ . '/../migrations/028_mfs_accounts_sqlite.sql');
    $tables = $this->tableNames($pdo);
    foreach (['mfs_accounts', 'mfs_profiles', 'mfs_photos', 'mfs_auditions', 'mfs_consents', 'mfs_login_attempts', 'mfs_password_resets', 'mfs_notes', 'mfs_review_events'] as $table) {
        $this->assertContains($table, $tables);
    }
    $this->assertNotContains('vocero_accounts', array_diff($tables, ['vocero_accounts']));
}
```

- [ ] **Step 2: Run the test and verify it fails because migration 028 is absent.**

Run: `php website/backend/finados-api/tests/mfs_schema_test.php`

Expected: FAIL with the missing migration/table assertion.

- [ ] **Step 3: Implement both migrations.**

Use the existing 003/017 conventions: opaque 32-character `public_id`, encrypted values plus HMAC indexes, UTC timestamps, foreign keys, unique account email index, photo metadata, one unique audition per profile, and an audit event table. Create all indexes used by `search`, `status`, `created_at` and `email_idx`. Use SQLite-compatible `INTEGER`/`TEXT` definitions in the SQLite file and InnoDB/`VARBINARY`-compatible definitions in the MySQL file.

- [ ] **Step 4: Run the schema test against SQLite and the migration parser.**

Run: `php website/backend/finados-api/tests/mfs_schema_test.php && php website/backend/finados-api/tests/run.php --filter mfs_schema`

Expected: PASS; existing Vocero/Emprendedor table names remain unchanged.

- [ ] **Step 5: Commit the isolated schema.**

```bash
git add website/backend/finados-api/migrations/028_mfs_accounts_sqlite.sql website/backend/finados-api/migrations/028_mfs_accounts_mysql.sql website/backend/finados-api/tests/mfs_schema_test.php
git commit -m "Agregar esquema aislado de Mushuc Freestyle"
```

### Task 2: Autenticación, foto y ficha del participante

**Files:**
- Create: `website/backend/finados-api/src/MfsAuth.php`
- Create: `website/backend/finados-api/src/MfsPasswordReset.php`
- Create: `website/backend/finados-api/src/MfsProfile.php`
- Create: `website/backend/finados-api/src/MfsPhotoStorage.php`
- Create: `website/backend/finados-api/tests/mfs_auth_test.php`
- Create: `website/backend/finados-api/tests/mfs_profile_test.php`
- Create: `website/backend/finados-api/tests/mfs_photo_test.php`

**Interfaces:**
- `MfsAuth::register(string $email, string $password, bool $privacyAcknowledged, string $ip): array`
- `MfsAuth::login(string $email, string $password, string $ip): array`
- `MfsAuth::requireUser(): array`, `logout(): void`, `csrfToken(): string`, `verifyCsrf(string $token): void`
- `MfsProfile::get(int $accountId): ?array`
- `MfsProfile::save(int $accountId, array $post, array $files, string $ip, string $userAgent): array`
- `MfsProfile::saveAudition(int $accountId, string $url, bool $finalDeclaration, string $ip): array`
- `MfsPhotoStorage::save(array $upload): array`, `readForAccount(int $accountId): string`

- [ ] **Step 1: Write auth tests for registration, duplicate privacy-safe response, login and namespace isolation.**

```php
public function testRegistrationCreatesMfsSessionScopeOnly(): void
{
    $result = $this->mfsAuth->register('mc@example.com', 'Una-frase-segura-2026', true, '127.0.0.1');
    $this->assertSame([], $result);
    $this->assertSame(1, $this->count('mfs_accounts'));
    $this->assertSame(0, $this->count('vocero_accounts'));
}

public function testDuplicateEmailDoesNotRevealAccountState(): void
{
    $first = $this->mfsAuth->register('mc@example.com', 'Una-frase-segura-2026', true, '127.0.0.1');
    $second = $this->mfsAuth->register('mc@example.com', 'Otra-frase-segura-2026', true, '127.0.0.1');
    $this->assertSame($first, $second);
    $this->assertSame(1, $this->count('mfs_accounts'));
}
```

- [ ] **Step 2: Run the auth tests and verify they fail because MFS classes do not exist.**

Run: `php website/backend/finados-api/tests/mfs_auth_test.php`

Expected: FAIL with missing class/method errors.

- [ ] **Step 3: Implement `MfsAuth` by adapting the existing password, throttling, encryption and session patterns without sharing session keys.**

Use `Http::startSession($config, 'mfs')`, `Crypto::lookup/encrypt`, `Auth::hashPassword/verifyPassword`, a `mfs_login_attempts` window, regenerated sessions and a user projection containing only `id`, `public_id`, `email` and `role: participante_mfs`.

- [ ] **Step 4: Write profile and audition validation tests.**

```php
public function testProfileRequiresNamePhonePhotoAndTikTokAudition(): void
{
    $this->expectException(InvalidArgumentException::class);
    $this->profile->save($this->accountId, ['full_name' => 'MC Demo', 'phone' => '0999999999'], [], '127.0.0.1', 'test');
}

public function testAuditionAcceptsOnlyHttpsTikTokAndLocksAfterSubmission(): void
{
    $saved = $this->profile->saveAudition($this->accountId, 'https://www.tiktok.com/@mc/video/123', true, '127.0.0.1');
    $this->assertSame('submitted', $saved['status']);
    $this->expectException(DomainException::class);
    $this->profile->saveAudition($this->accountId, 'https://www.tiktok.com/@mc/video/456', true, '127.0.0.1');
}
```

- [ ] **Step 5: Implement `MfsPhotoStorage` with upload checks and cleanup.**

Accept JPEG, PNG or WebP only after `finfo` detection, reject files over 5 MiB or dimensions outside 240–6000 px, normalize to a safe JPEG/WebP derivative, write below the configured private root with an opaque key, and remove a partially written file if the transaction fails.

- [ ] **Step 6: Implement `MfsProfile` and `MfsPasswordReset`, including three consent records and immutable audition semantics.**

Require `full_name`, `phone`, photo and `finalDeclaration === true`; accept optional `stage_name`; validate email from the authenticated account; write profile/photo/audition/consents in one transaction; return a stable status projection for the portal.

- [ ] **Step 7: Run focused PHP tests.**

Run: `php website/backend/finados-api/tests/mfs_auth_test.php && php website/backend/finados-api/tests/mfs_profile_test.php && php website/backend/finados-api/tests/mfs_photo_test.php`

Expected: PASS, including invalid MIME, duplicate email, invalid TikTok, second audition and session isolation cases.

- [ ] **Step 8: Commit the participant domain.**

```bash
git add website/backend/finados-api/src/MfsAuth.php website/backend/finados-api/src/MfsPasswordReset.php website/backend/finados-api/src/MfsProfile.php website/backend/finados-api/src/MfsPhotoStorage.php website/backend/finados-api/tests/mfs_auth_test.php website/backend/finados-api/tests/mfs_profile_test.php website/backend/finados-api/tests/mfs_photo_test.php
git commit -m "Implementar cuentas y ficha de participantes MFS"
```

### Task 3: Router y API administrativa MFS

**Files:**
- Modify: `website/backend/finados-api/src/Router.php`
- Create: `website/backend/finados-api/tests/mfs_router_test.php`

**Interfaces:**
- Public account endpoints: `GET /api/mfs/auth/session`, `POST /api/mfs/auth/register`, `POST /api/mfs/auth/login`, `POST /api/mfs/auth/logout`, `POST /api/mfs/auth/reset`.
- Participant endpoints: `GET|POST /api/mfs/profile`, `GET /api/mfs/photo`, `POST /api/mfs/audition`.
- Admin endpoints: `GET /api/mfs-participants`, `GET /api/mfs-participants/{publicId}`, `GET /api/mfs-participants/{publicId}/photo`, `PATCH /api/mfs-participants/{publicId}/status`, `POST /api/mfs-participants/{publicId}/notes`, `POST /api/mfs-participants/{publicId}/archive`, `POST /api/mfs-participants/{publicId}/password-reset`.

- [ ] **Step 1: Write routing and authorization tests.**

```php
public function testMfsSessionAndProfileRoutesUseMfsAuth(): void
{
    $response = $this->request('GET', '/api/mfs/auth/session');
    $this->assertSame(200, $response->status);
    $this->assertArrayHasKey('csrf', json_decode($response->body, true));
}

public function testNonAdminCannotReadAdminMfsList(): void
{
    $response = $this->requestAsMfs('GET', '/api/mfs-participants');
    $this->assertSame(401, $response->status);
}

public function testAdminCanChangeStatusButCannotDeleteRows(): void
{
    $response = $this->requestAsAdmin('PATCH', '/api/mfs-participants/' . $this->publicId, ['status' => 'En revisión']);
    $this->assertSame(200, $response->status);
    $this->assertSame(405, $this->requestAsAdmin('DELETE', '/api/mfs-participants/' . $this->publicId)->status);
}
```

- [ ] **Step 2: Add manual `require_once` entries, lazy service properties and route blocks.**

Place MFS dependencies in the router’s explicit dependency list. Evaluate public MFS auth routes before the administrative guard, participant profile/photo/audition routes after `MfsAuth::requireUser()`, and admin routes only after `Auth::requireUser()` plus CSRF for mutations. Keep existing route order and error mapping unchanged.

- [ ] **Step 3: Add strict body, origin and upload limits.**

Reuse the existing `body()` and multipart checks; allow only the exact field set (`full_name`, `stage_name`, `phone`, `privacyAcknowledged`, `imageAcknowledged`, `basesAcknowledged`, `finalDeclaration`, `tiktok_url`, `fotografia`) and reject unknown fields, query parameters on mutation routes and invalid IPs.

- [ ] **Step 4: Add admin list filters and status transitions.**

Support `search`, `status`, `date_from`, `date_to`, `page`, and `pageSize`; sort by `created_at DESC`; allow transitions among the five active states and `Archivado`; write `mfs_review_events` for every status, note, archive or reset action.

- [ ] **Step 5: Run PHP router and full backend tests.**

Run: `php website/backend/finados-api/tests/mfs_router_test.php && npm run test:php --prefix website`

Expected: PASS with no changes to existing Vocero/Emprendedor test fixtures.

- [ ] **Step 6: Commit the API layer.**

```bash
git add website/backend/finados-api/src/Router.php website/backend/finados-api/tests/mfs_router_test.php
git commit -m "Exponer API publica y administrativa de MFS"
```

### Task 4: Landing, navigation and visual system

**Files:**
- Create: `website/src/finados/mfs-page.mjs`
- Create: `website/src/finados/mfs.css`
- Create: `website/src/finados/mfs.js`
- Create: `website/public/assets/finados/mfs/mfs-hero.webp`
- Modify: `website/src/data/site.mjs`
- Modify: `website/src/pages.mjs`
- Modify: `website/scripts/build.mjs`
- Test: `website/tests/mfs-routes.test.mjs`, `website/tests/mfs-render.test.mjs`

**Interfaces:**
- `renderMfsPage(page)` returns a complete static HTML document using `renderFinadosNavigation({ currentRoute: page.route })`.
- Navigation child is `{ label: 'MFS', href: '/finados/mfs/', emphasis: 'mfs' }` and matches `/finados/mfs/` as current.

- [ ] **Step 1: Write route/render tests.**

```js
test('registers the MFS landing and portal routes', () => {
  const routes = pages.map(page => page.route);
  assert.deepEqual(routes.filter(route => route.startsWith('/finados/mfs')), [
    '/finados/mfs/', '/finados/mfs/acceso/', '/finados/mfs/mi-registro/', '/finados/mfs/restablecer/',
  ]);
});

test('landing contains the approved copy and MFS navigation item', () => {
  const html = renderMfsPage({ route: '/finados/mfs/', description: 'MFS' });
  assert.match(html, /II EDICIÓN/);
  assert.match(html, /MUSHUC FREESTYLE 2026/);
  assert.match(html, /MÁS DE USD 950 EN PREMIOS/);
  assert.match(html, /MFS/);
  assert.match(html, /+593 98 034 6729/);
});
```

- [ ] **Step 2: Create the image asset with the image-generation skill and optimize it.**

Use a prompt for a text-free, vertical-friendly night plaza scene: Andean cultural festival atmosphere, freestyle microphone silhouette, deep purple stage, magenta/cyan/yellow accents, grain/fog, no logos, no readable text, no cards or UI. Export a WebP under `website/public/assets/finados/mfs/mfs-hero.webp`, inspect it at desktop and mobile crops, and keep all words in HTML.

- [ ] **Step 3: Implement the renderer and CSS composition.**

Use a full-bleed hero, restrained section rhythm, Anton for display headlines, DM Serif for editorial emphasis and Inter for controls. Build sections for hero, what it is, prizes, bases, registration CTA, location and sponsors. Use a single dominant visual per section, `prefers-reduced-motion`, visible focus states and 44 px minimum touch targets.

- [ ] **Step 4: Implement navigation and motion behavior.**

Keep the existing sticky Finados header and submenu hover/focus behavior. Add a subtle MFS accent without changing existing tones. Add hero entrance, intersection reveals and a CSS count-up-style cupo indicator that degrades to static text with reduced motion; do not add external animation dependencies.

- [ ] **Step 5: Run route, render, asset and build tests.**

Run: `node --test website/tests/mfs-routes.test.mjs website/tests/mfs-render.test.mjs && npm run build --prefix website && node website/scripts/check-dist.mjs`

Expected: PASS; generated `/finados/mfs/index.html` loads the new CSS/JS and the MFS asset without changing existing Finados output.

- [ ] **Step 6: Commit the public landing.**

```bash
git add website/src/finados/mfs-page.mjs website/src/finados/mfs.css website/src/finados/mfs.js website/public/assets/finados/mfs/mfs-hero.webp website/src/data/site.mjs website/src/pages.mjs website/scripts/build.mjs website/tests/mfs-routes.test.mjs website/tests/mfs-render.test.mjs
git commit -m "Crear landing Mushuc Freestyle 2026"
```

### Task 5: Portal de cuenta e inscripción

**Files:**
- Create: `website/src/finados/mfs-portal-page.mjs`
- Create: `website/src/finados/mfs-portal.css`
- Create: `website/src/finados/mfs-portal.js`
- Modify: `website/src/pages.mjs`
- Modify: `website/scripts/build.mjs`
- Test: `website/tests/mfs-portal.test.mjs`

**Interfaces:**
- Portal client uses runtime `apiBase` and `siteOrigin`, `credentials: 'include'`, and the CSRF token returned by `/api/mfs/auth/session`.
- Form submits profile/photo as `FormData` to `/api/mfs/profile`, then submits the immutable audition to `/api/mfs/audition`.

- [ ] **Step 1: Write portal tests for account modes and accessible form fields.**

```js
test('account page exposes register and login modes without collecting unapproved PII', () => {
  const html = renderMfsPortalPage({ route: '/finados/mfs/acceso/', mode: 'login' });
  assert.match(html, /Correo electrónico/);
  assert.match(html, /Contraseña/);
  assert.doesNotMatch(html, /Cédula|Fecha de nacimiento|Talla de camiseta/);
});

test('profile form includes photo, TikTok URL and final declaration', () => {
  const html = renderMfsPortalPage({ route: '/finados/mfs/mi-registro/', mode: 'profile' });
  assert.match(html, /type="file"/);
  assert.match(html, /TikTok/);
  assert.match(html, /final será en Finados Mushuc Runa 2026/);
});
```

- [ ] **Step 2: Implement access, registration and reset views.**

Use the existing portal visual language but label the program `Comunidad Mushuc Freestyle`. Display privacy-safe errors, disabled states while requests are pending, retry controls and a clear success state with timestamp.

- [ ] **Step 3: Implement profile save and audition lock in the browser.**

Build `FormData` with the exact approved fields, show local image preview without uploading twice, prevent submit until all three consent boxes and the final declaration are checked, disable the TikTok input after a successful submission, and render the server status on every reload.

- [ ] **Step 4: Add mirror-origin handling and CSP metadata.**

Use the existing `resolveRuntimeOrigins()` behavior so `finados.expoferiamushucruna.com` talks to `api.expoferiamushucruna.com`; do not hard-code the primary API in the portal client.

- [ ] **Step 5: Run portal tests and the local account flow.**

Run: `node --test website/tests/mfs-portal.test.mjs && npm run dev:voceros --prefix website`

Expected: local flow creates an MFS account, saves a profile/photo, accepts one TikTok audition, reloads with the same status and rejects a second audition.

- [ ] **Step 6: Commit the participant portal.**

```bash
git add website/src/finados/mfs-portal-page.mjs website/src/finados/mfs-portal.css website/src/finados/mfs-portal.js website/src/pages.mjs website/scripts/build.mjs website/tests/mfs-portal.test.mjs
git commit -m "Agregar portal de inscripción de MFS"
```

### Task 6: Sección Mushuc Freestyle dentro del panel admin

**Files:**
- Modify: `website/src/admin/page.mjs`
- Create: `website/src/admin/admin-mfs.js`
- Modify: `website/src/admin/admin.css` only for scoped MFS selectors when required
- Modify: `website/scripts/build.mjs`
- Test: `website/tests/mfs-admin-client.test.mjs`

**Interfaces:**
- `renderAdminMfsPage(page)` returns the same `layout()` shell and `adminSidebar(page)` used by existing sections.
- Client methods: `list(filters)`, `detail(publicId)`, `loadPhoto(publicId)`, `setStatus(publicId, status)`, `addNote(publicId, body)`, `archive(publicId)`, `resetPassword(publicId)`.

- [ ] **Step 1: Write the sidebar and client contract tests.**

```js
test('admin sidebar includes MFS without removing existing forms', () => {
  const html = renderAdminMfsPage({ route: '/admin/mushuc-freestyle/', title: 'Mushuc Freestyle' });
  assert.match(html, /Mushuc Freestyle/);
  assert.match(html, /Voceros/);
  assert.match(html, /Medios/);
  assert.match(html, /Emprendedores/);
  assert.match(html, /data-admin-mfs/);
});

test('admin client never sends participant mutations without CSRF', async () => {
  const request = mockFetch();
  await assert.rejects(() => createMfsAdminClient().setStatus('a'.repeat(32), 'Aprobado'));
  assert.equal(request.calls.length, 0);
});
```

- [ ] **Step 2: Add MFS to `ADMIN_FORMS`, `PANEL_LANDINGS` and `pages.mjs`.**

Use route `/admin/mushuc-freestyle/`, marker `F`, description `Inscripciones y selección`, and script `/assets/admin/admin-mfs.js`. Place it after `Creadoras` so existing sidebar order remains stable and MFS is the final program section.

- [ ] **Step 3: Render the admin workspace.**

Include summary counts, filters, paginated table, a collapsed `Cuentas pendientes de ficha` section at the bottom, and a modal detail with protected photo, TikTok link, status select, notes and archive/reset actions. Show the video declaration prominently so coordination can verify the requirement.

- [ ] **Step 4: Implement the client and safe DOM rendering.**

Use `textContent`/DOM nodes for names and URLs, mask phone/email in the table, set external TikTok links to `target="_blank" rel="noopener noreferrer"`, revoke photo blob URLs when closing detail, and require a confirmation before archive.

- [ ] **Step 5: Run admin tests and check existing panels.**

Run: `node --test website/tests/mfs-admin-client.test.mjs && npm run build --prefix website && node website/scripts/check-dist.mjs`

Expected: MFS panel builds, existing panel snapshots/routes remain present, and no MFS data is rendered into Voceros/Emprendedores templates.

- [ ] **Step 6: Commit the unified admin section.**

```bash
git add website/src/admin/page.mjs website/src/admin/admin-mfs.js website/src/admin/admin.css website/scripts/build.mjs website/tests/mfs-admin-client.test.mjs
git commit -m "Añadir sección Mushuc Freestyle al panel admin"
```

### Task 7: Artefacto backend, integración y cierre de calidad

**Files:**
- Modify: `website/scripts/deploy-finados-backend.mjs`
- Modify: `website/backend/finados-api/tests/run.php`
- Modify: `AGENTS.md`
- Test: `website/tests/integration/mfs-flow.test.mjs`

**Interfaces:**
- Backend deploy artifact must include every `Mfs*.php`, both 028 migrations, and any consent resource used by MFS.
- Integration test covers account → profile/photo → audition → admin review without touching existing rows.

- [ ] **Step 1: Write the end-to-end integration test.**

```js
test('MFS registration and admin review stay isolated from Voceros', async () => {
  const participant = await api.registerMfs({ email: 'mc@example.com', password: 'Una-frase-segura-2026' });
  await api.saveMfsProfile(participant, { full_name: 'MC Demo', phone: '0999999999', tiktok_url: 'https://www.tiktok.com/@mc/video/123', finalDeclaration: true });
  const adminRows = await api.adminMfsList();
  assert.equal(adminRows.items[0].full_name, 'MC Demo');
  assert.equal((await api.voceroList()).items.some(row => row.full_name === 'MC Demo'), false);
  await api.adminSetMfsStatus(adminRows.items[0].public_id, 'Aprobado');
});
```

- [ ] **Step 2: Extend the backend artifact allowlist and capability checks.**

Add the MFS source files, migration names and resource files to the tracked-file filter and required-file list in `deploy-finados-backend.mjs`; add a health capability flag only after the local router confirms the MFS migration and classes load. Keep existing required capabilities unchanged.

- [ ] **Step 3: Run the complete local verification suite.**

Run:

```bash
npm run check --prefix website
node --test website/tests/integration/mfs-flow.test.mjs
npm run backend:check --prefix website
```

Expected: all existing tests and MFS tests pass, generated distribution contains the public landing, portal and admin assets, and backend validation reports the new migration without connecting to production.

- [ ] **Step 4: Perform visual and accessibility QA.**

Open the local routes at 375 px, 768 px and 1440 px widths. Verify keyboard access to the Finados submenu and all forms, focus visibility, reduced motion, image alt text, no horizontal overflow, and that the MFS sidebar entry does not alter existing sections.

- [ ] **Step 5: Update the project log.**

Append a dated `AGENTS.md` note with files, commits, test commands, the fact that production was not deployed, and any legal copy or field decisions still pending. Do not include participant data, credentials or private URLs.

- [ ] **Step 6: Commit the integration and documentation.**

```bash
git add website/scripts/deploy-finados-backend.mjs website/backend/finados-api/tests/run.php website/tests/integration/mfs-flow.test.mjs AGENTS.md
git commit -m "Validar y empaquetar modulo Mushuc Freestyle"
```

- [ ] **Step 7: Stop before deployment.**

Report the commit list and local verification results. Production migration, backend upload and frontend deployment remain a separate explicitly authorized action; do not run `npm run backend:deploy` or `npm run deploy` in this plan.

