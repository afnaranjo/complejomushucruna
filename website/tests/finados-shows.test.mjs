import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pages } from '../src/pages.mjs';
import { primaryNavigation } from '../src/data/site.mjs';
import { showsProgram, plazaShows, showsAttractions, showsSponsors } from '../src/finados/shows-program.mjs';
import { renderFinadosFooter } from '../src/finados/footer.mjs';
import { buildSite } from '../scripts/build.mjs';

const page = pages.find(page => page.route === '/finados/shows/');
const html = () => page.render(page);

test('SHOWS es una subpágina de Finados antes de VENTA DE STANDS', () => {
  assert.ok(page);
  assert.equal(page.indexable, false);
  assert.deepEqual(primaryNavigation[1].children.slice(0, 2).map(item => item.label), ['SHOWS', 'VENTA DE STANDS']);
  assert.equal(primaryNavigation[1].children[0].href, page.route);
  const output = html();
  assert.match(output, /href="\/finados\/shows\/"[^>]*aria-current="page"/);
  assert.equal((output.match(/<h1\b/g) ?? []).length, 1);
  assert.match(output, /canonical" href="https:\/\/complejomushucruna.com\/finados\/shows\/"/);
  assert.doesNotMatch(output, /href="\/assets\/styles\.css|\/assets\/fonts\//);
});

test('la programación respeta la jerarquía y el orden del afiche, no el calendario', () => {
  assert.deepEqual(showsProgram.map(show => show.artists), [
    ['Waldokinc', 'Golpe a Golpe', 'Guaynaa'],
    ['Grupo Bodega', 'Pablo Noboa'],
    ['William Luna', 'Kjarkas'],
    ['Cliver y su Grupo Coralí', 'Sonido Mazter', 'K’ramelo Latino'],
    ['El Loco Abraham'],
  ]);
  assert.deepEqual(showsProgram.map(show => show.iso), ['2026-11-01', '2026-10-30', '2026-10-31', '2026-11-02', '2026-11-03']);
  assert.equal(showsProgram[0].featured, true);
  const output = html();
  let position = output.indexOf('shows-date-list');
  for (const name of showsProgram.flatMap(show => show.artists)) {
    const next = output.indexOf(name, position);
    assert.ok(next > position, `${name} debe mantener su posición`);
    position = next;
  }
  assert.doesNotMatch(output, /Los Kjarkas/i);
  assert.match(output, /Shows desde las <b>18:00<\/b>/);
});

test('conserva los shows de Plaza de la Luna y los atractivos del arte', () => {
  assert.deepEqual(plazaShows.map(show => [show.artist, show.iso]), [['Hueveando', '2026-10-31'], ['Las Ñañas', '2026-11-01']]);
  const output = html();
  for (const attraction of showsAttractions) assert.ok(output.includes(attraction));
  assert.match(output, /Más de 25\.000/);
  assert.match(output, /vasos de colada morada<br>rumbo al récord/);
  assert.match(output, /Luis Alfonso Chango P\./);
  assert.match(output, /código QR de información/);
  assert.match(output, /shows-plaza-brand[^>]*><img[^>]*plaza-de-la-luna\.webp[^>]*width="170" height="165" alt="Plaza de la Luna"/);
  assert.equal((output.match(/class="shows-plaza-show"/g) ?? []).length, 2);
  assert.match(output, /<h4>Hueveando<\/h4><time datetime="2026-10-31">31 octubre<\/time>/);
  assert.match(output, /<h4>Las Ñañas<\/h4><time datetime="2026-11-01">01 noviembre<\/time>/);
});

test('todos los auspiciantes están en el footer, sin cambios en otros pies de campaña', () => {
  const output = html();
  const sponsor = output.indexOf('class="shows-sponsors"');
  assert.ok(sponsor > output.indexOf('</main>'));
  assert.ok(sponsor > output.indexOf('<footer'));
  assert.ok(sponsor < output.lastIndexOf('</footer>'));
  for (const name of showsSponsors) assert.ok(output.includes(name), name);
  assert.equal((output.match(/auspiciantes-finados-2026\.svg/g) ?? []).length, 2);
  assert.match(output, /width="2321" height="650"/);
  assert.match(output, /Organiza: Luis Alfonso Chango P\. Auspician:/);
  assert.ok(output.includes('Textilana Cooperativa de Ahorro y Crédito'));
  assert.doesNotMatch(renderFinadosFooter(), /shows-sponsors/);
  assert.match(output, /shows-sponsors-art[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(output, /shows-sponsors-scroll|auspiciantes-finados-2026\.webp/);
});

test('la composición SVG de auspiciantes se conserva idéntica al archivo entregado', async () => {
  const original = await readFile(new URL('../public/assets/finados/shows/auspiciantes-finados-2026.svg', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), '1464352f77e98cfb7496fa9e8057638ded5c5cd9229e20608e3e857374106aaf');
  const svg = original.toString('utf8');
  assert.match(svg, /viewBox="0 0 2321 650"/);
  assert.doesNotMatch(svg, /<(?:script|foreignObject|image)\b|(?:xlink:)?href="(?:https?:|file:|\/\/)/i);
});

test('el hero es conceptual y las imágenes oficiales son locales y adaptables', () => {
  const output = html();
  assert.match(output, /Imagen conceptual/);
  assert.match(output, /fetchpriority="high"/);
  assert.match(output, /source media="\(max-width: 640px\)"/);
  assert.match(output, /1240w, [^" ]+ 2481w/);
  assert.match(output, /width="2481" height="3300"/);
  assert.doesNotMatch(output, /data:image|R:\\|\.codex|base64/i);
  assert.match(output, /href="#shows"/);
  for (const link of output.match(/<a [^>]*cartel-shows-2481[^>]*>/g) ?? []) {
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
  }
});

test('los estilos amplían los shows y adaptan la composición completa sin desbordes', async () => {
  const css = await readFile(new URL('../src/finados/shows.css', import.meta.url), 'utf8');
  const theme = await readFile(new URL('../src/finados/finados.css', import.meta.url), 'utf8');
  assert.match(css, /padding-top: 132px/);
  assert.match(css, /padding-top: 108px/);
  assert.match(css, /minmax\(0, 1fr\)/);
  assert.match(css, /aspect-ratio: 2321 \/ 650/);
  assert.match(css, /shows-plaza-show h4[^}]*clamp\(2rem, 3\.8vw, 3\.4rem\)/);
  assert.match(css, /shows-plaza-list \{ grid-template-columns: 1fr;/);
  assert.doesNotMatch(css, /min-width: 1050px|shows-sponsors-scroll/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max-width: 760px/);
  assert.doesNotMatch(css, /:root|@font-face|\.site-header|backdrop-filter/);
  assert.match(theme, /@source "\.\/shows-page\.mjs";/);
});

test('los activos WebP conservan su formato y presupuestos de tamaño', async () => {
  for (const [name, budget] of [
    ['ambiente-concierto-800', 100_000], ['ambiente-concierto-1600', 200_000],
    ['auspiciantes-finados-2026', 100_000], ['cartel-shows-1240', 1_600_000], ['cartel-shows-2481', 4_500_000],
    ['plaza-de-la-luna', 30_000],
  ]) {
    const path = new URL(`../public/assets/finados/shows/${name}.webp`, import.meta.url);
    const buffer = await readFile(path);
    assert.equal(buffer.subarray(0, 4).toString(), 'RIFF');
    assert.equal(buffer.subarray(8, 12).toString(), 'WEBP');
    assert.ok((await stat(path)).size <= budget, name);
  }
});

test('el build entrega SHOWS con CSS, imágenes y aviso de cookies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'finados-shows-'));
  const files = await buildSite(directory);
  assert.ok(files.includes('finados/shows/index.html'));
  assert.ok(files.includes('assets/finados/shows.css'));
  assert.ok(files.includes('assets/finados/shows/auspiciantes-finados-2026.webp'));
  assert.ok(files.includes('assets/finados/shows/auspiciantes-finados-2026.svg'));
  assert.ok(files.includes('assets/finados/shows/plaza-de-la-luna.webp'));
  const output = await readFile(join(directory, 'finados/shows/index.html'), 'utf8');
  assert.match(output, /data-cookie-consent/);
  assert.match(output, /Nuestro sitio web utiliza cookies para mejorar tu navegación\./);
  assert.match(output, /shows\.css\?v=20260916-shows-2/);
});
