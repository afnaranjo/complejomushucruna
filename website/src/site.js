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

function showMediaThanks(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

export function setupMediaAccreditation(root = document, fetchImplementation = globalThis.fetch) {
  const form = root.querySelector('[data-media-accreditation]');
  if (!form) return;

  const status = form.querySelector('[data-media-form-status]');
  const submit = form.querySelector('button[type="submit"]');
  const dialog = root.querySelector('[data-media-thanks]');
  const deadline = form.dataset.deadline || MEDIA_ACCREDITATION_DEADLINE;
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isMediaAccreditationOpen(new Date(), deadline)) {
      applyAvailability(false);
      return;
    }

    if (status) status.textContent = 'Enviando acreditación…';
    if (submit) submit.disabled = true;

    try {
      const response = await fetchImplementation(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) {
        if (payload.closed) applyAvailability(false);
        throw new Error(payload.message || 'No fue posible completar el registro.');
      }

      form.reset();
      if (status) status.textContent = '';
      showMediaThanks(dialog);
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
