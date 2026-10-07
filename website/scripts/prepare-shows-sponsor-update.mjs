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
const digest = createHash('sha256').update(original).digest('hex');
const approvedDigest = 'ac906043c241ba8f78768dd3e4d6eee864db538a135ede9e32ad68f22e44a1af';
// The October 7 master includes one small inert PNG and keeps the artwork otherwise vectorial.
const references = [...svg.matchAll(/(?:xlink:)?href=["']([^"']*)["']/gi)].map(match => match[1]);
const safeReference = value => {
  if (/^#[\w.-]+$/.test(value)) return true;
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const png = Buffer.from(value.slice('data:image/png;base64,'.length), 'base64');
  return png.length < 1_000_000 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
};
if (digest !== approvedDigest || !svg.includes('viewBox="0 0 2320 650"')
  || /<(?:script|foreignObject|iframe|object|embed)\b|\bon[a-z]+\s*=|<!ENTITY|<\?xml-stylesheet/i.test(svg)
  || references.some(value => !safeReference(value))) {
  throw new Error('El SVG no coincide con la composición vectorial revisada.');
}
const directory = new URL('../public/assets/finados/shows/', import.meta.url);
await copyFile(sourcePath, new URL('auspiciantes-finados-2026.svg', directory));
const sharp = createRequire(import.meta.url)(resolve(sharpModule));
// Refresh the optimized WebP used by the pages; preserve the exact SVG as the public master.
await sharp(original).resize({ width: 2320 }).webp({ quality: 90 })
  .toFile(fileURLToPath(new URL('auspiciantes-finados-2026.webp', directory)));
console.log(`SHA-256 del SVG oficial: ${digest}`);
