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

if (typeof document !== 'undefined') {
  setupMenu(document);
  setupReveals(document);
}
