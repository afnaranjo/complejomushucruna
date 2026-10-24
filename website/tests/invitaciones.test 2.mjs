import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages } from '../src/pages.mjs';
import { combineTotals, createInvitacionesClient, dateLabel, ecuadorToday, INVITATIONS, invitationState } from '../src/admin/admin-invitaciones.js';
import { isPreview } from '../src/finados/influencer-invitation.js';

const render = route => { const page = pages.find(item => item.route === route); return page.render(page); };

test('Invitaciones aparece en el menú y permite la vista previa solo en su página', () => {
  const html = render('/admin/invitaciones/');
  assert.match(html, /href="\/admin\/invitaciones\/"[^>]*aria-current="page"/);
  assert.match(html, /frame-src 'self'/);
  assert.match(html, /data-admin-invitaciones/);
  assert.doesNotMatch(render('/admin/pase-dorado/'), /frame-src/);
});

test('cada pantalla de la invitación se abre en modo vista previa del propio sitio', () => {
  for (const invitation of INVITATIONS) for (const screen of invitation.screens) {
    assert.match(screen.path, /^\/[^/].*\?vista=1$/);
    assert.ok(pages.some(page => page.route === screen.path.split('?')[0]), screen.path);
  }
  assert.equal(isPreview('?vista=1'), true);
  assert.equal(isPreview('?c=abcdefghjk'), false);
});

test('estado, fecha y totales de la invitación', () => {
  assert.equal(ecuadorToday(new Date('2026-10-21T03:00:00Z')), '2026-10-20');
  assert.equal(invitationState('2026-10-15', '2026-10-20').label, 'Ya pasó');
  assert.equal(invitationState('2026-10-20', '2026-10-20').key, 'hoy');
  assert.equal(invitationState('2026-11-01', '2026-10-20').key, 'proxima');
  assert.equal(dateLabel('2026-10-15', '18:00'), '15 de octubre de 2026 · 18:00');
  assert.deepEqual(combineTotals({ totals: { total: 10, si: 6, no: 1, pendiente: 3, abrieron: 8 } }, { totals: { total: 4, si: 3, no: 0, pendiente: 1, por_aprobar: 2 } }),
    { invitados: 14, si: 9, no: 1, pendiente: 4, abrieron: 8, porAprobar: 2 });
});

test('el cliente solo lee la sesión y las listas', async () => {
  const client = createInvitacionesClient(undefined, async () => ({ ok: true, json: async () => ({ authenticated: true }) }));
  assert.deepEqual(await client.session(), { authenticated: true });
  const source = await readFile(new URL('../src/admin/admin-invitaciones.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /method: '(?:POST|PATCH|DELETE)'/);
});
