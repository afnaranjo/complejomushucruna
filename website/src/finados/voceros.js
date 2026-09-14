export function isValidEcuadorianId(value) {
  const digits = String(value).replace(/\D/g, '');
  if (!/^\d{10}$/.test(digits)) return false;
  const province = Number(digits.slice(0, 2));
  const third = Number(digits[2]);
  if (province < 1 || province > 24 || third >= 6) return false;

  let total = 0;
  for (let index = 0; index < 9; index += 1) {
    let product = Number(digits[index]) * (index % 2 === 0 ? 2 : 1);
    if (product > 9) product -= 9;
    total += product;
  }
  const verifier = (10 - (total % 10)) % 10;
  return verifier === Number(digits[9]);
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

function showThanks(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
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
  let registrationOpen = false;

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
    id.setCustomValidity(isValidEcuadorianId(id.value) ? '' : 'Ingresa una cédula ecuatoriana válida de 10 dígitos.');
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
      const response = await fetchImplementation(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) throw new Error(payload.message || 'No fue posible completar el registro.');
      form.reset();
      syncAge();
      syncProfiles();
      status.textContent = '';
      showThanks(dialog);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'No fue posible completar el registro.';
    } finally {
      syncSubmit();
    }
  });
}

if (typeof document !== 'undefined') setupVocerosForm(document);
