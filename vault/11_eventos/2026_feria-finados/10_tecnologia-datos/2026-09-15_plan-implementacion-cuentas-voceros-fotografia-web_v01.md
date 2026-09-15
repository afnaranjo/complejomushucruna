---
titulo: "Plan de implementación de cuentas de voceros y fotografía privada"
responsable: "por asignar"
estado: en-revision
ultima_actualizacion: 2026-09-15
fuente: interna
confidencialidad: interno
---

# Cuentas de Voceros y fotografía privada — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** incorporar autorregistro y sesión del perfil Vocero, ligar cada cuenta con un único formulario y almacenar una fotografía privada utilizable para identificación y gafete, sin debilitar el panel Administrador existente.

**Arquitectura:** el frontend estático seguirá en `complejomushucruna.com` y consumirá con credenciales la API PHP de `finados.complejomushucruna.com`. Las cuentas de voceros, su sesión, la relación uno a uno con `voceros` y los metadatos de fotografía serán aditivos; la imagen normalizada se cifrará fuera de ambos docroots. Las sesiones y rutas de Administrador y Vocero permanecerán separadas.

**Tecnología:** Node.js ESM, HTML estático, CSS/Tailwind CSS 4, JavaScript del navegador, PHP 8.1, PDO MySQL/SQLite, GD, Fileinfo, OpenSSL AES-256-GCM y pruebas Node/PHP/HTTP existentes.

**Especificación:** `vault/11_eventos/2026_feria-finados/10_tecnologia-datos/2026-09-15_diseno_cuentas-voceros-fotografia-web_v01.md`

## Restricciones globales

- Trabajar en la copia existente y en `main`, autorizado expresamente por Alex en esta sesión; no crear otra copia ni otro worktree.
- No desplegar ni modificar servicios externos durante la implementación. Un despliegue exige una autorización posterior explícita.
- El perfil Administrador conserva `/admin/` y `/api/auth/*`; el perfil Vocero usa exclusivamente `/api/vocero/*`.
- Las respuestas de sesión incluyen `role:'administrador'` o `role:'vocero'`; el servidor fija el rol y rechaza cualquier rol enviado por el cliente.
- Cada cuenta de vocero tiene un solo registro y solo puede leer o editar el suyo cuando el estado sea `Nuevo` o `Pendiente de autorización`.
- Contraseñas de 10 a 128 caracteres, Argon2id o bcrypt, bloqueo de cinco fallos durante 15 minutos, sesión inactiva a los 30 minutos y absoluta a las 12 horas.
- Cookies `HttpOnly`, `Secure` en producción, `SameSite=Lax` para Vocero y sesión/cookie independiente de Administrador.
- CORS solo para `https://complejomushucruna.com`; CSRF obligatorio en cada escritura.
- Foto obligatoria para registros nuevos: JPEG/PNG/WebP decodificable, máximo 5 MiB, máximo 25.000.000 de píxeles, reescrita como JPEG calidad 88 con lado largo máximo de 1600 píxeles.
- El prevuelo exige Fileinfo, GD con JPEG/PNG/WebP, EXIF y `memory_limit` de al menos 256 MiB o sin límite antes de publicar la carga.
- Foto cifrada fuera de `public_html`, carpetas `0700`, archivos `0600`, clave aleatoria de 64 hexadecimales y sin nombre original ni PII.
- No enviar fotografía, ruta, clave ni URL a Google Sheets, CSV, logs o errores.
- El uso para identificación/gafete es distinto del uso público de imagen. Conservar datos y foto tres años desde el envío sin afirmar una purga automática inexistente.
- Registros históricos quedan sin cuenta y muestran `Sin fotografía histórica`; no se vinculan por coincidencia de correo.
- Todo cambio de comportamiento sigue RED → GREEN → REFACTOR y cada tarea termina con su prueba dirigida y commit específico.

---

## Mapa de archivos y responsabilidades

- `website/backend/finados-api/migrations/003_vocero_accounts_{mysql,sqlite}.sql`: tablas aditivas de cuentas, intentos, vínculos, fotos y restablecimientos.
- `website/backend/finados-api/src/VoceroAuth.php`: registro, acceso, sesión, CSRF y cierre de sesión del perfil Vocero.
- `website/backend/finados-api/src/PhotoStorage.php`: validación, orientación, normalización, cifrado y acceso privado de imágenes.
- `website/backend/finados-api/src/VoceroProfile.php`: validación y persistencia del formulario ligado a la cuenta.
- `website/backend/finados-api/src/VoceroPasswordReset.php`: enlaces temporales creados por Administrador y consumo por Vocero.
- `website/backend/finados-api/resources/vocero-consents.json`: única fuente de versiones y textos de consentimiento para PHP y el render estático.
- `website/backend/finados-api/src/{Config,Http,Router,VocerosRepository,Audit}.php`: integración acotada con la aplicación existente.
- `website/src/finados/vocero-portal-page.mjs`: páginas de acceso, registro personal y restablecimiento.
- `website/src/finados/vocero-form.mjs`: campos y consentimientos compartidos del registro personal.
- `website/src/finados/{vocero-portal.js,vocero-portal.css,voceros-page.mjs,voceros-legal-page.mjs}`: cliente, estilo, CTA y avisos legales.
- `website/src/admin/{page.mjs,admin.js,admin.css}`: foto privada y restablecimiento desde el detalle administrativo.
- `website/backend/finados-api/bin/backup.php`: respaldo de base, fotos cifradas y manifiesto.
- `website/scripts/{build.mjs,deploy-finados-backend.mjs,deploy-cpanel.mjs}`: empaquetado y prevuelo sin publicar.
- `website/tests/` y `website/backend/finados-api/tests/`: contratos unitarios, build e integración real.

### Tarea 1: Persistencia y autenticación del perfil Vocero

**Archivos:**
- Crear: `website/backend/finados-api/migrations/003_vocero_accounts_mysql.sql`
- Crear: `website/backend/finados-api/migrations/003_vocero_accounts_sqlite.sql`
- Crear: `website/backend/finados-api/resources/vocero-consents.json`
- Crear: `website/backend/finados-api/src/VoceroAuth.php`
- Crear: `website/backend/finados-api/tests/vocero_auth_test.php`
- Modificar: `website/backend/finados-api/src/Auth.php`
- Modificar: `website/backend/finados-api/src/Http.php`
- Modificar: `website/backend/finados-api/src/Router.php`
- Modificar: `website/backend/finados-api/public/index.php`
- Modificar: `website/backend/finados-api/tests/run.php` solo si el descubrimiento automático no incluye el nuevo archivo.

**Interfaces:**
- Consume: `Config`, `Crypto`, `Database`, `Audit`, `Response` y la estrategia de hash de `Auth`.
- Produce: `VoceroAuth::register(string $email, string $password, bool $privacyAcknowledged, string $ip): array`, `login(string $email, string $password, string $ip): array`, `requireUser(): array`, `logout(): void`, `csrfToken(): string`, `verifyCsrf(string $token): void`; rutas `/api/vocero/auth/{session,register,login,logout}`, roles de sesión fijados por el servidor y catálogo local de consentimientos.

- [ ] **Paso 1: escribir la migración y la prueba que falla**

La prueba debe aplicar `001`, `002` y `003`, comprobar que un mismo `email_idx` no puede repetirse y que los vínculos son uno a uno:

```php
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/003_vocero_accounts_sqlite.sql'));
$pdo->prepare('INSERT INTO vocero_accounts (public_id,email_enc,email_idx,password_hash,privacy_version,privacy_hash,privacy_acknowledged_at,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)')
    ->execute([str_repeat('a', 32), 'enc-a', 'idx-a', 'hash-a', '2026-09-15', hash('sha256', 'aviso'), $now, $now, $now]);
throws(fn () => $pdo->prepare('INSERT INTO vocero_accounts (public_id,email_enc,email_idx,password_hash,privacy_version,privacy_hash,privacy_acknowledged_at,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)')
    ->execute([str_repeat('b', 32), 'enc-b', 'idx-a', 'hash-b', '2026-09-15', hash('sha256', 'aviso'), $now, $now, $now]), PDOException::class);
```

- [ ] **Paso 2: ejecutar RED**

Ejecutar: `cd website && php backend/finados-api/tests/run.php vocero_auth_test.php`

Resultado esperado: `FAIL vocero_auth_test.php` porque la migración o `VoceroAuth` todavía no existe.

- [ ] **Paso 3: implementar migraciones aditivas**

Crear las cinco tablas con claves foráneas e índices equivalentes en ambos motores:

```sql
CREATE TABLE vocero_accounts (
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
```

Añadir `vocero_login_attempts`, `vocero_account_links` con `account_id` único y `vocero_id` único, `vocero_photos` con relación única a `voceros`, y `vocero_password_resets` con `token_hash` único, expiración, consumo y `created_by_admin_id`. La versión registrada será `003_vocero_accounts`. Crear también `vocero-consents.json` con este contrato exacto:

```json
{
  "account": {"version":"2026-09-15","text":"Confirmo que he leído la Política de Privacidad y autorizo el tratamiento de mi correo electrónico para crear y proteger mi cuenta de Vocero."},
  "policies": {"version":"2026-09-14 + 2026-09-14","text":"He leído y acepto las Políticas del Vocero y las Bases del Termómetro."},
  "image": {"version":"2026-09-15","text":"Autorizo por separado al responsable del programa a usar mi imagen, mi voz y el contenido que publique como vocero en sus canales oficiales y materiales de la feria, con mi crédito y sin pago adicional. Entiendo que la fotografía que subo para identificación y gafete no se publicará por ese solo hecho. He leído la Autorización de uso de imagen y contenido."},
  "data": {"version":"2026-09-15","text":"Autorizo el tratamiento de mis datos personales, incluida la fotografía que subo, para verificar mi identidad, gestionar mi participación y, si corresponde, elaborar y entregar mi credencial o gafete. He leído la Política de Privacidad y conozco mis derechos de acceso, rectificación, eliminación, oposición y portabilidad."}
}
```

- [ ] **Paso 4: implementar sesiones separadas y `VoceroAuth`**

Cambiar la interfaz a:

```php
Http::startSession($config, 'admin');
Http::startSession($config, 'vocero');
```

El scope debe elegir nombre de cookie (`finados_admin` o `finados_vocero`) y `SameSite` (`Strict` o `Lax`) antes de `session_start()`. `VoceroAuth` cifra el correo, usa `Crypto::lookup()` para unicidad y limitación, exige la confirmación de lectura y deriva `privacy_version`/`privacy_hash` del catálogo local —nunca del cliente—, responde con `['id','public_id','email','role'=>'vocero']`, regenera sesión y nunca retorna hashes. `Auth` añadirá `role=>'administrador'` a su usuario sin aceptar el rol del request.

- [ ] **Paso 5: añadir rutas de autenticación antes del guard administrativo**

`Router::handle()` reconocerá el prefijo `/api/vocero/` antes de llamar a `Auth::requireUser()`. En registro, acceso y cierre exigirá origen permitido, IP válida y CSRF; `GET session` devolverá siempre `authenticated`, `user` y un CSRF. La firma de `handle` quedará preparada para multipart:

```php
public function handle(string $method, string $uri, array $server = [], string $rawBody = '', array $post = [], array $files = []): Response
```

`public/index.php` pasará `$_POST` y `$_FILES`. Las rutas JSON existentes seguirán funcionando con los valores predeterminados.

- [ ] **Paso 6: completar pruebas de comportamiento**

Cubrir registro válido, correo canónico, duplicado con respuesta no enumerable, contraseña fuera de 10–128, roles devueltos por servidor, rechazo de un campo `role` enviado por cliente, login, rotación de cookie/CSRF, cinco fallos y bloqueo de 15 minutos, expiración inactiva/absoluta, logout y separación de cookies. La mutación “usar `finados_admin` para Vocero” debe romper al menos una prueba.

- [ ] **Paso 7: ejecutar GREEN y regresión PHP**

Ejecutar:

```bash
cd website
php backend/finados-api/tests/run.php vocero_auth_test.php auth_test.php api_test.php
```

Resultado esperado: los tres archivos muestran `PASS`.

- [ ] **Paso 8: commit específico**

```bash
git add website/backend/finados-api/migrations/003_vocero_accounts_mysql.sql website/backend/finados-api/migrations/003_vocero_accounts_sqlite.sql website/backend/finados-api/resources/vocero-consents.json website/backend/finados-api/src/VoceroAuth.php website/backend/finados-api/src/Auth.php website/backend/finados-api/src/Http.php website/backend/finados-api/src/Router.php website/backend/finados-api/public/index.php website/backend/finados-api/tests/vocero_auth_test.php website/backend/finados-api/tests/auth_test.php
git commit -m "Añadir cuentas y sesión del perfil Vocero"
```

### Tarea 2: Procesamiento y almacenamiento privado de fotografías

**Archivos:**
- Crear: `website/backend/finados-api/src/PhotoStorage.php`
- Crear: `website/backend/finados-api/tests/photo_storage_test.php`
- Modificar: `website/backend/finados-api/src/Config.php`

**Interfaces:**
- Consume: `Config::privateDirectory()` y `Crypto::{encrypt,decrypt}`.
- Produce: `PhotoStorage::stage(string $temporaryPath, int $declaredSize): array`, `promote(array $photo): void`, `discard(array $photo): void`, `delete(string $storageKey): void`, `read(string $storageKey): string`, `verify(string $storageKey, string $sha256): bool`.

- [ ] **Paso 1: escribir pruebas reales de imagen que fallen**

Crear imágenes temporales con GD, no mocks, y comprobar salida y cifrado:

```php
$source = tempnam(sys_get_temp_dir(), 'vocero-photo-');
$image = imagecreatetruecolor(2000, 1000);
imagejpeg($image, $source, 95);
imagedestroy($image);
$prepared = $storage->stage($source, filesize($source));
same(1600, $prepared['width']);
same(800, $prepared['height']);
same('image/jpeg', $prepared['mime_type']);
```

La prueba debe leer el archivo cifrado y verificar que no empieza con `FFD8`, promoverlo, descifrarlo mediante `read()` y confirmar que la salida sí es JPEG.

- [ ] **Paso 2: ejecutar RED**

Ejecutar: `cd website && php backend/finados-api/tests/run.php photo_storage_test.php`

Resultado esperado: fallo por clase `PhotoStorage` inexistente.

- [ ] **Paso 3: exponer el directorio privado resuelto**

`Config::fromFile()` conservará `dirname($resolvedPath)` y expondrá:

```php
public function privateDirectory(): string
{
    return $this->privateDirectory;
}
```

La validación seguirá rechazando cualquier configuración ubicada dentro de `public_html`.

- [ ] **Paso 4: implementar validación y normalización**

`PhotoStorage::stage()` rechazará rutas inexistentes, symlinks, tamaños `<=0` o `>5*1024*1024`, MIME distinto de `image/jpeg`, `image/png`, `image/webp`, dimensiones inválidas o más de `25_000_000` píxeles. Debe usar Fileinfo y `getimagesize()`, decodificar con `imagecreatefromstring()`, corregir orientación JPEG 3/6/8 cuando EXIF esté disponible y reescribir sobre un lienzo verdadero color como JPEG 88, lado largo máximo 1600.

- [ ] **Paso 5: implementar cifrado y permisos**

Usar `dirname($configPath)/voceros-photos/{staging,files}` con directorios `0700`. La clave final será `bin2hex(random_bytes(32))`. El archivo cifrado se escribirá con creación exclusiva y `0600`; `promote()` hará `rename()` atómico dentro del mismo filesystem. `read()` validará la clave con `/^[a-f0-9]{64}$/D`, rechazará symlinks y devolverá únicamente el JPEG descifrado.

- [ ] **Paso 6: cubrir rechazos y limpieza**

Probar 0 bytes, 5 MiB + 1, MIME falso, texto renombrado, imagen corrupta, 25.000.001 píxeles mediante cabecera controlada, WebP solo cuando `imagecreatefromwebp` exista, clave con traversal, `discard()` y fallo de promoción. Ninguna excepción debe incluir la ruta fuente.

- [ ] **Paso 7: ejecutar GREEN y regresión de configuración**

Ejecutar:

```bash
cd website
php backend/finados-api/tests/run.php photo_storage_test.php config_test.php config_environment_test.php
```

Resultado esperado: los tres archivos muestran `PASS`.

- [ ] **Paso 8: commit específico**

```bash
git add website/backend/finados-api/src/PhotoStorage.php website/backend/finados-api/src/Config.php website/backend/finados-api/tests/photo_storage_test.php
git commit -m "Guardar fotografías privadas de Voceros"
```

### Tarea 3: Formulario autenticado, consentimientos y fotografía propia

**Archivos:**
- Modificar: `website/backend/finados-api/resources/vocero-consents.json` únicamente si la prueba descubre una diferencia con el texto aprobado.
- Crear: `website/backend/finados-api/src/VoceroProfile.php`
- Crear: `website/backend/finados-api/tests/vocero_profile_test.php`
- Modificar: `website/backend/finados-api/src/VocerosRepository.php`
- Modificar: `website/backend/finados-api/src/Router.php`
- Modificar: `website/backend/finados-api/src/Audit.php`
- Modificar: `website/backend/finados-api/tests/api_test.php`

**Interfaces:**
- Consume: cuenta de `VoceroAuth::requireUser()`, `PhotoStorage`, migración 003 y `VocerosRepository`.
- Produce: `VoceroProfile::get(int $accountId): ?array`, `save(int $accountId, array $fields, array $files, string $ip, string $userAgent): array`, `photo(int $accountId): string`; rutas `GET/POST /api/vocero/profile` y `GET /api/vocero/photo`.

- [ ] **Paso 1: escribir prueba de perfil que falle**

La prueba debe registrar una cuenta, crear una imagen real, enviar el mismo `submission_id` dos veces y comprobar una cuenta, un vocero y una foto:

```php
$first = $profile->save($account['id'], $fields, ['fotografia' => $upload], '192.0.2.1', 'Prueba');
$second = $profile->save($account['id'], $fields, ['fotografia' => $upload], '192.0.2.1', 'Prueba');
same($first['public_id'], $second['public_id']);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM vocero_account_links')->fetchColumn());
same(1, (int) $pdo->query('SELECT COUNT(*) FROM vocero_photos')->fetchColumn());
```

- [ ] **Paso 2: ejecutar RED**

Ejecutar: `cd website && php backend/finados-api/tests/run.php vocero_profile_test.php`

Resultado esperado: fallo por servicio `VoceroProfile` y catálogo de consentimientos inexistentes.

- [ ] **Paso 3: integrar la fuente única de consentimientos**

El JSON creado en la Tarea 1 tendrá versiones `2026-09-15` y textos completos. Verificar que el consentimiento de datos incluya fotografía, verificación de identidad y gafete; la autorización de imagen comenzará con `Autorizo por separado` y distinguirá publicación de uso operativo. PHP calculará `hash('sha256', $text)` sobre exactamente ese valor.

- [ ] **Paso 4: implementar creación transaccional ligada a cuenta**

`VoceroProfile::save()` tomará el correo únicamente de la cuenta autenticada, reutilizará las reglas actuales de edad, cédula, WhatsApp, redes y representante, y exigirá los tres consentimientos. Preparará la foto antes de iniciar la transacción, adquirirá el lock `finados.voceros.media`, bloqueará la cuenta, creará `voceros`, consentimientos, vínculo y metadatos, promoverá la foto y confirmará. Ante cualquier error, hará rollback y eliminará staging/final creado por esa operación antes de liberar el lock.

- [ ] **Paso 5: implementar edición autorizada**

Si ya existe vínculo, solo permitirá cambios cuando el estado sea `Nuevo` o `Pendiente de autorización`. Una nueva foto reemplazará la anterior después del commit y eliminará el archivo antiguo; sin foto nueva conservará la existente. Para `Aprobado` o `Rechazado`, responderá `403`. Los consentimientos de una nueva versión se insertan como evidencia nueva; los anteriores no se sobrescriben.

- [ ] **Paso 6: integrar rutas y respuesta mínima**

`GET /api/vocero/profile` retornará `registered`, los campos de la propia cuenta, `status` y `photo:{available,width,height,created_at}`. `POST` aceptará solo `multipart/form-data`, `CONTENT_LENGTH <= 5*1024*1024+262144`, CSRF e IP válida. `GET /api/vocero/photo` retornará bytes JPEG con `private, no-store`, `nosniff` y sin clave/ruta.

- [ ] **Paso 7: asegurar aislamiento y mutaciones**

Probar que una cookie de Vocero recibe `401` en `/api/voceros`, que una cookie Administrador no abre `/api/vocero/profile`, que cambiar el `accountId` en memoria no permite leer otro vínculo y que una foto no llega a `SheetsOutbox`, exportación o cuerpo JSON.

- [ ] **Paso 8: ejecutar GREEN y regresión backend**

Ejecutar:

```bash
cd website
php backend/finados-api/tests/run.php vocero_profile_test.php repository_test.php public_registration_test.php sheets_outbox_test.php api_test.php
```

Resultado esperado: cinco archivos muestran `PASS`.

- [ ] **Paso 9: commit específico**

```bash
git add website/backend/finados-api/src/VoceroProfile.php website/backend/finados-api/src/VocerosRepository.php website/backend/finados-api/src/Router.php website/backend/finados-api/src/Audit.php website/backend/finados-api/tests/vocero_profile_test.php website/backend/finados-api/tests/api_test.php
git commit -m "Ligar registro y fotografía a cada Vocero"
```

### Tarea 4: Portal visual del Vocero y retiro del alta anónima

**Archivos:**
- Crear: `website/src/finados/vocero-form.mjs`
- Crear: `website/src/finados/vocero-portal-page.mjs`
- Crear: `website/src/finados/vocero-portal.js`
- Crear: `website/src/finados/vocero-portal.css`
- Crear: `website/tests/vocero-portal.test.mjs`
- Modificar: `website/src/finados/voceros-page.mjs`
- Modificar: `website/src/pages.mjs`
- Modificar: `website/scripts/build.mjs`
- Modificar: `website/public/api/voceros/index.php`
- Modificar: `website/tests/build.test.mjs`
- Modificar: `website/tests/design.test.mjs`

**Interfaces:**
- Consume: `/api/vocero/auth/*`, `/api/vocero/profile`, `/api/vocero/photo` y `resources/vocero-consents.json`.
- Produce: rutas `/finados/voceros/acceso/`, `/finados/voceros/mi-registro/`, `/finados/voceros/restablecer/`; `VoceroApiClient`; preview y envío multipart.

- [ ] **Paso 1: escribir pruebas de build y cliente que fallen**

Comprobar que existen las tres rutas `noindex`, que no están en sitemap y que la landing enlaza a cuenta:

```js
assert.match(landing, /href="\/finados\/voceros\/acceso\/"[^>]*>Crear cuenta/);
assert.match(access, /data-vocero-register/);
assert.match(profile, /name="fotografia"[^>]+accept="image\/jpeg,image\/png,image\/webp"[^>]+required/);
assert.doesNotMatch(sitemap, /finados\/voceros\/(acceso|mi-registro|restablecer)/);
```

La prueba del cliente usará un `fetch` controlado y comprobará `credentials:'include'`, rotación CSRF y `FormData` con `fotografia`.

- [ ] **Paso 2: ejecutar RED**

Ejecutar: `cd website && node --test tests/vocero-portal.test.mjs`

Resultado esperado: fallo por rutas y módulos inexistentes.

- [ ] **Paso 3: renderizar acceso, perfil y restablecimiento**

`acceso` mostrará dos modos claros: `Crear cuenta` e `Iniciar sesión`. La creación exigirá un checkbox “He leído la Política de Privacidad” y enviará únicamente `privacy_acknowledged=1`; el servidor derivará versión y hash del catálogo. `mi-registro` mostrará estado, formulario agrupado y bloque dominante de fotografía. `restablecer` pedirá contraseña y confirmación. Todas tendrán CSP cerrada, `noindex`, referrer `no-referrer`, API de producción fija y API loopback solo en build de desarrollo.

- [ ] **Paso 4: extraer el formulario y preservar el contenido**

Mover los campos actuales de `voceros-page.mjs` a `vocero-form.mjs` sin cambiar nombres de negocio. El correo se mostrará bloqueado desde la cuenta. Añadir el campo:

```html
<input id="fotografia" name="fotografia" type="file" accept="image/jpeg,image/png,image/webp" required>
```

Usar el texto aprobado de la especificación, preview vertical y botón `Reemplazar fotografía`. Una edición con foto existente no exigirá seleccionar otra.

- [ ] **Paso 5: implementar cliente accesible**

`VoceroApiClient` obtendrá primero sesión/CSRF, nunca guardará tokens en `localStorage`, usará `credentials:'include'` y distinguirá 401/403/409/413/422/429. La vista previa usará `URL.createObjectURL()` y la revocará al reemplazar, guardar, navegar o cerrar. Errores conservarán campos y devolverán foco al resumen de error.

- [ ] **Paso 6: cambiar la landing sin alterar las demás secciones**

El hero tendrá `Crear cuenta` y `Iniciar sesión`; la sección 07 explicará que el formulario se completa dentro de la cuenta y repetirá ambos accesos. No añadir acceso administrativo al menú público. El endpoint histórico `/api/voceros/` mantendrá `GET` informativo y responderá `401` a `POST` con `Crea una cuenta o inicia sesión para completar tu registro.`

- [ ] **Paso 7: integrar assets y entorno local**

`buildSite()` pasará el mismo API loopback validado a páginas administrativas y del portal. Copiará `vocero-portal.js/css`; producción sustituirá cualquier constante loopback por `null`, igual que el admin. Actualizar `local-stack.mjs` solo mediante la tarea de integración final, no aquí.

- [ ] **Paso 8: ejecutar GREEN y pruebas de build**

Ejecutar:

```bash
cd website
node --test tests/vocero-portal.test.mjs tests/build.test.mjs tests/design.test.mjs
npm run build
node scripts/check-dist.mjs
```

Resultado esperado: pruebas en verde y salida válida sin referencias rotas.

- [ ] **Paso 9: commit específico**

```bash
git add website/src/finados/vocero-form.mjs website/src/finados/vocero-portal-page.mjs website/src/finados/vocero-portal.js website/src/finados/vocero-portal.css website/src/finados/voceros-page.mjs website/src/pages.mjs website/scripts/build.mjs website/public/api/voceros/index.php website/tests/vocero-portal.test.mjs website/tests/build.test.mjs website/tests/design.test.mjs
git commit -m "Crear portal privado para el perfil Vocero"
```

### Tarea 5: Fotografía y recuperación desde el panel Administrador

**Archivos:**
- Crear: `website/backend/finados-api/src/VoceroPasswordReset.php`
- Crear: `website/backend/finados-api/tests/vocero_password_reset_test.php`
- Modificar: `website/backend/finados-api/src/Router.php`
- Modificar: `website/backend/finados-api/src/VocerosRepository.php`
- Modificar: `website/src/admin/page.mjs`
- Modificar: `website/src/admin/admin.js`
- Modificar: `website/src/admin/admin.css`
- Modificar: `website/tests/admin.test.mjs`

**Interfaces:**
- Consume: vínculo cuenta–vocero, `PhotoStorage`, `Auth`, CSRF y auditoría.
- Produce: `VoceroPasswordReset::create(string $voceroPublicId, int $adminId, string $ip): string`, `consume(string $token, string $password, string $ip): void`; endpoints administrativos de foto/restablecimiento y UI del detalle.

- [ ] **Paso 1: escribir pruebas de token y panel que fallen**

Probar que el token crudo se devuelve una sola vez, la DB guarda solo SHA-256/HMAC, caduca en 30 minutos, no puede reutilizarse y una nueva contraseña invalida sesiones anteriores. En Node, comprobar contenedores `data-admin-photo`, `data-admin-reset` y revocación de blob.

- [ ] **Paso 2: ejecutar RED**

Ejecutar:

```bash
cd website
php backend/finados-api/tests/run.php vocero_password_reset_test.php
node --test tests/admin.test.mjs
```

Resultado esperado: ambos fallan por comportamiento ausente.

- [ ] **Paso 3: implementar restablecimiento asistido**

`create()` comprobará que el vocero tiene cuenta activa, invalidará tokens abiertos anteriores, generará 32 bytes aleatorios, guardará únicamente `hash_hmac('sha256', $token, hmacKey)`, expirará a los 30 minutos y auditará `vocero.password_reset_created`. `consume()` bloqueará la fila, verificará expiración/uso, actualizará hash de contraseña y `updated_at`, marcará `used_at` y auditará sin registrar token.

- [ ] **Paso 4: implementar endpoints administrativos y de consumo**

- `GET /api/voceros/{id}/photo`: Administrador autenticado, IP válida, auditoría `vocero.photo_viewed`, JPEG `private, no-store`.
- `POST /api/voceros/{id}/password-reset`: Administrador + CSRF; responde `resetUrl` con host fijo `https://complejomushucruna.com/finados/voceros/restablecer/?token=`.
- `POST /api/vocero/auth/reset`: sesión Vocero no requerida, pero sí CSRF, token y contraseña válida.

- [ ] **Paso 5: integrar el detalle administrativo**

El detalle mostrará `Sin fotografía histórica` si `photo.available` es falso. Si existe, solicitará el blob después de abrir el detalle, mostrará vista vertical y permitirá descarga como `vocero-{public_id}.jpg`; revocará el blob al cambiar/cerrar. El botón `Generar enlace temporal` mostrará una caja de solo lectura y un botón copiar, sin enviar mensajes automáticamente.

- [ ] **Paso 6: ejecutar GREEN y regresión**

Ejecutar:

```bash
cd website
php backend/finados-api/tests/run.php vocero_password_reset_test.php api_test.php repository_test.php
node --test tests/admin.test.mjs
```

Resultado esperado: cuatro pruebas/archivos muestran `PASS`.

- [ ] **Paso 7: commit específico**

```bash
git add website/backend/finados-api/src/VoceroPasswordReset.php website/backend/finados-api/src/Router.php website/backend/finados-api/src/VocerosRepository.php website/backend/finados-api/tests/vocero_password_reset_test.php website/src/admin/page.mjs website/src/admin/admin.js website/src/admin/admin.css website/tests/admin.test.mjs
git commit -m "Gestionar foto y acceso de Voceros desde administración"
```

### Tarea 6: Privacidad, respaldo, prevuelo e integración completa

**Archivos:**
- Modificar: `website/src/finados/voceros-legal-page.mjs`
- Modificar: `website/public/api/voceros/index.php`
- Modificar: `website/backend/finados-api/bin/backup.php`
- Modificar: `website/backend/finados-api/tests/backup_test.php`
- Modificar: `website/scripts/deploy-finados-backend.mjs`
- Modificar: `website/scripts/deploy-cpanel.mjs`
- Modificar: `website/tests/deploy.test.mjs`
- Modificar: `website/tests/integration/local-stack.mjs`
- Modificar: `website/tests/integration/fixture.php`
- Modificar: `website/tests/integration/voceros-http.test.mjs`
- Modificar: `website/tests/integration/public-router.php`
- Modificar: `website/tests/integration/api-router.php`
- Modificar: `website/tests/integration/lifecycle.test.mjs` si el nuevo directorio requiere limpieza verificada.
- Modificar: `vault/_memoria-del-proyecto.md`
- Modificar: `vault/_pendientes.md`
- Modificar: `vault/11_eventos/2026_feria-finados/10_tecnologia-datos/diccionario-datos.md`
- Modificar: `AGENTS.md`

**Interfaces:**
- Consume: todos los commits anteriores.
- Produce: documentos legales coherentes, respaldo con fotos, prevuelo del servidor, flujo HTTP real de ambos perfiles y bitácora final.

- [ ] **Paso 1: escribir primero las pruebas legales, de respaldo y despliegue**

La prueba debe cargar `vocero-consents.json`, construir las páginas y comparar texto normalizado exacto; no debe buscar solo una frase. El respaldo debe crear una DB SQLite con una foto cifrada y comprobar manifiesto:

```php
same(1, $manifest['photos']['count']);
same(hash_file('sha256', $archivedPhoto), $manifest['photos']['files'][0]['sha256']);
```

El prevuelo debe fallar si falta `fileinfo`, `gd`, soporte JPEG/PNG/WebP, `exif`, `memory_limit` de al menos 256 MiB (o ilimitado), raíz privada escribible o espacio mínimo de 100 MiB.

- [ ] **Paso 2: ejecutar RED**

Ejecutar:

```bash
cd website
node --test tests/deploy.test.mjs tests/build.test.mjs
php backend/finados-api/tests/run.php backup_test.php
```

Resultado esperado: fallos por manifiesto de fotos, textos antiguos o prevuelo incompleto.

- [ ] **Paso 3: actualizar avisos y versiones**

Política de Privacidad: añadir fotografía, identidad, gafete, obligatoriedad, acceso restringido y conservación de tres años sin prometer purga automática. Autorización de imagen: separar expresamente publicación y uso operativo. Actualizar `imageVersion` y `privacyVersion` a `2026-09-15`, conservar `policiesVersion` y `thermometerVersion` en `2026-09-14`, usar los textos exactos del JSON y no reescribir consentimientos antiguos.

- [ ] **Paso 4: ampliar respaldo y verificación**

`backup.php` adquirirá el mismo lock `finados.voceros.media`, copiará `voceros-photos/files` cifrado dentro del directorio fechado sin seguir symlinks y escribirá un manifiesto ordenado con cantidad, bytes y SHA-256 por archivo además del dump. Fallará si una fila `vocero_photos` no tiene archivo/hash coherente o si aparece un archivo sin metadato. El recibo público solo indicará cantidades, bytes y hash general; el lock se liberará también ante errores.

- [ ] **Paso 5: reforzar empaquetado y prevuelo**

Incluir `resources/vocero-consents.json`, nuevas clases y migraciones en el release. Antes de migrar, verificar PHP 8.1, PDO, OpenSSL, Fileinfo, GD, JPEG/PNG/WebP, EXIF, memoria, permisos del directorio privado y espacio. Mantener despliegue backend antes del frontend y no ejecutar ningún `--deploy` en esta tarea.

- [ ] **Paso 6: ampliar la pila local e integración HTTP**

La fixture aplicará 003 y creará Administrador. La prueba HTTP real debe: crear cuenta Vocero; iniciar sesión; enviar multipart con imagen; ver solo su registro; comprobar aislamiento; iniciar Administrador; ver/descargar foto; generar y consumir reset; comprobar que el endpoint anónimo rechaza POST; ejecutar respaldo; detener stack sin procesos o archivos residuales.

- [ ] **Paso 7: ejecutar GREEN dirigido**

Ejecutar:

```bash
cd website
node --test tests/deploy.test.mjs tests/build.test.mjs tests/integration/voceros-http.test.mjs tests/integration/lifecycle.test.mjs
php backend/finados-api/tests/run.php backup_test.php
```

Resultado esperado: cero fallos.

- [ ] **Paso 8: actualizar memoria y bitácora**

Registrar el alcance implementado, commits, ausencia de publicación externa, riesgo pendiente de autorización escrita de menores y requisito de crear/verificar Administrador antes del despliegue. `AGENTS.md` debe incluir una entrada fechada `2026-09-15` sin secretos, cuentas, correos, tokens ni rutas privadas del servidor.

- [ ] **Paso 9: verificación completa fresca**

Ejecutar:

```bash
cd website
npm run check
git diff --check
```

Resultado esperado: todas las pruebas Node, PHP e integración pasan; build y validación de referencias terminan con código 0; no hay errores de whitespace.

- [ ] **Paso 10: commit de cierre**

```bash
git add website/src/finados/voceros-legal-page.mjs website/public/api/voceros/index.php website/backend/finados-api/bin/backup.php website/backend/finados-api/tests/backup_test.php website/scripts/deploy-finados-backend.mjs website/scripts/deploy-cpanel.mjs website/tests/deploy.test.mjs website/tests/integration vault/_memoria-del-proyecto.md vault/_pendientes.md vault/11_eventos/2026_feria-finados/10_tecnologia-datos/diccionario-datos.md AGENTS.md
git commit -m "Cerrar integración segura del portal de Voceros"
```

## Revisión final

Después de las seis tareas, generar un diff desde el commit anterior a la Tarea 1, solicitar revisión integral de arquitectura, autorización, privacidad, manejo de archivos y regresiones, resolver hallazgos bloqueantes y repetir `npm run check`. No hacer push ni desplegar hasta completar esta revisión; el push de commits válidos se realizará conforme a las reglas del repositorio y el despliegue necesitará una autorización separada de Alex.
