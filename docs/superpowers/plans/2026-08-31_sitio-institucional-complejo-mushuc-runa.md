---
titulo: "Plan de implementación del sitio institucional Complejo Mushuc Runa"
responsable: "Alex Naranjo"
estado: en-revision
ultima_actualizacion: 2026-08-31
fuente: "diseño aprobado del sitio institucional"
confidencialidad: interno
---

# Sitio institucional Complejo Mushuc Runa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir y publicar en `complejomushucruna.com` un sitio institucional estático, profesional y sin WordPress que preserve la identidad y el contenido histórico recuperable.

**Architecture:** Un generador estático pequeño en Node.js transforma datos normalizados y componentes HTML en páginas semánticas dentro de `website/dist/`. El CSS implementa el sistema visual recuperado y el JavaScript añade solo menú móvil y mejoras progresivas; todos los medios publicados son copias locales inspeccionadas y optimizadas.

**Tech Stack:** Node.js ESM, `node:test`, HTML5, CSS moderno, JavaScript sin dependencias, ImageMagick para optimización, SSH/SCP y curl para despliegue/QA.

**Spec:** `docs/superpowers/specs/2026-08-31_sitio-institucional-complejo-mushuc-runa-diseno.md`

## Global Constraints

- El sitio de producción no usa WordPress, PHP, base de datos, plugins ni JavaScript de terceros.
- No se copia ningún ejecutable desde `complejomushucruna.ec`.
- Ningún recurso publicado depende de `complejomushucruna.ec` o de rutas `wp-content`.
- Los textos recuperados se clasifican como institucionales, históricos o por confirmar; no se inventan datos vigentes.
- No se publican datos de Finados 2026 bajo control o embargo.
- La paleta digital conserva `#7C170F`, `#AD140E`, `#5B0B05`, `#9E7721`, `#E3B85D`, `#FFFFFF`, `#7A7A7A`, `#6E2845` y `#A388BE`.
- La jerarquía tipográfica usa Montserrat, Roboto, Roboto Slab y Handgoal como acento.
- No se modifica `.htaccess`, `.user.ini`, `php.ini`, `.well-known` o `cgi-bin` durante el despliegue.
- El despliegue no usa borrado remoto ni `--delete`.

---

### Task 1: Inventario normalizado del contenido legado

**Files:**
- Create: `website/package.json`
- Create: `website/scripts/normalize-legacy.mjs`
- Create: `website/src/data/legacy-pages.json`
- Create: `website/src/data/site.mjs`
- Test: `website/tests/content.test.mjs`

**Interfaces:**
- Consumes: `/private/tmp/mr-elementor.tsv`, exportado por SSH desde `_elementor_data` sin plugins o temas.
- Produces: `legacyPages: LegacyPage[]`, `site: SiteConfig`, `primaryNavigation: NavigationItem[]`, `experiences: Experience[]` y `historicalEvents: HistoricalEvent[]`.

- [ ] **Step 1: Crear el manifiesto y la primera prueba de contenido**

```json
{
  "name": "complejo-mushuc-runa-web",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "node --test tests/*.test.mjs",
    "check": "npm test && npm run build && node scripts/check-dist.mjs"
  }
}
```

```js
// website/tests/content.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalEvents, primaryNavigation, site } from '../src/data/site.mjs';

test('conserva la identidad y navegación aprobadas', () => {
  assert.equal(site.name, 'Complejo Mushuc Runa');
  assert.deepEqual(primaryNavigation.map((item) => item.href), [
    '/', '/experiencias/', '/granja/', '/eventos/', '/historia/', '/visitanos/'
  ]);
});

test('incluye todas las páginas históricas publicadas recuperadas', () => {
  assert.deepEqual(historicalEvents.map((event) => event.slug), [
    'finados-2021', 'finados-2022', 'festival-de-canto', 'finados-2023',
    'toros', 'finados-2025', 'navidad-2025'
  ]);
});
```

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run: `cd website && npm test`

Expected: FAIL con `ERR_MODULE_NOT_FOUND` para `src/data/site.mjs`.

- [ ] **Step 3: Normalizar el contenido exportado y definir la configuración**

`normalize-legacy.mjs` debe recorrer de forma recursiva cada árbol Elementor, extraer textos visibles, enlaces e imágenes, limpiar etiquetas sin ejecutar HTML y escribir `legacy-pages.json`. `site.mjs` debe exportar objetos inmutables con las rutas y categorías aprobadas.

```js
export const site = Object.freeze({
  name: 'Complejo Mushuc Runa',
  legalName: 'Complejo Intercultural y Deportivo Mushuc Runa',
  tagline: '¡Cultura y diversión en un solo lugar!',
  baseUrl: 'https://complejomushucruna.com'
});

export const primaryNavigation = Object.freeze([
  { label: 'Inicio', href: '/' },
  { label: 'Experiencias', href: '/experiencias/' },
  { label: 'Granja', href: '/granja/' },
  { label: 'Eventos', href: '/eventos/' },
  { label: 'Historia', href: '/historia/' },
  { label: 'Visítanos', href: '/visitanos/' }
]);
```

- [ ] **Step 4: Ejecutar la normalización y las pruebas**

Run: `cd website && node scripts/normalize-legacy.mjs /private/tmp/mr-elementor.tsv src/data/legacy-pages.json && npm test`

Expected: PASS; el JSON contiene una entrada por página Elementor exportada y los siete slugs históricos.

- [ ] **Step 5: Commit del modelo de contenido**

```bash
git add website/package.json website/scripts/normalize-legacy.mjs website/src/data/legacy-pages.json website/src/data/site.mjs website/tests/content.test.mjs
git commit -m "Crear inventario de contenido del sitio institucional"
```

### Task 2: Generador estático y contrato de páginas

**Files:**
- Create: `website/scripts/build.mjs`
- Create: `website/src/render/html.mjs`
- Create: `website/src/render/layout.mjs`
- Create: `website/src/render/components.mjs`
- Create: `website/src/pages.mjs`
- Test: `website/tests/build.test.mjs`

**Interfaces:**
- Consumes: `site`, `primaryNavigation`, `experiences`, `historicalEvents` y `LegacyPage[]` de Task 1.
- Produces: `escapeHtml(value: string): string`, `renderLayout(page: PageDefinition): string`, `renderPage(page: PageDefinition): string` y `buildSite(outputDirectory: string): Promise<string[]>`.

- [ ] **Step 1: Escribir las pruebas del contrato HTML**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

test('genera las seis rutas principales con metadatos y un h1', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-site-'));
  const files = await buildSite(output);
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('experiencias/index.html'));
  const home = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(home, /<title>Complejo Mushuc Runa/);
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1);
  assert.match(home, /<link rel="canonical" href="https:\/\/complejomushucruna.com\/">/);
});
```

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run: `cd website && npm test`

Expected: FAIL porque `scripts/build.mjs` todavía no existe.

- [ ] **Step 3: Implementar escape, layout, componentes y generador**

El layout debe incluir enlace de salto, cabecera, navegación, `main`, pie, canonical, descripción, Open Graph, CSS y script con `defer`. `buildSite` limpia únicamente el directorio temporal o `website/dist`, nunca un directorio remoto.

```js
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
```

- [ ] **Step 4: Ejecutar pruebas y construir la salida**

Run: `cd website && npm test && npm run build`

Expected: PASS y creación de las seis rutas principales más páginas históricas.

- [ ] **Step 5: Commit del generador**

```bash
git add website/scripts/build.mjs website/src/render website/src/pages.mjs website/tests/build.test.mjs
git commit -m "Construir generador estático del sitio institucional"
```

### Task 3: Sistema visual, interacción y páginas institucionales

**Files:**
- Create: `website/src/styles.css`
- Create: `website/src/site.js`
- Create: `website/public/assets/icons/favicon.svg`
- Modify: `website/src/pages.mjs`
- Modify: `website/src/render/components.mjs`
- Test: `website/tests/design.test.mjs`

**Interfaces:**
- Consumes: `PageDefinition` y componentes de Task 2.
- Produces: tokens CSS aprobados, componentes `hero()`, `sectionHeading()`, `experienceFeature()`, `eventTimeline()`, `visitCta()` y menú móvil progresivo.

- [ ] **Step 1: Probar tokens, accesibilidad y ausencia de dependencias externas**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('el CSS conserva los colores y las tipografías aprobadas', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  for (const token of ['#7C170F', '#AD140E', '#5B0B05', '#9E7721', '#E3B85D']) {
    assert.ok(css.includes(token));
  }
  assert.match(css, /Montserrat/);
  assert.match(css, /Roboto Slab/);
  assert.match(css, /prefers-reduced-motion/);
});
```

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run: `cd website && npm test`

Expected: FAIL porque `src/styles.css` no existe.

- [ ] **Step 3: Implementar el sistema visual y la interacción progresiva**

```css
:root {
  --color-rojo-profundo: #7C170F;
  --color-rojo-mushuc: #AD140E;
  --color-rojo-oscuro: #5B0B05;
  --color-dorado: #9E7721;
  --color-dorado-claro: #E3B85D;
  --color-blanco: #FFFFFF;
  --color-texto: #2E2927;
  --color-texto-suave: #7A7A7A;
  --color-morado-profundo: #6E2845;
  --color-morado-claro: #A388BE;
}
```

El menú móvil alterna `aria-expanded`, cierra con Escape y no oculta navegación cuando JavaScript está desactivado. Las seis páginas usan fotografías reales, espacios amplios y jerarquía editorial.

- [ ] **Step 4: Ejecutar pruebas y construcción**

Run: `cd website && npm test && npm run build`

Expected: PASS; los archivos CSS y JS aparecen en `dist/assets/` y cada página enlaza ambos correctamente.

- [ ] **Step 5: Commit del sistema visual**

```bash
git add website/src/styles.css website/src/site.js website/public/assets/icons/favicon.svg website/src/pages.mjs website/src/render/components.mjs website/tests/design.test.mjs
git commit -m "Aplicar identidad visual al sitio Complejo Mushuc Runa"
```

### Task 4: Medios inspeccionados y archivo histórico

**Files:**
- Create: `website/scripts/check-assets.mjs`
- Create: `website/public/assets/images/`
- Create: `website/public/assets/fonts/`
- Modify: `website/src/data/site.mjs`
- Modify: `website/src/pages.mjs`
- Test: `website/tests/assets.test.mjs`

**Interfaces:**
- Consumes: imágenes y fuentes recuperadas por SCP desde las rutas explícitas del WordPress.
- Produces: `assetManifest: AssetRecord[]`, imágenes web optimizadas y páginas históricas sin llamadas vencidas activas.

- [ ] **Step 1: Escribir pruebas de integridad de activos**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { assetManifest } from '../src/data/site.mjs';

test('cada activo publicado es local y usa una extensión permitida', () => {
  const allowed = /\.(?:avif|webp|jpe?g|png|svg|mp4|woff2)$/i;
  for (const asset of assetManifest) {
    assert.match(asset.path, allowed);
    assert.ok(asset.path.startsWith('/assets/'));
    assert.ok(!asset.path.includes('wp-content'));
  }
});
```

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run: `cd website && npm test`

Expected: FAIL porque `assetManifest` aún no está exportado.

- [ ] **Step 3: Copiar, inspeccionar y optimizar los medios necesarios**

Descargar por SCP únicamente las rutas referenciadas por las páginas institucionales y los originales principales del archivo. Validar cada archivo con `file` e ImageMagick; convertir fotografías a WebP con calidad 82 y ancho máximo 1920, manteniendo los logotipos PNG/SVG inspeccionados. Copiar Montserrat/Roboto/Roboto Slab desde los WOFF2 existentes y Handgoal desde el archivo legado únicamente si su publicación queda autorizada por el uso preexistente.

Run: `cd website && node scripts/check-assets.mjs public/assets`

Expected: salida `Activos válidos`, sin archivos ejecutables, referencias externas o extensiones fuera de lista.

- [ ] **Step 4: Construir y verificar el archivo histórico**

Run: `cd website && npm test && npm run build && node scripts/check-dist.mjs`

Expected: PASS; cada evento histórico tiene una ruta, año, etiqueta `Archivo histórico` y ningún botón de compra o inscripción vencido.

- [ ] **Step 5: Commit de medios y archivo**

```bash
git add website/public/assets website/scripts/check-assets.mjs website/src/data/site.mjs website/src/pages.mjs website/tests/assets.test.mjs
git commit -m "Migrar medios seguros y archivo histórico del Complejo"
```

### Task 5: QA integral, documentación y despliegue autorizado

**Files:**
- Create: `website/scripts/check-dist.mjs`
- Create: `website/public/robots.txt`
- Create: `website/public/sitemap.xml`
- Create: `website/public/404.html`
- Modify: `vault/_memoria-del-proyecto.md`
- Modify: `vault/_pendientes.md`
- Modify: `AGENTS.md`
- Test: `website/tests/dist.test.mjs`

**Interfaces:**
- Consumes: `website/dist/` completo de Tasks 1–4.
- Produces: validación reproducible, publicación HTTPS y trazabilidad del cierre.

- [ ] **Step 1: Probar enlaces, metadatos y referencias prohibidas**

```js
test('la salida no contiene referencias al runtime antiguo', async () => {
  const htmlFiles = await listFiles(distDirectory, (path) => path.endsWith('.html'));
  for (const path of htmlFiles) {
    const html = await readFile(path, 'utf8');
    assert.doesNotMatch(html, /complejomushucruna\.ec|wp-content|\.php\b/i);
    assert.match(html, /<meta name="description"/);
    assert.match(html, /<link rel="canonical"/);
  }
});
```

- [ ] **Step 2: Ejecutar la suite completa y comprobar cualquier falla real**

Run: `cd website && npm run check`

Expected: PASS con todas las rutas, recursos, enlaces internos y metadatos válidos.

- [ ] **Step 3: Crear respaldo no destructivo y subir la salida**

Crear en `/home/<usuario>/backups/complejomushucruna.com-20260831/` una copia de `index.html` y un inventario de archivos preexistentes. Subir el contenido de `website/dist/` a `/home/<usuario>/public_html/complejomushucruna.com/` mediante SCP o rsync sin `--delete`, sin tocar archivos de configuración.

- [ ] **Step 4: Verificar producción por SSH y HTTP**

Run:

```bash
curl -sSIL https://complejomushucruna.com/
curl -sSIL https://complejomushucruna.com/experiencias/
curl -sSIL https://complejomushucruna.com/granja/
curl -sSIL https://complejomushucruna.com/eventos/
curl -sSIL https://complejomushucruna.com/historia/
curl -sSIL https://complejomushucruna.com/visitanos/
```

Expected: `200` por HTTPS en las seis rutas, contenido `text/html`, sin redirecciones a `.ec` o dominios ajenos.

- [ ] **Step 5: Registrar cierre, commit y push**

Actualizar memoria, pendientes y bitácora con el alcance publicado, datos todavía por confirmar, respaldo y resultados HTTP. Ejecutar `git status`, añadir exclusivamente archivos de esta tarea, hacer commit y enviar `main` a `origin`.

```bash
git add website docs/superpowers vault/_memoria-del-proyecto.md vault/_pendientes.md AGENTS.md
git commit -m "Publicar sitio institucional sin WordPress"
git push origin main
```
