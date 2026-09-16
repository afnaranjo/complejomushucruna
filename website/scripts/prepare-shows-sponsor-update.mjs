import { readFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// One-time mechanical export: no redraw or AI changes to the official artwork.
// Usage: node scripts/prepare-shows-sponsor-update.mjs SPONSORS.svg SHARP_MODULE
const [sourcePath, sharpModule] = process.argv.slice(2);
if (!sourcePath || !sharpModule) throw new Error('Indica el SVG oficial y el módulo Sharp.');
const original = await readFile(sourcePath);
const svg = original.toString('utf8');
if (!svg.includes('viewBox="0 0 2321 650"')
  || /<(?:script|foreignObject|image)\b/i.test(svg)
  || /(?:xlink:)?href="(?:https?:|file:|\/\/)/i.test(svg)) {
  throw new Error('El SVG no coincide con la composición vectorial revisada.');
}
const directory = new URL('../public/assets/finados/shows/', import.meta.url);
await copyFile(sourcePath, new URL('auspiciantes-finados-2026.svg', directory));
const sharp = createRequire(import.meta.url)(resolve(sharpModule));
// Official Plaza de la Luna lockup from the immutable full-resolution poster.
// This native crop excludes the date and neighboring performers.
await sharp(await readFile(new URL('cartel-shows-2481.webp', directory)))
  .extract({ left: 1139, top: 2615, width: 170, height: 165 })
  .webp({ lossless: true }).toFile(fileURLToPath(new URL('plaza-de-la-luna.webp', directory)));
console.log(`SHA-256 del SVG oficial: ${createHash('sha256').update(original).digest('hex')}`);
