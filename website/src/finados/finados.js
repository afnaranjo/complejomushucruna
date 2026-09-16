import { setupStandsSaleSchedule } from '../stands-sale-schedule.js?v=20260914-1';

const root = document.documentElement;
const header = document.querySelector('[data-header]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

requestAnimationFrame(() => root.classList.add('is-ready'));

function updateHeader() {
  header?.classList.toggle('is-scrolled', window.scrollY > 24);
}

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

function setupPrimaryNavigation() {
  const button = document.querySelector('.nav-toggle');
  const navigation = document.querySelector('#navegacion-principal');
  if (!button || !navigation) return;
  const submenus = [...navigation.querySelectorAll('[data-submenu]')];

  const closeSubmenus = () => {
    for (const item of submenus) {
      item.dataset.open = 'false';
      item.querySelector('[data-submenu-toggle]')?.setAttribute('aria-expanded', 'false');
    }
  };
  const openSubmenu = (item, toggle) => {
    closeSubmenus();
    item.dataset.open = 'true';
    toggle.setAttribute('aria-expanded', 'true');
  };
  const setMenuState = (open) => {
    button.setAttribute('aria-expanded', String(open));
    navigation.dataset.open = String(open);
    if (!open) closeSubmenus();
  };

  button.addEventListener('click', () => {
    setMenuState(button.getAttribute('aria-expanded') !== 'true');
  });

  for (const item of submenus) {
    const toggle = item.querySelector('[data-submenu-toggle]');
    if (!toggle) continue;
    const parentLink = item.querySelector(':scope > a');
    parentLink?.addEventListener('click', (event) => {
      if (item.dataset.open === 'true') return;
      event.preventDefault();
      event.stopPropagation();
      openSubmenu(item, toggle);
    });
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      if (open) openSubmenu(item, toggle);
      else closeSubmenus();
    });
  }

  navigation.addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    setMenuState(false);
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('#navegacion-principal, .nav-toggle')) return;
    setMenuState(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuState(false);
  });
}

setupPrimaryNavigation();

const revealItems = document.querySelectorAll('[data-reveal]');

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
}

const standsCountdown = document.querySelector('[data-stands-countdown]');

if (standsCountdown) {
  const target = Date.parse(standsCountdown.dataset.target);
  const switchAt = Date.parse(standsCountdown.dataset.switchAt);
  const values = Object.fromEntries(
    [...standsCountdown.querySelectorAll('[data-countdown-value]')]
      .map((item) => [item.dataset.countdownValue, item]),
  );
  const clock = standsCountdown.querySelector('[data-countdown-clock]');
  const welcome = standsCountdown.querySelector('[data-countdown-welcome]');
  const status = standsCountdown.querySelector('[data-countdown-status]');
  let announcedDay = null;
  let timer;

  const renderCountdown = () => {
    const now = Date.now();
    if (Number.isFinite(switchAt) && now >= switchAt) {
      if (clock) clock.hidden = true;
      if (welcome) welcome.hidden = false;
      standsCountdown.classList.add('is-live');
      status.textContent = 'Bienvenidos a Finados Mushuc Runa 2026.';
      window.clearInterval(timer);
      return;
    }

    const remaining = Math.max(0, target - now);
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1_000);

    values.days.textContent = String(days).padStart(2, '0');
    values.hours.textContent = String(hours).padStart(2, '0');
    values.minutes.textContent = String(minutes).padStart(2, '0');
    values.seconds.textContent = String(seconds).padStart(2, '0');

    if (remaining === 0) {
      standsCountdown.classList.add('is-live');
      status.textContent = 'La venta de stands ya está disponible.';
      window.clearInterval(timer);
      return;
    }

    if (announcedDay !== days) {
      status.textContent = `Faltan ${days} días para la venta de stands.`;
      announcedDay = days;
    }
  };

  if (Number.isFinite(target)) {
    timer = window.setInterval(renderCountdown, 1_000);
    renderCountdown();
  }
}

setupStandsSaleSchedule(document);
