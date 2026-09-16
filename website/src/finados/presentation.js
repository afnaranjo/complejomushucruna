export const PRESENTATION_AT = '2026-09-17T10:30:00-05:00';
export const PRESENTATION_WELCOME = 'Bienvenidos a Finados Mushuc Runa 2026.';

export function presentationCountdown(now, target = Date.parse(PRESENTATION_AT)) {
  if (!Number.isFinite(now) || !Number.isFinite(target)) throw new TypeError('Fecha de presentación inválida.');
  const remaining = Math.max(0, target - now);
  return {
    live: now >= target,
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1_000),
  };
}

export function setupPresentationCountdown(doc, {
  now = Date.now,
  setInterval: schedule = globalThis.setInterval,
  clearInterval: cancel = globalThis.clearInterval,
} = {}) {
  const panel = doc.querySelector('[data-presentation-countdown]');
  if (!panel) return () => {};
  const target = Date.parse(panel.dataset.target);
  if (!Number.isFinite(target)) return () => {};
  const clock = panel.querySelector('[data-presentation-clock]');
  const welcome = panel.querySelector('[data-presentation-welcome]');
  const label = panel.querySelector('[data-presentation-label]');
  const status = panel.querySelector('[data-presentation-status]');
  const fallback = panel.querySelector('[data-presentation-fallback]');
  const values = Object.fromEntries([...panel.querySelectorAll('[data-presentation-value]')]
    .map(item => [item.dataset.presentationValue, item]));
  if (!clock || !welcome || !label || !status || ['days', 'hours', 'minutes', 'seconds'].some(key => !values[key])) return () => {};
  let timer = null;
  const stop = () => {
    if (timer !== null) cancel(timer);
    timer = null;
    doc.removeEventListener('visibilitychange', render);
  };
  function render() {
    const parts = presentationCountdown(now(), target);
    clock.hidden = parts.live;
    label.hidden = parts.live;
    welcome.hidden = !parts.live;
    if (fallback) fallback.hidden = true;
    panel.classList.toggle('is-live', parts.live);
    if (parts.live) {
      status.textContent = PRESENTATION_WELCOME;
      stop();
      return true;
    }
    for (const key of ['days', 'hours', 'minutes', 'seconds']) values[key].textContent = String(parts[key]).padStart(2, '0');
    const announcement = `Faltan ${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos para la presentación de Finados 2026.`;
    if (status.textContent !== announcement) status.textContent = announcement;
    return false;
  }
  if (!render()) {
    timer = schedule(render, 1000);
    doc.addEventListener('visibilitychange', render);
  }
  return stop;
}

if (typeof document !== 'undefined') setupPresentationCountdown(document);
