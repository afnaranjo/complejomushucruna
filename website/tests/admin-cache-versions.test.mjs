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
