import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const pageTitles = new Map([
  [5, 'Kit global'],
  [6, 'Inicio'],
  [57, 'Historia'],
  [156, 'Cabecera'],
  [285, 'Pie'],
  [406, 'Granja Agroturística'],
  [806, 'Eventos'],
  [1212, 'Ubícanos'],
  [1279, 'Festival de Canto'],
  [1405, 'Finados 2022'],
  [1588, 'Toros'],
  [1771, 'Finados 2021'],
  [1822, 'Plantilla Finados 2021'],
  [1929, 'Finados 2023'],
  [2210, 'Plantilla ExpoFeria 2024'],
  [2271, 'Elementor #2271'],
  [2919, 'Finados 2025'],
  [2991, 'Navidad 2025'],
]);

const textKeyPattern = /(?:^|_)(?:title|text|editor|description|caption|button_text|heading|subtitle|name|address|testimonial_content)$/i;
const mediaPattern = /\.(?:avif|gif|jpe?g|png|svg|webp|mp4)(?:[?#].*)?$/i;

function decodeEntities(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function plainText(value) {
  return decodeEntities(String(value ?? ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addUrl(url, result) {
  const clean = url.replace(/[),.;]+$/, '');
  if (mediaPattern.test(clean)) {
    result.images.add(clean);
  } else {
    result.links.add(clean);
  }
}

function inspect(value, key, result) {
  if (typeof value === 'string') {
    for (const url of value.match(/https?:\/\/[^\s"'<>\\]+/g) ?? []) addUrl(url, result);
    if (textKeyPattern.test(key)) {
      const text = plainText(value);
      if (text.length > 1) result.texts.add(text);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) inspect(item, key, result);
    return;
  }

  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      inspect(childValue, childKey, result);
    }
  }
}

export function normalizeRows(tsv) {
  const pages = [];
  for (const row of tsv.split(/\r?\n/)) {
    if (!row.trim()) continue;
    const separator = row.indexOf('\t');
    if (separator < 1) continue;
    const id = Number(row.slice(0, separator));
    const tree = JSON.parse(row.slice(separator + 1));
    const result = { texts: new Set(), links: new Set(), images: new Set() };
    inspect(tree, 'root', result);
    pages.push({
      id,
      title: pageTitles.get(id) ?? `Página ${id}`,
      classification: id >= 1279 ? 'histórico' : 'institucional',
      texts: [...result.texts],
      links: [...result.links],
      images: [...result.images],
    });
  }
  return pages;
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    throw new Error('Uso: node scripts/normalize-legacy.mjs <entrada.tsv> <salida.json>');
  }
  const pages = normalizeRows(await readFile(inputPath, 'utf8'));
  await writeFile(outputPath, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
  console.log(`Contenido normalizado: ${pages.length} páginas`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
