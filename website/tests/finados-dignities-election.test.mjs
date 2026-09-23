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
  assert.equal(dignitiesAssetVersion, '20260923-dignities-4');
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

test('los diez artes conservan la composición aprobada y la fecha corregida a OCTUBRE', async () => {
  const approvedHashes = new Map([
    ['golpe-a-golpe', '7c38b6fac9a1e37239bb3d270b9c33e7230530f80276589eddf8cfdac4c603cc'],
    ['guaynaa', 'f651f5a0b624e4fa51f4403a449c31a08e12917dc971b8294e27b7863cf6e976'],
    ['hueveando', '17dd3461c3936f382961fb9591ee30995cb1d18ca9062cbfff19362944488903'],
    ['kike-jav', '7b22ee87cabb9ae853c9c30544d32d4605c2273ffe2c1d1c0eecc9af4cb23b79'],
    ['waldokinc', '6a8e0ca935df30a437a2b7e1b79b0618e7f0718f3ca9609fa2e381b176c1ba50'],
    ['william-luna', 'b0613707608781dc160608d3c512bd40d1bba0f11ae43280893ede8a99b6a03a'],
    ['karina-chango', '998e68b01c9d5eb8dac630af89e1cea550452ab7e6218a43a5f4f043d832d961'],
    ['kramelo-latino', '73e25f7b442ae7c506d6a852c841ecc8dd207d07c81dc5635c62a9df46c550de'],
    ['las-diablitas-taz-taz', '8997998999be6851af7bcac7e2ed740d410153e02488d67d324c12eeb26dc572'],
    ['las-nanas', '7eba4ca891fec5c388ea42657355971f6c8b78837bcc0af8d9dd45a8110a5346'],
  ]);

  for (const candidate of dignityCandidates) {
    const buffer = await readFile(new URL(`../public${candidate.asset}`, import.meta.url));
    assert.equal(
      createHash('sha256').update(buffer).digest('hex'),
      approvedHashes.get(candidate.slug),
      candidate.name,
    );
  }
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
