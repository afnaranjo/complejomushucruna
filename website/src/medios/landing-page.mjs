const steps = Object.freeze([
  { number: '01', title: 'Crea la cuenta de tu medio', text: 'Usa el correo con el que tu medio gestionará la acreditación y elige una contraseña.' },
  { number: '02', title: 'Completa el registro', text: 'Ingresa el nombre de tu medio, su frecuencia o canal y el link de sus redes.' },
  { number: '03', title: 'Agrega tus videos', text: 'Cada vez que publiques un video sobre la feria, inicia sesión y pega su link. También puedes consultar el estado de tu registro.' },
]);

export function renderMediaLandingBody() {
  return `<section class="media-hero" aria-labelledby="media-title">
    <img class="media-hero__image" src="/assets/images/acreditacion-medios-periodista.jpg?v=20260909" width="1778" height="889" alt="Periodista con cámara y micrófono durante una cobertura cultural" fetchpriority="high">
    <div class="media-hero__veil" aria-hidden="true"></div>
    <div class="shell media-hero__content">
      <p class="media-hero__eyebrow">Finados Mushuc Runa 2026</p>
      <h1 id="media-title">Registro<br>de medios</h1>
      <p class="media-hero__intro">Crea la cuenta de tu medio, completa su registro y ve agregando los links de los videos que publiques sobre la feria.</p>
      <div class="media-hero__actions">
        <a class="media-hero__button" href="/finados/medios/acceso/">Crear cuenta <span aria-hidden="true">→</span></a>
        <a class="media-hero__button media-hero__button--ghost" href="/finados/medios/acceso/?modo=login">Iniciar sesión</a>
      </div>
    </div>
  </section>

  <section class="media-registration media-steps" id="como-funciona" aria-labelledby="media-steps-title">
    <div class="shell media-registration__shell">
      <header class="media-registration__header" data-reveal>
        <p class="media-registration__eyebrow">Registro con cuenta</p>
        <h2 id="media-steps-title">Cómo funciona</h2>
        <p>Tu información queda guardada en la cuenta de tu medio y solo la revisa el equipo de Finados Mushuc Runa.</p>
      </header>
      <ol class="media-steps__list">
        ${steps.map((step) => `<li class="media-steps__item" data-reveal><span class="media-steps__number" aria-hidden="true">${step.number}</span><h3>${step.title}</h3><p>${step.text}</p></li>`).join('')}
      </ol>
      <div class="media-steps__actions">
        <a class="media-submit" href="/finados/medios/acceso/">Crear cuenta de medio <span aria-hidden="true">↗</span></a>
        <a class="media-steps__login" href="/finados/medios/acceso/?modo=login">Ya tengo cuenta: iniciar sesión</a>
      </div>
    </div>
  </section>`;
}
