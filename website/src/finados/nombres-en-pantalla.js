import qrcode from './qrcode-generator.mjs';
import { resolveRuntimeOrigins } from './runtime-origins.mjs';

const MAX_VISIBLE = 7;
const scenePositions = Object.freeze([
  { left: '8%', top: '17%', scale: 0.48, opacity: 0.36 },
  { right: '7%', top: '22%', scale: 0.54, opacity: 0.42 },
  { left: '15%', bottom: '17%', scale: 0.42, opacity: 0.3 },
  { right: '14%', bottom: '15%', scale: 0.46, opacity: 0.34 },
  { left: '31%', top: '10%', scale: 0.38, opacity: 0.26 },
  { right: '29%', bottom: '10%', scale: 0.4, opacity: 0.28 },
]);

export function selectSceneNames(items, maxVisible = MAX_VISIBLE, random = Math.random) {
  const available = Array.isArray(items) ? items.slice(0, Math.max(0, maxVisible)) : [];
  if (available.length <= 1) return { primary: available[0] ?? null, secondary: [], remaining: [] };
  const primaryIndex = Math.floor(random() * available.length);
  const primary = available[primaryIndex];
  const secondary = available.filter((_, index) => index !== primaryIndex);
  return { primary, secondary, remaining: Array.isArray(items) ? items.slice(available.length) : [] };
}

export function layoutSecondaryNames(count, viewport = { width: 1920, height: 1080 }) {
  const compact = Number(viewport.width) < 720;
  return scenePositions.slice(0, Math.min(count, compact ? 2 : scenePositions.length));
}

function apiBase() {
  return resolveRuntimeOrigins().apiBase;
}

function makeQr(target, url) {
  // El alias espejo usa una URL más larga; el tipo automático evita desbordar la capacidad.
  const code = qrcode(0, 'M');
  code.addData(url);
  code.make();
  target.innerHTML = code.createImgTag(5, 8, 'Código QR para abrir la experiencia de nombres');
}

async function submitName(form, status) {
  const formData = new FormData(form);
  const name = String(formData.get('name') ?? '').trim();
  const consent = formData.get('consent') === 'on';
  if (!name || !consent) {
    status.textContent = 'Escribe tu nombre y confirma el consentimiento para continuar.';
    return;
  }
  status.textContent = 'Enviando tu nombre…';
  try {
    const response = await fetch(`${apiBase()}/finados/nombres`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, consent }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'No se pudo enviar el nombre.');
    form.reset();
    status.textContent = 'Listo. Tu nombre aparecerá en la pantalla durante la experiencia.';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'No se pudo enviar el nombre. Inténtalo de nuevo.';
  }
}

function initCapture() {
  const form = document.querySelector('[data-name-form]');
  const status = document.querySelector('[data-name-status]');
  const qr = document.querySelector('[data-name-qr]');
  if (qr) makeQr(qr, `${resolveRuntimeOrigins().siteOrigin}/finados/nombre/escribe/`);
  if (!form || !status) return false;
  form.addEventListener('submit', (event) => { event.preventDefault(); void submitName(form, status); });
  return true;
}

function nameLayer(item, className, position = null) {
  const style = position ? Object.entries(position).filter(([key]) => key !== 'scale' && key !== 'opacity').map(([key, value]) => `${key}:${value}`).join(';') : '';
  const scale = position?.scale ?? 1;
  const opacity = position?.opacity ?? 1;
  return `<span class="name-layer ${className}" style="${style};--name-scale:${scale};--name-opacity:${opacity}">${item.display_name}</span>`;
}

function renderScene(scene, reducedMotion = false) {
  const root = document.querySelector('[data-name-scene]');
  if (!root || !scene.primary) return;
  root.className = `name-scene${reducedMotion ? ' name-scene--reduced' : ''}`;
  const positions = layoutSecondaryNames(scene.secondary.length, { width: window.innerWidth, height: window.innerHeight });
  root.innerHTML = [nameLayer(scene.primary, 'name-layer--primary'), ...scene.secondary.map((item, index) => nameLayer(item, 'name-layer--secondary', positions[index]))].join('');
}

async function initScreen() {
  const root = document.querySelector('[data-name-screen]');
  if (!root) return;
  const seen = new Set();
  let waiting = [];
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const tick = async () => {
    try {
      const response = await fetch(`${apiBase()}/finados/nombres/cola?limit=20`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const incoming = (payload.items ?? []).filter((item) => item?.public_id && !seen.has(item.public_id));
      waiting = [...waiting, ...incoming];
      if (waiting.length > 0 && !root.dataset.playing) {
        const scene = selectSceneNames(waiting);
        waiting = scene.remaining;
        scene.primary && seen.add(scene.primary.public_id);
        scene.secondary.forEach((item) => seen.add(item.public_id));
        root.dataset.playing = 'true';
        renderScene(scene, reducedMotion);
        // Conserva el último nombre visible: la pantalla es un lienzo vivo, no una página que se reinicia.
        // Solo liberamos el ciclo para que el siguiente nombre pueda entrar cuando llegue.
        window.setTimeout(() => { delete root.dataset.playing; }, reducedMotion ? 1800 : 4200);
      }
    } catch { /* La pantalla continúa con el último estado visible. */ }
  };
  await tick();
  window.setInterval(() => void tick(), 1000);
}

if (typeof document !== 'undefined') {
  const hasCapture = initCapture();
  if (!hasCapture && document.querySelector('[data-name-screen]')) void initScreen();
}
