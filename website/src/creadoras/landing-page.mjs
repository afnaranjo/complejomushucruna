import { readFileSync } from 'node:fs';
import { escapeHtml as esc } from '../render/html.mjs';
import { renderFinadosFooter } from '../finados/footer.mjs';
import { renderFinadosNavigation } from '../finados/navigation.mjs';

const BASE = '/finados/creadoras';
const navigationAssetVersion = '20260925-navigation-fluid-1';
const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/creadora-consents.json', import.meta.url), 'utf8'));

const steps = Object.freeze([
  ['01', 'Crea tu cuenta', 'Con tu correo y una contraseña. Es tu acceso privado.'],
  ['02', 'Registra tus datos', 'Tu nombre, tu WhatsApp, tu ciudad y la red donde publicas. Así la coordinación sabe con quién habla.'],
  ['03', 'Recibe tu calendario', 'La coordinación arma el calendario y asigna los días y las horas. Los ves en tu pantalla.'],
  ['04', 'Ven y crea', 'Llegas en el horario asignado. Si algo cambia, avisas antes: el calendario lo maneja coordinación.'],
]);

const faqs = Object.freeze([
  ['¿Quién puede participar?', 'Personas que creen contenido y quieran cubrir la feria. La coordinación revisa cada registro y confirma la participación.'],
  ['¿Cómo sé cuándo me toca?', 'En tu pantalla «Mi registro» aparecen los días y las horas que la coordinación te asignó, con el lugar cuando está definido.'],
  ['¿Puedo cambiar mi horario?', 'El calendario lo administra la coordinación. Si un turno no te queda, avísale antes por WhatsApp para que lo mueva.'],
  ['¿Qué pasa si no puedo asistir?', 'Avisa con tiempo. Cada cambio del calendario queda registrado, así que mover un turno a tiempo no es un problema; no avisar sí.'],
  ['¿Tiene costo?', 'No. El registro es gratuito.'],
]);

export function renderCreadorasLandingPage(page) {
  const stepsMarkup = steps.map(([number, title, text]) => `<article class="voceros-step" data-reveal>
    <span class="voceros-step__number">${number}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('');
  const faqMarkup = faqs.map(([question, answer]) => `<details class="voceros-faq"><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`).join('');
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Creadoras de contenido | Finados Mushuc Runa 2026</title>
<meta name="description" content="Regístrate como creadora de contenido de Finados Mushuc Runa 2026 y consulta los días y horas que te asigna la coordinación.">
<meta name="robots" content="noindex, nofollow, noarchive">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}">
<link rel="icon" href="/assets/finados/favicon-finados.png"><meta name="theme-color" content="#241146">
<link rel="stylesheet" href="/assets/finados/finados.css?v=20260916-7">
<link rel="stylesheet" href="/assets/finados/navigation.css?v=20260925-navigation-fluid-1">
<link rel="stylesheet" href="/assets/finados/voceros.css?v=20260915-1">
<link rel="stylesheet" href="/assets/finados/creadoras.css?v=20260923-creadoras-1">
<script type="module" src="/assets/finados/voceros.js?v=20260915-1"></script>
</head><body class="finados-page voceros-page">
<a class="skip-link" href="#contenido">Ir al contenido</a>
<header class="site-header site-header--finados">
<a class="site-header__logo" href="/finados/" aria-label="Finados Mushuc Runa"><img src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados 2026, legado que nos une"></a>
${renderFinadosNavigation({ currentRoute: page.route })}
</header>
<main id="contenido">
<section class="voceros-hero">
<div class="voceros-hero__body">
<p class="voceros-eyebrow">Finados Mushuc Runa 2026</p>
<h1>Creadoras de contenido</h1>
<p class="voceros-lead">Si creas contenido y quieres cubrir la feria, regístrate. La coordinación arma el calendario y tú ves en tu pantalla los días y las horas que te tocan.</p>
<div class="voceros-hero__actions">
<a class="voceros-primary" href="${BASE}/acceso/">Crear mi cuenta</a>
<a class="voceros-quiet" href="${BASE}/acceso/?modo=login">Ya tengo cuenta</a>
</div>
<p class="voceros-note">El registro es gratuito. La coordinación confirma cada participación.</p>
</div>
</section>
<section class="voceros-section" aria-labelledby="pasos-title">
<div class="voceros-section-heading"><p class="voceros-eyebrow">Cómo funciona</p><h2 id="pasos-title">Cuatro pasos</h2></div>
<div class="voceros-steps">${stepsMarkup}</div>
</section>
<section class="voceros-section" aria-labelledby="calendario-title">
<div class="voceros-section-heading"><p class="voceros-eyebrow">Tu calendario</p><h2 id="calendario-title">Los días y las horas los ves aquí</h2></div>
<p class="voceros-lead">La coordinación organiza el calendario completo en un solo lugar y cada cambio queda registrado. Tú ves solo lo tuyo: el día, la hora y el lugar cuando ya está definido.</p>
</section>
<section class="voceros-section" aria-labelledby="faq-title">
<div class="voceros-section-heading"><p class="voceros-eyebrow">Preguntas</p><h2 id="faq-title">Lo que suelen preguntar</h2></div>
<div class="voceros-faqs">${faqMarkup}</div>
</section>
<section class="voceros-section voceros-section--legal" aria-labelledby="legal-title">
<div class="voceros-section-heading"><p class="voceros-eyebrow">Antes de registrarte</p><h2 id="legal-title">Lo que aceptas</h2></div>
<p class="voceros-lead">${esc(consents.policies.text)}</p>
<nav class="vocero-legal-links" aria-label="Documentos del programa">
<a href="${BASE}/condiciones/">Condiciones de participación</a>
<a href="${BASE}/politica-de-privacidad/">Política de Privacidad</a>
</nav>
</section>
</main>
${renderFinadosFooter({})}
</body></html>`;
}
