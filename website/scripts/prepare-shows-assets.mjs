import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// One-time export, not a build dependency. The supplied SVG remains immutable.
// Usage: node scripts/prepare-shows-assets.mjs SOURCE.svg HERO.png SHARP_MODULE
const [sourcePath, heroPath, sharpModule] = process.argv.slice(2);
if (!sourcePath || !heroPath || !sharpModule) {
  throw new Error('Indica el SVG original, la imagen del header y el módulo Sharp.');
}
const sharp = createRequire(import.meta.url)(resolve(sharpModule));
const original = await readFile(sourcePath);
const svg = original.toString('utf8');
if (!svg.includes('viewBox="0 0 2481 3508"')
  || (svg.match(/<image\b/g) ?? []).length !== 1
  || /<(?:script|foreignObject)\b/i.test(svg)
  || /(?:xlink:)?href="(?:https?:|file:|\/\/)/i.test(svg)) {
  throw new Error('El archivo no coincide con la estructura revisada del afiche.');
}
const directory = join(dirname(fileURLToPath(import.meta.url)), '../public/assets/finados/shows');
await mkdir(directory, { recursive: true });
// Native SVG viewports preserve every pixel of the artwork in the two sections.
const body = Buffer.from(svg.replace('viewBox="0 0 2481 3508"', 'viewBox="0 0 2481 3300"'));
const sponsors = Buffer.from(svg.replace('viewBox="0 0 2481 3508"', 'viewBox="0 3300 2481 208"'));
for (const width of [1240, 2481]) {
  await sharp(body, { limitInputPixels: 20_000_000 }).resize({ width }).webp({ lossless: true })
    .toFile(join(directory, `cartel-shows-${width}.webp`));
}
await sharp(sponsors, { limitInputPixels: 20_000_000 }).webp({ lossless: true })
  .toFile(join(directory, 'auspiciantes-finados-2026.webp'));
for (const width of [800, 1600]) {
  await sharp(heroPath).resize({ width, withoutEnlargement: true }).webp({ quality: 86 })
    .toFile(join(directory, `ambiente-concierto-${width}.webp`));
}
console.log(`SHA-256 del SVG original: ${createHash('sha256').update(original).digest('hex')}`);
console.log(`Activos exportados en ${directory}`);
