import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path, root));
    else files.push(relative(root, path).split(sep).join('/'));
  }
  return files;
}

function internalTarget(url) {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean || !clean.startsWith('/')) return null;
  if (clean === '/') return 'index.html';
  const withoutSlash = clean.slice(1);
  if (clean.endsWith('/')) return `${withoutSlash}index.html`;
  return withoutSlash;
}

export async function checkDist(directory) {
  const root = resolve(directory);
  const files = await listFiles(root);
  const fileSet = new Set(files);
  const html = files.filter((path) => path.endsWith('.html'));
  const errors = [];
  let checkedLinks = 0;

  for (const path of html) {
    const content = await readFile(join(root, path), 'utf8');
    if (/complejomushucruna\.ec|wp-content|\.php\b/i.test(content)) {
      errors.push(`${path}: contiene una referencia al runtime antiguo`);
    }
    if (!/<meta name="description" content="[^"]+">/.test(content)) {
      errors.push(`${path}: falta meta description`);
    }
    if (!/<link rel="canonical" href="https:\/\/complejomushucruna\.com\/[^"]*">/.test(content)) {
      errors.push(`${path}: falta canonical del dominio .com`);
    }
    if ((content.match(/<h1\b/g) ?? []).length !== 1) {
      errors.push(`${path}: debe contener exactamente un h1`);
    }

    for (const match of content.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1];
      checkedLinks += 1;
      const target = internalTarget(url);
      if (target && !fileSet.has(target)) errors.push(`${path}: recurso inexistente ${url}`);
    }
  }

  const cssPath = 'assets/styles.css';
  if (fileSet.has(cssPath)) {
    const css = await readFile(join(root, cssPath), 'utf8');
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      checkedLinks += 1;
      const target = internalTarget(match[1]);
      if (target && !fileSet.has(target)) errors.push(`${cssPath}: recurso inexistente ${match[1]}`);
    }
  }

  return { errors, files: files.length, htmlFiles: html.length, checkedLinks };
}

async function main() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const directory = resolve(process.argv[2] ?? join(scriptDirectory, '..', 'dist'));
  await access(directory);
  const result = await checkDist(directory);
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`Salida válida: ${result.files} archivos, ${result.htmlFiles} HTML, ${result.checkedLinks} referencias`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
