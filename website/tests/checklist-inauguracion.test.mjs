import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderChecklistInauguracionPage } from '../src/finados/checklist-inauguracion-page.mjs';
import { pages } from '../src/pages.mjs';

test('el checklist de la inauguración es público, sin indexar y con su propia ruta', async () => {
  const page = pages.find((item) => item.route === '/inauguracion/checklist/');
  assert.ok(page, 'falta la ruta /inauguracion/checklist/');
  assert.equal(page.indexable, false);
  assert.ok(pages.some((item) => item.route === '/inauguracion/'), 'la invitación de voceros sigue en /inauguracion/');
  const html = renderChecklistInauguracionPage(page);
  assert.match(html, /noindex, nofollow, noarchive/);
  assert.match(html, /connect-src [^;]*api\.expoferiamushucruna\.com\/api\//);
  assert.doesNotMatch(html, /style="/, 'la política de seguridad no permite estilos en línea');
  assert.match(html, /id="confirmBox" hidden/);
  const css = await readFile(new URL('../src/finados/checklist-inauguracion.css', import.meta.url), 'utf8');
  assert.match(css, /\[hidden\]\{display:none!important\}/);
  const js = await readFile(new URL('../src/finados/checklist-inauguracion.js', import.meta.url), 'utf8');
  assert.match(js, /\/checklist\/\$\{BOARD\}/);
  assert.doesNotMatch(js, /localStorage\.setItem\((?!HIDE_KEY)/, 'las marcas no se guardan solo en el navegador');
});
