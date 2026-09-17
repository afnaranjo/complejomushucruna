import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';
import { injectInvitationOpeningHeader, renderFairOpeningHeader, openingAssetVersion } from '../src/finados/opening-header.mjs';

test('las siete portadas públicas comparten la apertura y Voceros queda excluido', async t => {
  const output = await mkdtemp(join(tmpdir(), 'finados-opening-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const files = await buildSite(output);
  for (const file of ['index.html', 'finados/index.html', 'finados/shows/index.html',
    'acceso-compra-stands/index.html', 'acreditacion-de-medios/index.html',
    'finados/dignidades-finados-2025/index.html', 'invitaciones/index.html']) {
    const html = await readFile(join(output, file), 'utf8');
    assert.equal((html.match(/ data-fair-opening /g) ?? []).length, 1, file);
    assert.equal((html.match(/ data-presentation-countdown /g) ?? []).length, 1, file);
    assert.match(html, /data-target="2026-10-30T10:30:00-05:00"/);
    assert.match(html, /Viernes 30 de octubre de 2026/);
    assert.match(html, /<span>Bienvenidos a<\/span><span[^>]*>Finados Mushuc Runa <em>2026<\/em>/);
    assert.match(html, /La feria comienza en/);
    assert.match(html, /Hora de Ecuador/);
    assert.ok(html.includes(`/assets/finados/presentation.css?v=${openingAssetVersion}`));
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, file);
  }
  const vocerosFiles = files.filter(file => file.startsWith('finados/voceros/') && file.endsWith('.html'));
  assert.ok(vocerosFiles.length >= 9);
  for (const file of vocerosFiles) {
    const html = await readFile(join(output, file), 'utf8');
    assert.doesNotMatch(html, /data-fair-opening|presentation\.(?:css|js)/, file);
  }
  const home = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(home, /<h2 id="home-stands-title"/);
  assert.ok(home.indexOf('data-fair-opening') < home.indexOf('id="home-stands-title"'));
  assert.match(home, /home-chapter--identity/);
  const media = await readFile(join(output, 'acreditacion-de-medios/index.html'), 'utf8');
  assert.match(media, /15 de septiembre/);
  const dignity = await readFile(join(output, 'finados/dignidades-finados-2025/index.html'), 'utf8');
  assert.match(dignity, /Memoria de la 5\.ª edición · 2025/);
});

test('Invitaciones preserva el RSVP y traslada la cabecera al documento desempaquetado', async () => {
  const original = await readFile(new URL('../public/invitaciones/index.html', import.meta.url), 'utf8');
  const result = injectInvitationOpeningHeader(original, '/invitaciones/');
  assert.equal(injectInvitationOpeningHeader(result, '/invitaciones/'), result);
  assert.match(result, /doc\.body\.prepend\(fairHeader\.cloneNode\(true\)\)/);
  assert.match(result, /fairRuntime\.src = '\/assets\/finados\/presentation\.js\?v=20260917-fair-start-1'/);
  assert.ok(result.indexOf('doc.body.prepend') < result.indexOf('document.documentElement.replaceWith'));
  const encodedApp = original.split(/\r?\n/).find(line => line.startsWith('"<!DOCTYPE html>'));
  assert.ok(encodedApp, 'La aplicación congelada debe existir');
  assert.ok(result.includes(encodedApp), 'El bundle RSVP completo se conserva idéntico');
  for (const value of ["const endpoint = '/api/invitaciones-rsvp/';", 'data-invitation-company', 'showInvitationWelcome(submission)']) {
    assert.ok(result.includes(value));
  }
  assert.equal(injectInvitationOpeningHeader(original, '/finados/voceros/'), original);
  assert.equal(injectInvitationOpeningHeader(original, '/historia/'), original);
  assert.throws(() => injectInvitationOpeningHeader('<html><body></body></html>', '/invitaciones/'), /punto de integración/);
});

test('las variantes no generan otro H1 y escapan los identificadores', () => {
  const compact = renderFairOpeningHeader({ compact: true, id: '"<unsafe>', titleId: '"<unsafe>' });
  assert.doesNotMatch(compact, /<h1\b|id=""<unsafe>/);
  assert.match(compact, /id="&quot;&lt;unsafe&gt;"/);
  assert.match(compact, /presentation-hero--compact/);
  assert.match(renderFairOpeningHeader({ compact: true, standalone: true }), /presentation-hero--standalone/);
  assert.equal((renderFairOpeningHeader().match(/<h1\b/g) ?? []).length, 1);
});
