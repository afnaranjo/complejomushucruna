const root = document.documentElement;
const header = document.querySelector('[data-header]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

requestAnimationFrame(() => root.classList.add('is-ready'));

function updateHeader() {
  header?.classList.toggle('is-scrolled', window.scrollY > 24);
}

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

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
  const values = Object.fromEntries(
    [...standsCountdown.querySelectorAll('[data-countdown-value]')]
      .map((item) => [item.dataset.countdownValue, item]),
  );
  const heading = standsCountdown.querySelector('[data-countdown-heading]');
  const status = standsCountdown.querySelector('[data-countdown-status]');
  let announcedDay = null;
  let timer;

  const renderCountdown = () => {
    const remaining = Math.max(0, target - Date.now());
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
      heading.textContent = 'La venta de stands ya está disponible';
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
    renderCountdown();
    timer = window.setInterval(renderCountdown, 1_000);
  }
}
