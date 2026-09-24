# Nombres en pantalla Finados 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construir una experiencia pública de QR que capture nombres con consentimiento y los presente en una pantalla Finados 2026 con animación escénica y cola temporal.

**Architecture:** Se añadirán dos rutas estáticas al registro existente de páginas: `/finados/nombre/` para captura y QR, y `/finados/pantalla/` para proyección. Ambas compartirán un módulo pequeño de cliente y CSS aislado. El backend incorporará una migración aditiva SQLite/MariaDB, un repositorio dedicado y dos endpoints públicos bajo `/api/finados/nombres`, reutilizando origen/CORS, límites y sanitización ya existentes.

**Tech Stack:** Node.js ESM, generador estático existente, JavaScript de navegador sin dependencias nuevas, CSS/Tailwind 4 existente, PHP 8+ con PDO, SQLite/MariaDB y tests Node/PHP del repositorio.

**Spec:** `docs/superpowers/specs/2026-09-24-nombres-en-pantalla-finados-design.md`

## Global Constraints

- No modificar formularios, cuentas, datos ni rutas existentes de Voceros, Medios, Creadoras, Emprendedores o Administración.
- El backend conservará solamente nombre visible, consentimiento, identificador público y timestamps temporales; no guardará IP, user-agent, correo, cédula, teléfono ni red social.
- El nombre tendrá máximo 60 caracteres; se recortarán espacios y se conservarán tildes mediante normalización Unicode.
- La cola caducará a las 24 horas y la pantalla mostrará como máximo siete nombres por escena.
- La animación protagonista será: entrada de 1 segundo, lectura durante 2 segundos y salida desde el segundo 3 con fade, blur y desplazamiento sutil.
- Las páginas permanecerán fuera del menú principal y se abrirán únicamente por URL directa.
- No se desplegará a producción sin autorización expresa posterior.

## Review Focus

- Texto con HTML o caracteres especiales: debe renderizarse como texto seguro, nunca como marcado activo. (Prueba en Task 2 y Task 4.)
- Consentimiento ausente, nombre vacío o nombre de más de 60 caracteres: debe devolver `422` y no insertar filas. (Task 2.)
- Envíos repetidos del mismo navegador en pocos segundos: debe responder de forma idempotente sin duplicar consecutivamente la cola. (Task 2.)
- Más de siete nombres simultáneos: la pantalla debe mantener siete capas legibles y dejar el resto en cola. (Task 4.)
- `prefers-reduced-motion` y ventanas estrechas: debe reducir movimiento y evitar desbordamiento horizontal. (Task 3 y Task 4.)

### Task 1: Mapear la integración de páginas y contratos existentes

**Files:**
- Modify: `website/src/pages.mjs` (registro de rutas y renderizado)
- Inspect: `website/src/finados/qrcode-generator.mjs`, `website/src/finados/page.mjs`, `website/src/finados/finados.css`, `website/src/finados/runtime-origins.mjs`
- Test: `website/tests/build.test.mjs`

**Interfaces:**
- Consumes: `renderFinadosPage`, `buildSite`, `generateQrCode` y el origen Finados existente.
- Produces: dos entradas de página estática con clases `finados-names-page` y sin enlaces en la navegación.

- [ ] **Step 1: Escribir pruebas de rutas antes de implementar**

  Añadir a `website/tests/build.test.mjs` una prueba que ejecute `buildSite()` y compruebe que existen `finados/nombre/index.html` y `finados/pantalla/index.html`, que ambas contienen sus clases de página y que el bloque `nav` no contiene enlaces a esas rutas.

- [ ] **Step 2: Ejecutar la prueba para confirmar el fallo**

  Run: `cd website && node --test tests/build.test.mjs`
  Expected: FAIL indicando que faltan una o ambas rutas.

- [ ] **Step 3: Implementar los renderers y registrarlos**

  Crear `website/src/finados/nombres-en-pantalla-page.mjs` con `renderNameCapturePage()` y `renderNameScreenPage()`. Reutilizar el shell/header/footer Finados solo donde no exponga navegación adicional; cargar únicamente los assets JavaScript/CSS nuevos. Añadir ambos objetos al arreglo de páginas en `website/src/pages.mjs` sin modificar rutas existentes.

- [ ] **Step 4: Ejecutar la prueba de rutas**

  Run: `cd website && node --test tests/build.test.mjs`
  Expected: PASS para las nuevas rutas y las pruebas existentes del archivo.

- [ ] **Step 5: Commit de la integración de páginas**

  ```bash
  git add website/src/pages.mjs website/src/finados/nombres-en-pantalla-page.mjs website/tests/build.test.mjs
  git commit -m "feat: registrar experiencias de nombres Finados"
  ```

### Task 2: Implementar almacenamiento temporal y API pública

**Files:**
- Create: `website/backend/finados-api/migrations/027_finados_name_queue_sqlite.sql`
- Create: `website/backend/finados-api/migrations/027_finados_name_queue_mysql.sql`
- Create: `website/backend/finados-api/src/FinadosNameQueue.php`
- Modify: `website/backend/finados-api/src/Router.php` (rutas públicas y limpieza temporal)
- Modify: `website/backend/finados-api/tests/run.php` (incluir pruebas nuevas si el runner requiere registro)
- Create: `website/backend/finados-api/tests/finados_name_queue_test.php`

**Interfaces:**
- Consumes: `PDO`, `Config`, `Response`, validación de origen y límites del `Router`.
- Produces: `FinadosNameQueue::enqueue(string $displayName, bool $consent, string $idempotencyKey): array`, `FinadosNameQueue::pending(int $limit): array`, `POST /api/finados/nombres`, `GET /api/finados/nombres/cola`.

- [ ] **Step 1: Escribir pruebas PHP de migración y validación**

  En `finados_name_queue_test.php`, crear una base SQLite temporal aplicando la migración y cubrir: inserción válida con `201`/resultado público; nombre vacío, nombre de 61 caracteres y consentimiento falso; escape de `<script>` al leer; caducidad a 24 horas; idempotencia con la misma clave; límite máximo de 20 registros devueltos.

- [ ] **Step 2: Ejecutar las pruebas para confirmar el fallo**

  Run: `cd website && php backend/finados-api/tests/finados_name_queue_test.php`
  Expected: FAIL porque la tabla, repositorio y rutas todavía no existen.

- [ ] **Step 3: Crear migraciones aditivas**

  Crear `finados_name_queue` con `id`, `public_id` único, `display_name`, `consent_given`, `created_at`, `expires_at`, más índices `public_id` y `(expires_at, id)`. Mantener sintaxis compatible con el orden de migraciones existente y no alterar tablas de Voceros.

- [ ] **Step 4: Implementar el repositorio**

  Implementar normalización UTF-8, recorte de espacios, validación de longitud, generación de `public_id` aleatorio, expiración UTC de 24 horas y deduplicación idempotente basada en una clave efímera derivada del cliente. El método `pending()` debe eliminar/ignorar vencidos, ordenar por `created_at, id` y limitar a 20.

- [ ] **Step 5: Conectar las rutas públicas al Router**

  Añadir `POST /api/finados/nombres` y `GET /api/finados/nombres/cola` antes del fallback autenticado. Aceptar JSON con límite de cuerpo, exigir `consent: true`, devolver solo `public_id`, `display_name`, `created_at` en la cola y aplicar `429` al superar el límite temporal. Reutilizar el origen validado, `Vary: Origin` y respuestas JSON existentes.

- [ ] **Step 6: Ejecutar las pruebas PHP y el conjunto de backend**

  Run: `cd website && php backend/finados-api/tests/finados_name_queue_test.php && npm run test:php`
  Expected: PASS sin cambios en los tests de autenticación, Voceros o administración.

- [ ] **Step 7: Commit del backend**

  ```bash
  git add website/backend/finados-api/migrations/027_finados_name_queue_sqlite.sql website/backend/finados-api/migrations/027_finados_name_queue_mysql.sql website/backend/finados-api/src/FinadosNameQueue.php website/backend/finados-api/src/Router.php website/backend/finados-api/tests/finados_name_queue_test.php website/backend/finados-api/tests/run.php
  git commit -m "feat: añadir cola temporal de nombres Finados"
  ```

### Task 3: Construir la captura QR responsive

**Files:**
- Create: `website/src/finados/nombres-en-pantalla.js`
- Create: `website/src/finados/nombres-en-pantalla.css`
- Modify: `website/src/finados/nombres-en-pantalla-page.mjs`
- Modify: `website/tests/build.test.mjs`

**Interfaces:**
- Consumes: `POST /api/finados/nombres`, `generateQrCode`, runtime origin y formulario HTML generado.
- Produces: QR de `/finados/nombre/`, formulario con `name` y `consent`, confirmación `aria-live="polite"`, manejo de errores 422/429.

- [ ] **Step 1: Escribir pruebas estáticas de captura**

  Extender `build.test.mjs` para verificar que la página contiene la etiqueta visible del nombre, límite `maxlength="60"`, casilla obligatoria, `aria-live="polite"`, botón de envío, QR y referencia a los assets versionados de CSS/JS.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

  Run: `cd website && node --test tests/build.test.mjs`
  Expected: FAIL por ausencia del formulario y sus assets.

- [ ] **Step 3: Implementar captura y QR**

  En `nombres-en-pantalla.js`, generar el QR con el helper existente, enviar JSON con una clave idempotente almacenada solo en `sessionStorage`, mostrar confirmación sin exponer el ID y limpiar el campo después de un `201`. En CSS, usar fondo lila oscuro, grano y niebla con gradientes, serif display para el nombre y sans para instrucciones; asegurar foco visible y diseño móvil vertical.

- [ ] **Step 4: Ejecutar pruebas de captura**

  Run: `cd website && node --test tests/build.test.mjs`
  Expected: PASS, incluyendo la prueba de contenido seguro y las rutas nuevas.

- [ ] **Step 5: Commit de captura y estilo**

  ```bash
  git add website/src/finados/nombres-en-pantalla-page.mjs website/src/finados/nombres-en-pantalla.js website/src/finados/nombres-en-pantalla.css website/tests/build.test.mjs
  git commit -m "feat: crear landing QR de nombres Finados"
  ```

### Task 4: Construir la pantalla de proyección y su composición animada

**Files:**
- Modify: `website/src/finados/nombres-en-pantalla-page.mjs`
- Modify: `website/src/finados/nombres-en-pantalla.js`
- Modify: `website/src/finados/nombres-en-pantalla.css`
- Create: `website/tests/nombres-en-pantalla.test.mjs`

**Interfaces:**
- Consumes: `GET /api/finados/nombres/cola?limit=20` y la memoria de IDs presentados.
- Produces: `selectSceneNames(items, maxVisible)`, `layoutSecondaryNames(count, viewport)`, ciclo protagonista de 3 segundos y fallback de reducción de movimiento.

- [ ] **Step 1: Escribir pruebas unitarias de selección y layout**

  Probar que `selectSceneNames()` devuelve como máximo siete elementos, el protagonista pertenece a la tanda y los secundarios no repiten posición; probar que `layoutSecondaryNames()` devuelve seis posiciones dentro de los límites y que una cola de diez conserva cuatro para el siguiente ciclo.

- [ ] **Step 2: Ejecutar las pruebas para confirmar el fallo**

  Run: `cd website && node --test tests/nombres-en-pantalla.test.mjs`
  Expected: FAIL porque las funciones aún no están exportadas.

- [ ] **Step 3: Implementar escena y animación**

  Exportar las funciones puras desde `nombres-en-pantalla.js`. En la pantalla, consultar cada 2 segundos, filtrar IDs ya presentados, escoger protagonista al azar, ubicar seis secundarios con tamaños/opacidades distintos y mantener una cola local. Aplicar clases `name-scene--enter`, `name-scene--hold` y `name-scene--exit` con `animation-duration: 1s`, pausa de 2s y salida con blur desde el tercer segundo. Con `prefers-reduced-motion`, usar transición corta y una escena estable.

- [ ] **Step 4: Añadir pruebas de accesibilidad y responsive**

  Verificar en el test estático que la pantalla no carga navegación, incluye `aria-label` de contexto, contiene reglas `@media (prefers-reduced-motion: reduce)` y no usa HTML interpolado con nombres remotos.

- [ ] **Step 5: Ejecutar pruebas de pantalla y build**

  Run: `cd website && node --test tests/nombres-en-pantalla.test.mjs tests/build.test.mjs`
  Expected: PASS.

- [ ] **Step 6: Commit de pantalla**

  ```bash
  git add website/src/finados/nombres-en-pantalla-page.mjs website/src/finados/nombres-en-pantalla.js website/src/finados/nombres-en-pantalla.css website/tests/nombres-en-pantalla.test.mjs
  git commit -m "feat: animar nombres en pantalla Finados"
  ```

### Task 5: Verificación integral y documentación operativa

**Files:**
- Modify: `website/tests/build.test.mjs` (solo si se requieren aserciones finales)
- Modify: `AGENTS.md` (nota fechada de cierre)
- Modify: `vault/_memoria-del-proyecto.md` y `vault/_pendientes.md` (registro de la decisión y pendientes)

**Interfaces:**
- Consumes: frontend, backend y migraciones de Tasks 1–4.
- Produces: evidencia reproducible de build, tests, rutas directas y ausencia de enlaces en menú.

- [ ] **Step 1: Ejecutar toda la validación local**

  Run: `cd website && npm run check`
  Expected: PASS en Node, PHP, integración, build y comprobación de `dist`.

- [ ] **Step 2: Inspeccionar el HTML generado**

  Confirmar que ambas rutas están en `dist`, que el QR apunta a `/finados/nombre/`, que no aparecen enlaces nuevos en el menú y que no se modificaron los archivos de Voceros.

- [ ] **Step 3: Ejecutar una prueba manual local**

  Levantar el stack de integración existente, enviar tres nombres de prueba y abrir las dos rutas en escritorio y móvil. Confirmar entrada/espera/salida, escena múltiple, confirmación del consentimiento y respuesta de cola.

- [ ] **Step 4: Revisar diff y secretos**

  Run: `git diff --check && git status --short`
  Expected: solo archivos de esta funcionalidad, sin credenciales, tokens, fotos personales ni dumps de base de datos.

- [ ] **Step 5: Actualizar bitácora**

  Añadir al final de `AGENTS.md` una nota con fecha, commits, pruebas ejecutadas, que no hubo despliegue y que quedan pendientes la leyenda final de consentimiento y la decisión sobre URL corta. Actualizar memoria y pendientes con enlaces a la especificación y al plan.

- [ ] **Step 6: Commit final de documentación**

  ```bash
  git add AGENTS.md vault/_memoria-del-proyecto.md vault/_pendientes.md
  git commit -m "docs: registrar experiencia de nombres Finados"
  ```

## Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-09-24-nombres-en-pantalla-finados.md`. La implementación debe ejecutarse con `superpowers:executing-plans`, tarea por tarea, y detenerse antes de cualquier despliegue para pedir autorización explícita.
