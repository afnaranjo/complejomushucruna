import { escapeHtml as esc } from '../render/html.mjs';
import { renderFinadosFooter } from '../finados/footer.mjs';
import { renderFinadosNavigation } from '../finados/navigation.mjs';

const BASE = '/finados/creadoras';
const VERSION = '2026-09-23';
const RESPONSIBLE = 'Corporación Fourier — Complejo Intercultural y Deportivo Mushuc Runa';

/**
 * Textos propios de Creadoras de Contenido. Reutilizan el responsable y el marco normativo ya
 * publicados para Voceros y Medios. El plazo de tres años viene de ese mismo programa y debe
 * ratificarlo el responsable antes de difundir el registro.
 */
const DOCUMENTS = Object.freeze({
  '/finados/creadoras/condiciones/': {
    title: 'Condiciones de participación',
    intro: 'Estas condiciones explican cómo funciona la participación de las creadoras de contenido en Finados Mushuc Runa 2026.',
    sections: [
      ['Quién participa', ['La participación está abierta a personas que crean contenido y quieran cubrir la feria.',
        'El registro es gratuito y no garantiza por sí solo la participación: la coordinación revisa cada registro y confirma quién participa.',
        'La participación es personal y no se transfiere a otra persona.']],
      ['El calendario y los turnos', ['La coordinación arma el calendario y asigna los días y las horas de cada creadora.',
        'Los turnos asignados se consultan en «Mi registro». La creadora no modifica su propio calendario.',
        'Si un turno no te queda, avisa a la coordinación antes de la fecha para que lo mueva. Cada cambio del calendario queda registrado con la fecha, la hora anterior y la nueva.',
        'No presentarse a un turno asignado sin aviso previo puede dejar sin efecto la participación.']],
      ['Buenas prácticas', ['Trata con respeto al público, a los expositores, al personal y a las demás creadoras.',
        'Respeta la señalética, las áreas restringidas y las indicaciones del personal de seguridad.',
        'Pide permiso antes de grabar a una persona identificable y no grabes a niñas o niños sin la autorización de quien los representa.',
        'No publiques información sobre precios, horarios, artistas, aforos o condiciones que no haya confirmado la organización.',
        'No uses la participación para promocionar productos, marcas o servicios ajenos a la feria sin autorización escrita.']],
      ['Contenido', ['El contenido que publiques es tuyo y se publica bajo tu responsabilidad.',
        'La organización puede pedir que retires una publicación que difunda datos no confirmados o que ponga en riesgo la seguridad de las personas.',
        'Si autorizas el uso de tu imagen, lo haces por separado y puedes revocarlo cuando quieras escribiendo a la coordinación.']],
      ['Cambios y cierre', ['La organización puede ajustar estas condiciones por razones de seguridad, operación o normativa; los cambios se publican en esta misma página con su fecha.',
        'La participación termina al cerrar la edición 2026 o antes, si cualquiera de las partes lo decide.']],
    ],
  },
  '/finados/creadoras/politica-de-privacidad/': {
    title: 'Política de Privacidad',
    intro: 'Esta política explica qué datos pedimos a las creadoras de contenido, para qué los usamos y cómo ejercer tus derechos.',
    sections: [
      ['Responsable del tratamiento', [`El responsable es ${RESPONSIBLE}.`,
        'Para cualquier solicitud sobre tus datos, escribe a la coordinación del programa.']],
      ['Qué datos tratamos', ['De tu cuenta: tu correo electrónico y una contraseña que se guarda cifrada y que nadie de la organización puede leer.',
        'De tu registro: tu nombre y apellido, tu número de WhatsApp, tu ciudad, la red en la que publicas y el enlace de tu cuenta pública.',
        'De tu participación: los días y las horas que te asigna la coordinación, el lugar y las notas operativas del turno.',
        'Tu número de WhatsApp se guarda cifrado. No pedimos cédula, dirección, datos bancarios ni fotografía.']],
      ['Para qué los usamos', ['Para identificarte, coordinar tu participación y asignarte turnos.',
        'Para comunicarnos contigo sobre el calendario y la operación de la feria.',
        'Para dejar constancia de quién cambió cada turno del calendario y cuándo, de modo que la asignación sea verificable.']],
      ['Quién los ve', ['Solo el equipo organizador autorizado. No vendemos ni cedemos tus datos.',
        'La organización puede compartir el horario con el personal de operación y seguridad cuando sea necesario para tu ingreso.']],
      ['Cuánto tiempo', ['Conservamos tus datos durante tres años desde el cierre de la edición, para atender reclamos y rendir cuentas.',
        'Todavía no existe una purga automática: la eliminación se realiza a solicitud o al cumplirse el plazo, mediante un procedimiento manual documentado.']],
      ['Tus derechos', ['Puedes pedir acceso, rectificación, eliminación, oposición, portabilidad o la suspensión del tratamiento.',
        'Puedes retirar en cualquier momento la autorización de uso de imagen, si la diste, sin que eso afecte tu participación.',
        'Si consideras que no atendimos tu solicitud, puedes acudir a la autoridad de protección de datos personales del Ecuador.']],
    ],
  },
});

export function renderCreadoraLegalPage(page) {
  const document_ = DOCUMENTS[page.route];
  if (!document_) throw new Error(`Documento de creadoras no definido: ${page.route}`);
  const sections = document_.sections.map(([heading, paragraphs]) => `<section aria-labelledby="${esc(heading.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">
<h2 id="${esc(heading.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${esc(heading)}</h2>
${paragraphs.map(text => `<p>${esc(text)}</p>`).join('\n')}
</section>`).join('\n');
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(document_.title)} | Creadoras Finados 2026</title>
<meta name="description" content="${esc(document_.intro)}">
<meta name="robots" content="noindex, nofollow, noarchive">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}">
<link rel="icon" href="/assets/finados/favicon-finados.png"><meta name="theme-color" content="#241146">
<link rel="stylesheet" href="/assets/finados/finados.css?v=20260916-7">
<link rel="stylesheet" href="/assets/finados/navigation.css?v=20260925-navigation-fluid-1">
<link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260915-1">
<link rel="stylesheet" href="/assets/finados/creadoras.css?v=20260923-creadoras-1">
</head><body class="vocero-portal vocero-legal">
<a class="skip-link" href="#contenido">Ir al contenido</a><div class="vocero-chumbi" aria-hidden="true"></div>
<header class="site-header site-header--finados">
<a class="site-header__logo" href="/finados/" aria-label="Finados Mushuc Runa"><img src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados 2026, legado que nos une"></a>
${renderFinadosNavigation({ currentRoute: page.route })}
</header>
<main id="contenido" class="vocero-workspace vocero-workspace--legal">
<div class="vocero-access-intro"><p class="vocero-eyebrow">Creadoras de contenido</p><h1>${esc(document_.title)}</h1><p>${esc(document_.intro)}</p><p class="vocero-note">Versión ${VERSION} · Responsable: ${esc(RESPONSIBLE)}</p></div>
${sections}
<nav class="vocero-legal-links" aria-label="Otros documentos">
<a href="${BASE}/condiciones/">Condiciones de participación</a>
<a href="${BASE}/politica-de-privacidad/">Política de Privacidad</a>
</nav>
</main>
${renderFinadosFooter({})}
</body></html>`;
}
