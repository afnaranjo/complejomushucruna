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
