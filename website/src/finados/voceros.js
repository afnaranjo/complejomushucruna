export function isValidEcuadorianId(value) {
  return /^\d{10}$/.test(String(value).trim());
}

export function ageOnDate(birthValue, reference = new Date()) {
  const parts = String(birthValue).split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [year, month, day] = parts;
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return null;
  let age = reference.getFullYear() - year;
  const birthdayPassed = reference.getMonth() + 1 > month
    || (reference.getMonth() + 1 === month && reference.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age;
}

export function formatVocerosBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

function setRequired(container, required) {
  for (const input of container.querySelectorAll('input')) input.required = required;
}

function profileIsValid(input) {
  if (!input.value.trim()) return true;
  try {
    return new URL(input.value).protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function showThanks(dialog, receipt) {
  if (!dialog) return;
  const values = {
    '[data-voceros-receipt-name]': receipt.name,
    '[data-voceros-receipt-whatsapp]': receipt.whatsapp,
    '[data-voceros-receipt-birth]': formatVocerosBirthDate(receipt.birth),
    '[data-voceros-receipt-city]': receipt.city,
    '[data-voceros-receipt-previous]': receipt.previous,
  };
  for (const [selector, value] of Object.entries(values)) {
    const element = dialog.querySelector(selector);
    if (element) element.textContent = value;
  }
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
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

export async function downloadVocerosReceipt(receipt) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) return;

  const gradient = context.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#241146');
  gradient.addColorStop(.62, '#4d1aa2');
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
  context.fillStyle = '#ff2e8a';
  context.save();
  context.translate(-150, 525);
  context.rotate(-.35);
  context.fillRect(0, 0, 440, 78);
  context.restore();
  context.strokeStyle = '#ffc42e';
  context.lineWidth = 72;
  context.beginPath();
  context.arc(985, 1275, 175, 0, Math.PI * 2);
  context.stroke();

  const logo = await loadCanvasImage('/assets/finados/logo-finados.svg?v=20260914-1');
  if (logo) {
    const width = 390;
    const height = width * (logo.naturalHeight / logo.naturalWidth);
    context.drawImage(logo, (canvas.width - width) / 2, 64, width, height);
  }

  context.textAlign = 'center';
  context.fillStyle = '#00d2d6';
  context.font = '700 27px Inter, Arial, sans-serif';
  context.fillText('REGISTRO RECIBIDO · COMUNIDAD DE VOCEROS', 540, 370);
  context.fillStyle = '#f4eada';
  context.font = '400 80px Anton, Impact, sans-serif';
  drawWrappedText(context, 'YA ERES PARTE DE FINADOS MUSHUC RUNA 2026', 540, 475, 850, 86, 3);

  const details = [
    ['VOCERO', receipt.name],
    ['WHATSAPP', receipt.whatsapp],
    ['FECHA DE NACIMIENTO', formatVocerosBirthDate(receipt.birth)],
    ['CIUDAD', receipt.city],
    ['PARTICIPACIÓN ANTERIOR', receipt.previous],
  ];
  let y = 760;
  for (const [label, value] of details) {
    context.fillStyle = '#ffc42e';
    context.font = '700 22px Inter, Arial, sans-serif';
    context.fillText(label, 540, y);
    context.fillStyle = '#ffffff';
    context.font = '700 32px Inter, Arial, sans-serif';
    y = drawWrappedText(context, value, 540, y + 40, 790, 39, 2) + 30;
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const link = document.createElement('a');
  link.download = 'registro-vocero-finados-mushuc-runa-2026.png';
  link.href = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
  link.click();
  if (blob) setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function setupVocerosForm(root = document, fetchImplementation = globalThis.fetch) {
  const form = root.querySelector('[data-voceros-form]');
  if (!form) return;

  const fields = form.querySelector('[data-voceros-fields]');
  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-voceros-status]');
  const activation = root.querySelector('[data-voceros-activation]');
  const birth = form.elements.fecha_nacimiento;
  const id = form.elements.cedula;
  const minor = form.querySelector('[data-voceros-minor]');
  const ageMessage = form.querySelector('[data-voceros-age-message]');
  const profiles = ['tiktok', 'instagram', 'facebook'].map((name) => form.elements[name]);
  const consents = ['consentimiento_politicas', 'autorizacion_imagen', 'consentimiento_datos'].map((name) => form.elements[name]);
  const dialog = root.querySelector('[data-voceros-thanks]');
  const download = dialog?.querySelector('[data-voceros-download]');
  let registrationOpen = false;
  let receipt = { name: '', whatsapp: '', birth: '', city: '', previous: '' };

  const syncSubmit = () => {
    const allConsents = consents.every((input) => input.checked);
    submit.disabled = !registrationOpen || !allConsents;
  };

  const setOpen = (open, message = '') => {
    registrationOpen = open;
    fields.disabled = !open;
    activation.dataset.open = String(open);
    const title = activation.querySelector('strong');
    const text = activation.querySelector('p');
    if (title) title.textContent = open ? 'Registro habilitado' : 'Registro en preparación';
    if (text && message) text.textContent = message;
    syncSubmit();
  };

  const syncAge = () => {
    const age = ageOnDate(birth.value);
    const isMinor = age === 16 || age === 17;
    minor.hidden = !isMinor;
    setRequired(minor, isMinor);
    birth.setCustomValidity(age !== null && age < 16 ? 'El programa está disponible desde los 16 años.' : '');
    ageMessage.textContent = age !== null && age < 16
      ? 'Todavía no puedes registrarte. El programa recibe participantes desde los 16 años con autorización de su representante legal.'
      : isMinor
        ? 'Tu registro quedará pendiente hasta recibir la autorización escrita de tu representante legal.'
        : '';
  };

  const syncId = () => {
    if (!id.value) return id.setCustomValidity('');
    id.setCustomValidity(isValidEcuadorianId(id.value) ? '' : 'Ingresa una cédula de 10 dígitos.');
  };

  const syncProfiles = () => {
    const anyProfile = profiles.some((input) => input.value.trim());
    for (const input of profiles) {
      input.setCustomValidity(!profileIsValid(input)
        ? 'El enlace debe comenzar con https://.'
        : !anyProfile && input === profiles[0]
          ? 'Ingresa al menos un perfil social.'
          : '');
    }
  };

  const params = new URLSearchParams(globalThis.location?.search || '');
  for (const name of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    if (form.elements[name]) form.elements[name].value = params.get(name) || '';
  }
  if (form.elements.url_origen) form.elements.url_origen.value = globalThis.location?.href || '';

  birth.addEventListener('change', syncAge);
  id.addEventListener('input', syncId);
  profiles.forEach((input) => input.addEventListener('input', syncProfiles));
  consents.forEach((input) => input.addEventListener('change', syncSubmit));
  dialog?.querySelector('[data-voceros-thanks-close]')?.addEventListener('click', () => dialog.close?.());
  download?.addEventListener('click', async () => {
    download.disabled = true;
    const originalText = download.textContent;
    download.textContent = 'Preparando imagen…';
    try {
      await downloadVocerosReceipt(receipt);
    } finally {
      download.disabled = false;
      download.textContent = originalText;
    }
  });

  setOpen(false);
  if (typeof fetchImplementation === 'function') {
    fetchImplementation(form.action, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (payload?.open === true) {
          setOpen(true, 'Completa tus datos y acepta por separado los tres consentimientos para enviar el registro.');
        } else if (payload?.message) {
          setOpen(false, payload.message);
        }
      })
      .catch(() => {});
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!registrationOpen) return;
    syncAge();
    syncId();
    syncProfiles();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submit.disabled = true;
    status.textContent = 'Enviando registro…';
    try {
      const formData = new FormData(form);
      const submittedReceipt = {
        name: String(formData.get('nombre_completo') || '').trim(),
        whatsapp: String(formData.get('whatsapp') || '').trim(),
        birth: String(formData.get('fecha_nacimiento') || '').trim(),
        city: String(formData.get('ciudad') || '').trim(),
        previous: String(formData.get('vocero_previo') || '').trim(),
      };
      const response = await fetchImplementation(form.action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) throw new Error(payload.message || 'No fue posible completar el registro.');
      receipt = submittedReceipt;
      form.reset();
      syncAge();
      syncProfiles();
      status.textContent = '';
      showThanks(dialog, receipt);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'No fue posible completar el registro.';
    } finally {
      syncSubmit();
    }
  });
}

if (typeof document !== 'undefined') setupVocerosForm(document);
