import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

import { pages } from '../src/pages.mjs';
import {
  dignityCandidates,
  dignitiesAssetVersion,
  renderDignitiesElection,
} from '../src/finados/dignities-election.mjs';

const finadosPage = pages.find(page => page.route === '/finados/');
const html = () => finadosPage.render(finadosPage);

test('ordena los diez nominados por dignidad y conserva los nombres entregados', () => {
  assert.equal(dignitiesAssetVersion, '20260922-dignities-3');
  assert.deepEqual(
    dignityCandidates.filter(candidate => candidate.category === 'rey-pan').map(candidate => candidate.name),
    ['Golpe a Golpe', 'Guaynaa', 'Hueveando', 'Kike Jav', 'Waldokinc', 'William Luna'],
  );
  assert.deepEqual(
    dignityCandidates.filter(candidate => candidate.category === 'colada-morada').map(candidate => candidate.name),
    ['Karina Chango', 'Kramelo Latino', 'Las Diablitas Taz Taz', 'Las Ñañas'],
  );
  assert.equal(new Set(dignityCandidates.map(candidate => candidate.asset)).size, 10);
});

test('la elección aparece debajo de la franja lila con fecha y llamados claros', () => {
  const output = html();
  const strip = output.indexOf('aria-label="Mensaje principal"');
  const election = output.indexOf('id="eleccion-dignidades"');
  const territory = output.indexOf('El territorio');
  assert.ok(strip >= 0 && strip < election);
  assert.ok(election < territory);
  assert.match(output, /<span>Tú eliges<\/span> a las próximas dignidades/);
  assert.match(output, /Rey Pan y Señorita Colada Morada/);
  assert.match(output, /datetime="2026-10-27">27 de octubre/);
  assert.match(output, /Conoce a quienes quieren llevar la corona/);
  assert.match(output, /Apoya a tu favorito/);
  assert.match(output, /Vota en los canales oficiales/);
  assert.equal((output.match(/class="dignity-candidate"/g) ?? []).length, 10);
  assert.equal((output.match(/target="_blank" rel="noopener noreferrer"/g) ?? []).length >= 10, true);
  assert.equal(output.includes(renderDignitiesElection()), true);
});

test('los artes optimizados están presentes, son WebP y respetan el presupuesto', async () => {
  for (const candidate of dignityCandidates) {
    const url = new URL(`../public${candidate.asset}`, import.meta.url);
    const buffer = await readFile(url);
    assert.equal(buffer.subarray(0, 4).toString(), 'RIFF', candidate.name);
    assert.equal(buffer.subarray(8, 12).toString(), 'WEBP', candidate.name);
    assert.ok((await stat(url)).size <= 1_500_000, `${candidate.name} supera el presupuesto web`);
  }
});

test('Las Ñañas usa la composición final completa con foto grande y tipografías integradas', async () => {
  const candidate = dignityCandidates.find(item => item.slug === 'las-nanas');
  const buffer = await readFile(new URL(`../public${candidate.asset}`, import.meta.url));
  assert.equal(
    createHash('sha256').update(buffer).digest('hex'),
    '7eba4ca891fec5c388ea42657355971f6c8b78837bcc0af8d9dd45a8110a5346',
  );
});

test('los estilos de la elección son aislados, responsivos y sin anchos rígidos', async () => {
  const css = await readFile(new URL('../src/finados/dignities-election.css', import.meta.url), 'utf8');
  assert.match(css, /\.dignities-election\s*\{/);
  assert.match(css, /\.dignity-candidates\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.dignity-candidates/);
  assert.match(css, /aspect-ratio:\s*1080\s*\/\s*1350/);
  assert.match(css, /\.dignity-ballot__header h3\s*\{[^}]*margin:\s*clamp\([^;]+\)\s+0\s+0;/s);
  assert.doesNotMatch(css, /\.dignities-election[^}]*min-width:\s*10\d{2}px/s);
});
