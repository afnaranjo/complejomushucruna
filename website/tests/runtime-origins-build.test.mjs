import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

test('build multi-origen publica todas las dependencias ESM y renueva los clientes', async t => {
  const output = await mkdtemp(join(tmpdir(), 'runtime-origins-build-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const files = new Set(await buildSite(output));
  const runtime = 'assets/finados/runtime-origins.mjs';
  assert.ok(files.has(runtime), `Dependencia pública ausente: ${runtime}`);
  assert.equal(await readFile(join(output, runtime), 'utf8'),
    await readFile(new URL('../src/finados/runtime-origins.mjs', import.meta.url), 'utf8'));

  const pending = ['assets/admin/admin.js', 'assets/finados/vocero-portal.js',
    'assets/finados/vocero-verification.js'];
  const checked = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (checked.has(file)) continue;
    checked.add(file);
    assert.ok(files.has(file), `Dependencia pública ausente: ${file}`);
    const source = await readFile(join(output, file), 'utf8');
    for (const [, specifier] of source.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]/g)) {
      const dependency = posix.normalize(posix.join(posix.dirname(file), specifier.split(/[?#]/)[0]));
      assert.ok(files.has(dependency), `${file} importa una dependencia no publicada: ${dependency}`);
      pending.push(dependency);
    }
  }
  assert.ok(checked.has(runtime));
  assert.ok(checked.has('assets/finados/qrcode-generator.mjs'));

  for (const [route, script] of [
    ['admin', 'admin/admin.js'],
    ['finados/voceros/acceso', 'finados/vocero-portal.js'],
    ['finados/voceros/mi-registro', 'finados/vocero-portal.js'],
    ['finados/voceros/restablecer', 'finados/vocero-portal.js'],
    ['finados/voceros/verificar', 'finados/vocero-verification.js'],
  ]) {
    const html = await readFile(join(output, route, 'index.html'), 'utf8');
    const version = script === 'admin/admin.js' ? '20260921-admin-top20-1' : script === 'finados/vocero-verification.js' ? '20260918-multi-origin-1' : '20260918-navigation-progress-1';
    assert.ok(html.includes(`/assets/${script}?v=${version}`),
      `Versión de caché sin renovar: ${route}`);
  }

  const renewed = ['site.js', 'finados/finados.js', 'finados/navigation.css', 'finados/vocero-portal.js'];
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    const html = await readFile(join(output, file), 'utf8');
    for (const asset of renewed) {
      const references = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)(?:\?([^" ]+))?"/g)]
        .filter(([, path]) => path === `/assets/${asset}`);
      for (const [, , query] of references) {
        assert.equal(new URLSearchParams(query).get('v'), '20260918-navigation-progress-1', `${file}: ${asset}`);
        assert.ok(files.has(`assets/${asset}`), `Recurso sin publicar: ${asset}`);
      }
    }
    for (const [, , query] of [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)(?:\?([^" ]+))?"/g)]
      .filter(([, path]) => path === '/assets/admin/admin.js')) {
      assert.equal(new URLSearchParams(query).get('v'), '20260921-admin-top20-1', `${file}: admin/admin.js`);
      assert.ok(files.has('assets/admin/admin.js'), 'Recurso sin publicar: admin/admin.js');
    }
  }
});
