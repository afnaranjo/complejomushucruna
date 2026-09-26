import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { pages } from '../src/pages.mjs';
import { applyAccess, canSee } from '../src/admin/sidebar.js';
import { createUsuariosClient, describeActivity, ecuadorTime, setupUrl } from '../src/admin/admin-usuarios.js';
import { passwordProblem, tokenFrom } from '../src/admin/admin-activar.js';

function fakeAside(current, modules) {
  const items = modules.map(module => ({ dataset: { module }, hidden: false }));
  const name = { textContent: '' };
  const role = { textContent: '' };
  return {
    items, name, role, dataset: { access: 'pending', currentModule: current },
    querySelectorAll: () => items,
    querySelector: selector => (selector === '[data-admin-sidebar-user]' ? name : selector === '[data-admin-sidebar-role]' ? role : null),
  };
}

test('cada rol ve solo sus módulos y sale de una sección ajena', () => {
  const comunicacion = { modules: ['medios'], role: 'Comunicación', full_name: 'Ana Medios', home: '/admin/medios/' };
  assert.equal(canSee(comunicacion, 'medios'), true);
  assert.equal(canSee(comunicacion, 'creadoras'), false);
  assert.equal(canSee({ modules: ['*'] }, 'un-modulo-nuevo'), true, 'Administración ve también lo que se cree después');
  assert.equal(canSee(comunicacion, ''), true);

  const aside = fakeAside('creadoras', ['panel', 'medios', 'creadoras', 'usuarios']);
  assert.equal(applyAccess(aside, comunicacion), '/admin/medios/', 'si abre Creadoras, lo lleva a su portada');
  assert.deepEqual(aside.items.map(item => item.hidden), [true, false, true, true]);
  assert.equal(aside.dataset.access, 'ready');
  assert.equal(aside.name.textContent, 'Ana Medios');
  assert.equal(aside.role.textContent, 'Rol: Comunicación');
  assert.equal(applyAccess(fakeAside('medios', ['medios']), comunicacion), null, 'en su propio módulo se queda');
});

test('Usuarios arma el enlace, lee la hora de Ecuador y cuenta la actividad en palabras', () => {
  assert.equal(setupUrl('https://finados.expoferiamushucruna.com', 'a'.repeat(64)), `https://finados.expoferiamushucruna.com/admin/activar/?token=${'a'.repeat(64)}`);
  assert.equal(ecuadorTime('2026-09-26 23:10:00'), '26/09/2026 18:10');
  assert.equal(ecuadorTime(''), '');
  assert.equal(describeActivity('creadora.shift_updated'), 'cambió un turno · Creadoras');
  assert.equal(describeActivity('media.status_changed'), 'cambió un estado · Medios');
  assert.equal(describeActivity('admin.login'), 'entró al panel · Panel');
  assert.equal(describeActivity('nuevo.algo'), 'hizo un cambio (nuevo.algo) · Panel');
});

test('el enlace de contraseña solo acepta un token válido y una contraseña larga y repetida', () => {
  assert.equal(tokenFrom(`?token=${'b'.repeat(64)}`), 'b'.repeat(64));
  assert.equal(tokenFrom('?token=corto'), '');
  assert.equal(tokenFrom(`?token=${'B'.repeat(64)}`), '');
  assert.equal(passwordProblem('corta', 'corta'), 'La contraseña debe tener al menos 10 caracteres.');
  assert.equal(passwordProblem('una-frase-larga', 'otra-frase-larga'), 'Las dos contraseñas no coinciden.');
  assert.equal(passwordProblem('una-frase-larga', 'una-frase-larga'), '');
});

test('el cliente de Usuarios solo habla con sus rutas', async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push([url.replace('https://finados.complejomushucruna.com/api', ''), options.method]); return { ok: true, json: async () => ({ csrf: 'x' }) }; };
  const client = createUsuariosClient('https://finados.complejomushucruna.com/api', fetcher);
  await client.session();
  await client.load();
  await client.createUser({ username: 'ana', full_name: 'Ana', role: 'a'.repeat(32) });
  await client.updateUser('b'.repeat(32), { active: false });
  await client.newLink('b'.repeat(32));
  await client.updateRole('c'.repeat(32), { name: 'X', modules: [] });
  await client.activity('b'.repeat(32));
  assert.deepEqual(calls.slice(1), [
    ['/admin-users', 'GET'], ['/admin-users', 'POST'], [`/admin-users/${'b'.repeat(32)}`, 'PATCH'], [`/admin-users/${'b'.repeat(32)}/enlace`, 'POST'],
    [`/admin-roles/${'c'.repeat(32)}`, 'PATCH'], [`/admin-activity?user=${'b'.repeat(32)}`, 'GET'],
  ]);
  await assert.rejects(client.request('/voceros'), /Ruta de API no permitida/);
});

test('se publican Usuarios y la página del enlace, y el menú marca el módulo de cada opción', async t => {
  const output = await mkdtemp(join(tmpdir(), 'usuarios-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const files = await buildSite(output);
  for (const file of ['admin/usuarios/index.html', 'admin/activar/index.html', 'assets/admin/admin-usuarios.js', 'assets/admin/admin-activar.js']) assert.ok(files.includes(file), file);
  for (const route of ['/admin/usuarios/', '/admin/activar/']) assert.equal(pages.find(page => page.route === route).indexable, false);

  const html = await readFile(join(output, 'admin/usuarios/index.html'), 'utf8');
  for (const marker of ['data-admin-usuarios', 'data-user-rows', 'data-role-list', 'data-activity-list', 'data-user-dialog', 'data-link-box']) assert.ok(html.includes(marker), marker);
  assert.match(html, /data-access="pending" data-current-module="usuarios"/);
  assert.match(html, /href="\/admin\/usuarios\/" aria-current="page" data-module="usuarios"/);
  for (const module of ['panel', 'noticias', 'voceros', 'medios', 'produccion', 'emprendedores', 'creadoras', 'mfs']) assert.match(html, new RegExp(`data-module="${module}"`), module);
  assert.doesNotMatch(html, /fbevents|connect\.facebook|\sstyle="/);

  const setup = await readFile(join(output, 'admin/activar/index.html'), 'utf8');
  assert.match(setup, /data-admin-activar/);
  assert.match(setup, /autocomplete="new-password"/);
  assert.doesNotMatch(setup, /admin-sidebar|fbevents/);

  const medios = await readFile(join(output, 'admin/medios/index.html'), 'utf8');
  assert.match(medios, /data-current-module="medios"/);
  const login = await readFile(join(output, 'admin/index.html'), 'utf8');
  assert.match(login, /Entra con tu propio usuario/);
  const bundle = await readFile(join(output, 'assets/admin/admin-usuarios.js'), 'utf8');
  assert.match(bundle, /const LOCAL_API = null;/);
});
