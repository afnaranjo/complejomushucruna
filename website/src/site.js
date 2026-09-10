export function setMenuState(button, navigation, open) {
  button.setAttribute('aria-expanded', String(open));
  navigation.dataset.open = String(open);
}

export function setupMenu(root = document) {
  const button = root.querySelector('.nav-toggle');
  const navigation = root.querySelector('#navegacion-principal');
  if (!button || !navigation) return;

  button.addEventListener('click', () => {
    setMenuState(button, navigation, button.getAttribute('aria-expanded') !== 'true');
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuState(button, navigation, false);
  });

  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuState(button, navigation, false);
  });
}

export function setupReveals(root = document) {
  const elements = [...root.querySelectorAll('[data-reveal]')];
  if (!elements.length || !('IntersectionObserver' in globalThis)) {
    elements.forEach((element) => element.dataset.visible = 'true');
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.visible = 'true';
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  elements.forEach((element) => observer.observe(element));
}

export const MEDIA_ACCREDITATION_DEADLINE = '2026-09-15T18:00:00-05:00';

export function isMediaAccreditationOpen(now = new Date(), deadline = MEDIA_ACCREDITATION_DEADLINE) {
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const deadlineTime = new Date(deadline).getTime();
  return Number.isFinite(nowTime) && Number.isFinite(deadlineTime) && nowTime < deadlineTime;
}

export function setMediaAccreditationAvailability(form, open) {
  const fields = form.querySelector('[data-registration-fields]');
  const closedNotice = form.parentElement?.querySelector('[data-registration-closed]');
  if (fields) fields.disabled = !open;
  form.hidden = !open;
  if (closedNotice) closedNotice.hidden = open;
}

function showMediaThanks(dialog, registration) {
  if (!dialog) return;
  const team = dialog.querySelector('[data-media-team]');
  const media = dialog.querySelector('[data-media-name]');
  if (team) team.textContent = registration.team;
  if (media) media.textContent = registration.media;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  if (words.join(' ').length > lines.join(' ').length && lines.length) {
    let last = lines.at(-1);
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trim()}…`;
  }

  lines.forEach((value, index) => context.fillText(value, x, y + (index * lineHeight)));
  return y + (lines.length * lineHeight);
}

function loadCanvasImage(source) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

async function downloadMediaReceipt(registration) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) return;

  const gradient = context.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#241146');
  gradient.addColorStop(0.58, '#4d1aa2');
  gradient.addColorStop(1, '#6e2ce0');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const chumbi = ['#ff2e8a', '#ffc42e', '#00d2d6', '#f4eada'];
  for (let x = 0, index = 0; x < canvas.width; x += 60, index += 1) {
    context.fillStyle = chumbi[index % chumbi.length];
    context.fillRect(x, 0, 60, 22);
  }

  context.strokeStyle = '#00d2d6';
  context.lineWidth = 5;
  context.strokeRect(18, 18, 1044, 1314);
  context.fillStyle = '#00d2d6';
  context.save();
  context.translate(-145, 540);
  context.rotate(-0.35);
  context.fillRect(0, 0, 430, 78);
  context.restore();
  context.strokeStyle = '#ffc42e';
  context.lineWidth = 70;
  context.beginPath();
  context.arc(975, 1275, 170, 0, Math.PI * 2);
  context.stroke();

  const logo = await loadCanvasImage('/assets/finados/logo-finados.svg?v=20260909');
  if (logo) {
    const width = 430;
    const height = width * (logo.naturalHeight / logo.naturalWidth);
    context.drawImage(logo, (canvas.width - width) / 2, 80, width, height);
  }

  context.textAlign = 'center';
  context.fillStyle = '#00d2d6';
  context.font = '700 28px Inter, Arial, sans-serif';
  context.fillText('REGISTRO RECIBIDO', 540, 390);

  context.fillStyle = '#f4eada';
  context.font = '400 88px Anton, Impact, sans-serif';
  drawWrappedText(context, 'GRACIAS, BIENVENIDO AL LANZAMIENTO DE FINADOS MUSHUC RUNA 2026', 540, 500, 850, 92, 5);

  context.fillStyle = '#ffc42e';
  context.font = '700 25px Inter, Arial, sans-serif';
  context.fillText('EQUIPO ACREDITADO', 540, 985);
  context.fillStyle = '#ffffff';
  context.font = '700 36px Inter, Arial, sans-serif';
  const mediaY = drawWrappedText(context, registration.team, 540, 1035, 780, 44, 2);
  context.fillStyle = '#00d2d6';
  context.font = '700 28px Inter, Arial, sans-serif';
  drawWrappedText(context, registration.media, 540, mediaY + 16, 780, 38, 2);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const link = document.createElement('a');
  link.download = 'acreditacion-finados-mushuc-runa-2026.png';
  link.href = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
  link.click();
  if (blob) setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function setupMediaAccreditation(root = document, fetchImplementation = globalThis.fetch) {
  const form = root.querySelector('[data-media-accreditation]');
  if (!form) return;

  const status = form.querySelector('[data-media-form-status]');
  const submit = form.querySelector('button[type="submit"]');
  const dialog = root.querySelector('[data-media-thanks]');
  const download = dialog?.querySelector('[data-media-download]');
  const deadline = form.dataset.deadline || MEDIA_ACCREDITATION_DEADLINE;
  let receipt = { team: '', media: '' };
  const applyAvailability = (open) => setMediaAccreditationAvailability(form, open);

  applyAvailability(isMediaAccreditationOpen(new Date(), deadline));

  if (typeof fetchImplementation === 'function') {
    fetchImplementation(form.action, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }).then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (payload && typeof payload.open === 'boolean') applyAvailability(payload.open);
      })
      .catch(() => {});
  }

  download?.addEventListener('click', async () => {
    download.disabled = true;
    const originalText = download.textContent;
    download.textContent = 'Preparando imagen…';
    try {
      await downloadMediaReceipt(receipt);
    } finally {
      download.disabled = false;
      download.textContent = originalText;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isMediaAccreditationOpen(new Date(), deadline)) {
      applyAvailability(false);
      return;
    }

    if (status) status.textContent = 'Enviando acreditación…';
    if (submit) submit.disabled = true;

    try {
      const formData = new FormData(form);
      const submittedReceipt = {
        team: String(formData.get('equipo') || '').trim(),
        media: String(formData.get('nombre_medio') || '').trim(),
      };
      const response = await fetchImplementation(form.action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) {
        if (payload.closed) applyAvailability(false);
        throw new Error(payload.message || 'No fue posible completar el registro.');
      }

      receipt = submittedReceipt;
      form.reset();
      if (status) status.textContent = '';
      showMediaThanks(dialog, receipt);
    } catch (error) {
      if (status) {
        status.textContent = error instanceof Error
          ? error.message
          : 'No fue posible completar el registro. Inténtalo nuevamente.';
      }
    } finally {
      if (submit && !form.hidden) submit.disabled = false;
    }
  });
}

if (typeof document !== 'undefined') {
  setupMenu(document);
  setupReveals(document);
  setupMediaAccreditation(document);
}
