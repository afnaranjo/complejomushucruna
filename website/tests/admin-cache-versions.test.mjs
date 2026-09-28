import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Si el menú lateral cambia de versión, cada script de página que lo importa también debe renovar la
// suya: el navegador guarda los módulos por su URL y, sin renovarla, sigue usando el menú viejo.
test('los scripts administrativos que importan el menú renuevan su versión junto con él', async () => {
  const page = await readFile(new URL('../src/admin/page.mjs', import.meta.url), 'utf8');
  const urls = [...page.matchAll(/\/assets\/admin\/([a-z-]+\.js)\?v=(\d{8})/g)];
  assert.ok(urls.length > 5);
  for (const [, file, pageDate] of urls) {
    const source = await readFile(new URL(`../src/admin/${file}`, import.meta.url), 'utf8');
    const imported = source.match(/sidebar\.js\?v=(\d{8})/);
    if (!imported) continue;
    assert.ok(pageDate >= imported[1], `${file} importa sidebar.js del ${imported[1]} pero su versión es del ${pageDate}`);
  }
});

test('Mushuc Freestyle muestra las cuentas sin ficha arriba y abiertas', async () => {
  const { renderAdminMfsPage } = await import('../src/admin/page.mjs');
  const html = renderAdminMfsPage({ route: '/admin/mfs/', title: 'Mushuc Freestyle', description: '' });
  assert.ok(html.indexOf('data-pending-panel') < html.indexOf('data-admin-filters'));
  const js = await readFile(new URL('../src/admin/admin-mfs.js', import.meta.url), 'utf8');
  assert.match(js, /pendingPanel\.open = true/);
  assert.match(js, /'Incompleta'/);
});

test('los calendarios caben: la lista va arriba salvo en pantallas anchas y el celular abre en el día', async () => {
  const css = await readFile(new URL('../src/admin/admin.css', import.meta.url), 'utf8');
  assert.match(css, /\.calendar-layout \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /@media \(min-width: 1540px\) \{\r?\n  \.calendar-layout \{ grid-template-columns: minmax\(0, 15rem\) minmax\(0, 1fr\); \}/);
  assert.match(css, /\.calendar-hours \{ position: sticky; left: 0;/);
  for (const file of ['admin-produccion.js', 'admin-medios-gira.js', 'admin-creadoras.js']) {
    const js = await readFile(new URL(`../src/admin/${file}`, import.meta.url), 'utf8');
    assert.match(js, /matchMedia\?\.\('\(max-width: 700px\)'\)\.matches\) \{\r?\n    state\.view = 'day';/, file);
  }
});

test('el inicio de sesión renueva la sesión y reintenta una vez si la página quedó vieja', async () => {
  const js = await readFile(new URL('../src/admin/admin.js', import.meta.url), 'utf8');
  assert.match(js, /if \(error\.status !== 403 && error\.status !== 0\) throw error;\r?\n\s+await client\.session\(\);\r?\n\s+data = await client\.login\(username, secret\);/);
});
