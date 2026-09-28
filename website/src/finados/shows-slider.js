// Carrusel de entradas de SHOWS: flechas, puntos, deslizar con el dedo y avance automático cada 4 s,
// que se detiene al pasar el cursor, al enfocar o si la persona prefiere menos movimiento.
export function initializeShowsSlider(root = document) {
  const slider = root.querySelector('[data-shows-slider]');
  const track = slider?.querySelector('[data-slider-track]');
  if (!slider || !track) return;
  const slides = [...track.children];
  const dots = [...slider.querySelectorAll('[data-slide-dot]')];
  let current = 0;
  const go = index => {
    current = (index + slides.length) % slides.length;
    track.scrollTo({ left: slides[current].offsetLeft, behavior: 'smooth' });
  };
  const mark = () => {
    const middle = track.scrollLeft + track.clientWidth / 2;
    const index = slides.findIndex(slide => slide.offsetLeft + slide.offsetWidth > middle);
    current = index < 0 ? slides.length - 1 : index;
    dots.forEach((dot, i) => (i === current ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));
  };
  let frame = 0;
  track.addEventListener('scroll', () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(mark); }, { passive: true });
  slider.querySelector('[data-slider-prev]')?.addEventListener('click', () => go(current - 1));
  slider.querySelector('[data-slider-next]')?.addEventListener('click', () => go(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  let paused = false;
  for (const [event, value] of [['pointerenter', true], ['pointerleave', false], ['focusin', true], ['focusout', false], ['touchstart', true]]) {
    slider.addEventListener(event, () => { paused = value; }, { passive: true });
  }
  setInterval(() => { if (!paused && !document.hidden) go(current + 1); }, 4000);
}

if (typeof document !== 'undefined') initializeShowsSlider();
