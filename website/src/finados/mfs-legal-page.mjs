import { readFileSync } from 'node:fs';
import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from './footer.mjs';
import { renderFinadosNavigation } from './navigation.mjs';
import { mfsEvent, mfsPrizes } from './mfs-page.mjs';

const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/mfs-consents.json', import.meta.url), 'utf8'));
const legalVersion = '2026-09-24';

// El mismo responsable ya publicado en los documentos de Voceros, Medios y Emprendedores.
const controller = Object.freeze({
  name: 'Eventos Finados 2026',
  address: 'Santa Lucía, Tisaleo, Tungurahua – Panamericana Sur km 12, vía Ambato–Riobamba',
  phone: '+593 980 346 729',
  email: 'facturacioncomplejomushuc@gmail.com',
  retention: 'tres años contados desde el último guardado de la inscripción',
});

const prizes = mfsPrizes.map(prize => `${prize.place}: USD ${prize.amount}`).join(' · ');

export const mfsLegalDocuments = Object.freeze({
  bases: {
    slug: 'bases',
    consent: 'bases',
    eyebrow: 'Documento 01',
    title: 'Bases de Mushuc Freestyle 2026',
    summary: 'Inscripción, audición, cupos, fechas y premios de la 2da edición de Mushuc Freestyle en Finados Mushuc Runa 2026.',
    body: `
      <section><h2>1. Organizador</h2><p>${controller.name} organiza Mushuc Freestyle 2026, competencia de improvisación en la ${mfsEvent.place} del Complejo Mushuc Runa, dentro de Finados Mushuc Runa 2026.</p></section>
      <section><h2>2. Inscripción gratuita</h2><p>La inscripción no tiene costo. Se realiza únicamente en línea: la persona crea su cuenta, completa sus datos, sube una fotografía tipo retrato y envía el enlace público de su video de audición en TikTok. Las inscripciones cierran el ${escapeHtml(mfsEvent.closing.toLowerCase())}.</p></section>
      <section><h2>3. Audición</h2><p>El video debe ser propio, estar publicado con acceso público en TikTok y mostrar a la persona presentándose y anunciando que la final será en Finados Mushuc Runa 2026. Cada participante envía una sola audición; una vez enviada no se reemplaza desde la cuenta. Si hay un error, la persona puede pedir la corrección a la coordinación.</p></section>
      <section><h2>4. Cupos y selección</h2><p>Hay ${mfsEvent.slots} cupos para la competencia. La coordinación revisa cada audición y comunica el resultado a través de la cuenta y del WhatsApp registrado. El formato de la competencia y el jurado se comunicarán antes de la final.</p></section>
      <section><h2>5. Identificación</h2><p>Cada participante se identifica con su cédula de ciudadanía. Si la persona inscrita es menor de edad, la organización solicitará la autorización de su representante legal antes de su participación.</p></section>
      <section><h2>6. Final</h2><p>La final se realiza el ${escapeHtml(mfsEvent.date.toLowerCase())} a las ${mfsEvent.time}, en la ${mfsEvent.place}, ${escapeHtml(mfsEvent.venue)}.</p></section>
      <section><h2>7. Premios</h2><p>${escapeHtml(prizes)}. Además se entregan medallas, reconocimientos y trofeos, y un reconocimiento especial al mejor MC de la zona centro. Los premios son personales e intransferibles, se entregan con cédula y acta firmada, y se pagan dentro de 15 días hábiles.</p></section>
      <section><h2>8. Convivencia</h2><p>La improvisación es libre, pero no se admiten mensajes que inciten a la violencia o a la discriminación, ni ataques a personas del público. Los participantes deben seguir las instrucciones del personal de producción y seguridad.</p></section>
      <section><h2>9. Cambios</h2><p>Si una causa de fuerza mayor obliga a cambiar la fecha, la hora o el lugar, la organización lo comunicará por sus canales oficiales y por el WhatsApp registrado.</p></section>`,
  },
  privacy: {
    slug: 'politica-de-privacidad',
    consent: 'data',
    eyebrow: 'Documento 02',
    title: 'Política de Privacidad',
    summary: 'Información sobre el tratamiento de los datos personales de las personas inscritas en Mushuc Freestyle 2026, conforme a la legislación ecuatoriana.',
    body: `
      <section><h2>1. Responsable y contacto</h2><p>El responsable de este tratamiento es <strong>${controller.name}</strong>, con domicilio en ${controller.address}, teléfono <a href="tel:+593980346729">${controller.phone}</a> y correo electrónico <a href="mailto:${controller.email}">${controller.email}</a>.</p></section>
      <section><h2>2. Datos tratados</h2><p>Correo de la cuenta, nombres y apellidos, nombre artístico, número de WhatsApp, fotografía tipo retrato y el enlace del video de audición. También se registran la fecha y un identificador no reversible de la dirección IP como evidencia de consentimiento y seguridad.</p></section>
      <section><h2>3. Finalidad</h2><p>Verificar la identidad de la persona inscrita, revisar su audición, comunicarle el resultado y gestionar su participación en la competencia. La fotografía no se publica por el solo hecho de subirla.</p></section>
      <section><h2>4. Base legal</h2><p>El consentimiento expreso de la persona inscrita, otorgado en el formulario, y la gestión de su participación en la competencia que solicita.</p></section>
      <section><h2>5. Seguridad</h2><p>El correo y el WhatsApp se guardan cifrados, la fotografía se almacena cifrada fuera del sitio público y solo la persona inscrita y la coordinación autorizada pueden verla. La contraseña se guarda con un algoritmo de resguardo que impide recuperarla.</p></section>
      <section><h2>6. Conservación</h2><p>Los datos se conservan durante ${controller.retention}, salvo que la persona solicite su eliminación antes y no exista una obligación legal que lo impida.</p></section>
      <section><h2>7. Derechos</h2><p>Puedes solicitar acceso, rectificación, actualización, eliminación, oposición, portabilidad y revocación del consentimiento escribiendo a <a href="mailto:${controller.email}">${controller.email}</a>. Si consideras que tu solicitud no fue atendida adecuadamente, puedes reclamar ante la <a href="https://spdp.gob.ec/" target="_blank" rel="noopener noreferrer">Superintendencia de Protección de Datos Personales <span aria-hidden="true">↗</span></a>.</p></section>`,
  },
});

export const mfsLegalRoutes = Object.freeze(Object.fromEntries(
  Object.entries(mfsLegalDocuments).map(([key, document]) => [key, `/finados/mfs/${document.slug}/`]),
));

export function renderMfsLegalPage(page) {
  const document = mfsLegalDocuments[page.documentKey];
  if (!document) throw new Error(`Documento de Mushuc Freestyle no reconocido: ${page.documentKey}`);
  const consent = document.consent ? consents[document.consent] : null;
  return `<!doctype html>
<html lang="es" class="scroll-smooth bg-night">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(document.title)} | Mushuc Freestyle 2026</title>
  <meta name="description" content="${escapeHtml(document.summary)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(`${site.baseUrl}${page.route}`)}">
  <meta name="theme-color" content="#173976">
  <link rel="icon" href="/assets/finados/mfs/mfs-icono.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/finados/finados.css?v=20260916-7">
  <link rel="stylesheet" href="/assets/finados/voceros.css?v=20260916-7">
  <link rel="stylesheet" href="/assets/finados/navigation.css?v=20260918-navigation-progress-1">
  <script type="module" src="/assets/finados/finados.js?v=20260918-navigation-progress-1"></script>
</head>
<body class="voceros-page voceros-legal-page">
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="chumbi-line voceros-chumbi" aria-hidden="true"></div>
  <header class="site-header site-header--finados campaign-header voceros-header" data-header>
    <a class="brand finados-brand voceros-header__brand" href="/finados/" aria-label="Finados 2026, página principal">
      <img src="/assets/finados/logo-finados.svg?v=20260914-1" width="766" height="449" alt="Finados 2026, legado que nos une">
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navegacion-principal"><span></span><span></span><span></span><span class="sr-only">Abrir menú</span></button>
    ${renderFinadosNavigation({ currentRoute: page.route })}
  </header>
  <main id="contenido">
    <header class="voceros-legal__hero">
      <div class="voceros-shell">
        <a class="voceros-legal__back" href="/finados/mfs/">← Volver a Mushuc Freestyle</a>
        <p>${escapeHtml(document.eyebrow)} · Mushuc Freestyle 2026</p>
        <h1>${escapeHtml(document.title)}</h1>
        <span>${escapeHtml(document.summary)}</span>
        <small>Versión vigente · <time datetime="${legalVersion}">24 de septiembre de 2026</time></small>
      </div>
    </header>
    <div class="voceros-legal__layout voceros-shell">
      <article class="voceros-legal__content">
        ${document.body}
        ${consent ? `<section><h2>Texto de aceptación del formulario</h2><p data-consent-text="${document.consent}">${escapeHtml(consent.text)}</p></section>` : ''}
      </article>
    </div>
  </main>
  ${renderFinadosFooter()}
</body>
</html>`;
}
