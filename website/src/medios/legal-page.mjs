import { readFileSync } from 'node:fs';
import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from '../finados/footer.mjs';
import { renderFinadosNavigation } from '../finados/navigation.mjs';

const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/media-consents.json', import.meta.url), 'utf8'));

const campaignAssetVersion = '20260914-1';
const campaignRuntimeVersion = '20260916-7';
const campaignScriptVersion = '20260918-navigation-progress-1';
const navigationAssetVersion = '20260918-navigation-progress-1';

// Same controller already published in the Voceros legal documents.
const controller = Object.freeze({
  name: 'Eventos Finados 2026',
  address: 'Santa Lucía, Tisaleo, Tungurahua – Panamericana Sur km 12, vía Ambato–Riobamba',
  phone: '+593 980 346 729',
  email: 'facturacioncomplejomushuc@gmail.com',
  retention: 'tres años contados desde el último guardado del registro',
});

const officialSources = `<aside class="voceros-legal__sources" aria-labelledby="fuentes-normativas">
  <h2 id="fuentes-normativas">Marco normativo consultado</h2>
  <p>Estos documentos se prepararon con base en la normativa ecuatoriana vigente y la información proporcionada por el responsable del evento.</p>
  <ul>
    <li><a href="https://www.registroficial.gob.ec/quinto-suplemento-al-registro-oficial-no-459/" target="_blank" rel="noopener noreferrer">Ley Orgánica de Protección de Datos Personales <span aria-hidden="true">↗</span></a></li>
    <li><a href="https://www.registroficial.gob.ec/tercer-suplemento-al-registro-oficial-no-435/" target="_blank" rel="noopener noreferrer">Reglamento General de la LOPDP <span aria-hidden="true">↗</span></a></li>
    <li><a href="https://www.asambleanacional.gob.ec/es/contenido/constitucion-de-la-republica-del-ecuador" target="_blank" rel="noopener noreferrer">Constitución de la República del Ecuador <span aria-hidden="true">↗</span></a></li>
  </ul>
</aside>`;

export const mediaLegalDocuments = Object.freeze({
  practices: {
    slug: 'buenas-practicas',
    consent: 'conditions',
    eyebrow: 'Documento 01',
    title: 'Buenas prácticas para medios',
    summary: 'Condiciones de acreditación, cobertura responsable y reporte de publicaciones para los medios registrados en Finados Mushuc Runa 2026.',
    body: `
      <section><h2>1. Objeto y aceptación</h2><p>Estas buenas prácticas, administradas por ${controller.name}, orientan la cobertura de los medios de comunicación registrados en Finados Mushuc Runa 2026. El registro y su aceptación no crean relación laboral, societaria, de agencia, exclusividad ni representación legal con la organización, y no sustituyen un contrato publicitario cuando este exista.</p></section>
      <section><h2>2. Registro y acreditación</h2><p>Cada medio registra una cuenta, sus datos, su ubicación, una persona de contacto y sus canales. La acreditación está sujeta a revisión y aprobación de la organización. Las condiciones de ingreso, las zonas y los horarios de cobertura serán los que la organización comunique por sus canales oficiales; el registro por sí solo no garantiza acceso a áreas restringidas.</p></section>
      <section><h2>3. Información veraz y oficial</h2><ul><li>Difunde información verificada y cita los canales oficiales de la feria cuando se trate de fechas, programación, precios o condiciones.</li><li>No publiques como oficiales datos, artistas, precios o anuncios que la organización todavía no haya comunicado.</li><li>Corrige con la misma visibilidad cualquier dato erróneo que se haya difundido.</li></ul></section>
      <section><h2>4. Respeto y convivencia</h2><ul><li>Trata con respeto a la comunidad Chibuleo, visitantes, artistas, expositores y personal del evento.</li><li>Evita contenidos discriminatorios, violentos, engañosos o que vulneren el honor o la intimidad de las personas.</li><li>No difundas imagen, voz o datos de niñas, niños y adolescentes sin autorización verificable de su representante.</li><li>Pide permiso antes de grabar de cerca o entrevistar a una persona.</li></ul></section>
      <section><h2>5. Seguridad y operación</h2><p>El equipo del medio debe seguir las instrucciones legítimas del personal de seguridad y de producción, respetar aforos, señalización y zonas de acceso, y no interferir con la operación. El uso de drones, estructuras, iluminación adicional o equipos que ocupen espacio de circulación requiere autorización previa de la organización.</p></section>
      <section><h2>6. Derechos de artistas y terceros</h2><p>La grabación y transmisión de presentaciones artísticas está sujeta a las condiciones de cada artista y su producción. El medio es responsable de contar con los derechos y licencias de la música, imágenes, marcas y demás material de terceros que incorpore en sus publicaciones.</p></section>
      <section><h2>7. Reporte de publicaciones</h2><p>El medio puede reportar en su registro los enlaces de los videos que publique sobre la feria. La organización validará las visualizaciones de cada enlace y podrá elaborar un ranking de alcance. Ese ranking es una referencia de seguimiento: no constituye concurso ni otorga premios, salvo que la organización lo comunique expresamente por escrito. No se consideran válidas las visualizaciones obtenidas mediante compra, bots o manipulación artificial.</p></section>
      <section><h2>8. Transparencia publicitaria</h2><p>Cuando una publicación responda a un contrato, canje, pauta o cualquier contraprestación, el medio la identificará como tal de forma clara, conforme a las reglas de cada plataforma y a la legislación aplicable.</p></section>
      <section><h2>9. Medidas</h2><p>Ante información falsa en el registro, incumplimiento grave de estas prácticas, riesgo para la seguridad o vulneración de derechos, la organización podrá rechazar o suspender la acreditación y retirar del seguimiento las publicaciones afectadas, explicando el motivo y permitiendo una solicitud de revisión.</p></section>
      <section><h2>10. Cambios y contacto</h2><p>Los cambios materiales se comunicarán por los canales oficiales y regirán hacia el futuro; si afectan el consentimiento, se solicitará una nueva aceptación. Las consultas se atienden en <a href="mailto:${controller.email}">${controller.email}</a> o en el teléfono <a href="tel:+593980346729">${controller.phone}</a>.</p></section>`,
  },
  image: {
    slug: 'uso-de-imagen',
    consent: 'image',
    eyebrow: 'Documento 02',
    title: 'Autorización de uso de imagen y contenido para medios',
    summary: 'Alcance separado, opcional y revocable para el uso del nombre y logotipo del medio, la imagen de su equipo y las publicaciones que reporte.',
    body: `
      <section><h2>1. Quién autoriza</h2><p>La autorización la concede la persona que administra la cuenta del medio, quien declara estar facultada para hacerlo en nombre del medio y haber informado a los integrantes de su equipo que puedan ser captados durante la cobertura.</p></section>
      <section><h2>2. Es opcional</h2><p>Esta autorización es independiente del registro. El medio puede registrarse, acreditarse y reportar sus publicaciones aunque no la conceda, y puede retirarla en cualquier momento desde su registro, sin efectos retroactivos.</p></section>
      <section><h2>3. Material autorizado</h2><p>Comprende el nombre comercial y el logotipo del medio, la imagen y la voz de su equipo captadas durante la cobertura del evento, y las publicaciones sobre la feria que el medio reporte voluntariamente en su registro.</p></section>
      <section><h2>4. Finalidad</h2><p>${controller.name} podrá reconocer y documentar la cobertura de Finados Mushuc Runa 2026, compartir o republicar las publicaciones reportadas con crédito al medio, preparar memorias informativas del evento y difundir la participación de los medios en sus canales oficiales.</p></section>
      <section><h2>5. Medios y territorio</h2><p>La autorización cubre sitio web, redes sociales oficiales, piezas digitales, prensa, pantallas y materiales impresos vinculados a la feria, con alcance nacional e internacional por la naturaleza de Internet.</p></section>
      <section><h2>6. Licencia</h2><p>La licencia es no exclusiva, gratuita y limitada a las finalidades descritas. El contenido sigue perteneciendo al medio. La organización no puede venderlo de forma separada ni cederlo para campañas ajenas sin una nueva autorización.</p></section>
      <section><h2>7. Edición e integridad</h2><p>Se permiten ajustes técnicos de formato, duración, subtítulos, encuadre, color y composición que no alteren el sentido del mensaje ni afecten el honor, la reputación o la línea editorial del medio. Se acreditará al medio cuando el formato lo permita.</p></section>
      <section><h2>8. Material de terceros</h2><p>El medio declara que cuenta con los derechos o permisos sobre lo que reporta. La organización puede abstenerse de usar material que genere dudas razonables sobre derechos de terceros.</p></section>
      <section><h2>9. Plazo y revocación</h2><p>La autorización rige durante ${controller.retention}. Para retirarla, desmarca la casilla en tu registro o escribe a <a href="mailto:${controller.email}">${controller.email}</a>. La organización dejará de realizar nuevos usos y retirará, en un plazo razonable, el material de sus canales propios cuando sea técnicamente posible.</p></section>`,
  },
  privacy: {
    slug: 'politica-de-privacidad',
    consent: 'privacy',
    eyebrow: 'Documento 03',
    title: 'Política de Privacidad para medios',
    summary: 'Información previa sobre el tratamiento de los datos del registro de medios, conforme a la legislación ecuatoriana.',
    body: `
      <section><h2>1. Responsable y contacto</h2><p>El responsable de este tratamiento es <strong>${controller.name}</strong>, con domicilio en ${controller.address}, teléfono <a href="tel:+593980346729">${controller.phone}</a> y correo electrónico <a href="mailto:${controller.email}">${controller.email}</a>.</p></section>
      <section><h2>2. Datos tratados</h2><p>Se recopilan el correo de la cuenta; el nombre del medio, su frecuencia o canal, provincia y ciudad; el nombre, número telefónico y correo de la persona de contacto; los enlaces de las redes sociales y la página web del medio; y los enlaces de los videos que reporte. La organización registra además las visualizaciones que valida para cada enlace, el estado del registro y notas internas de gestión. También se conservan fecha, versión del texto aceptado y un identificador cifrado e irreversible de la dirección IP como evidencia de consentimiento y seguridad.</p></section>
      <section><h2>3. Origen</h2><p>Los datos se obtienen directamente de la persona que administra la cuenta del medio. La organización no solicita contraseñas de redes sociales.</p></section>
      <section><h2>4. Finalidades</h2><ul><li>Gestionar el registro, la acreditación y las comunicaciones con el medio.</li><li>Elaborar un mapa de los medios que cubren la feria, por ubicación y canales.</li><li>Dar seguimiento a las publicaciones reportadas y a sus visualizaciones.</li><li>Atender consultas, reclamos y solicitudes de derechos.</li><li>Prevenir fraude, abuso y envíos automatizados.</li><li>Conservar evidencia de los consentimientos otorgados.</li></ul><p>Los datos no se usarán para publicidad ajena al evento ni se venderán.</p></section>
      <section><h2>5. Base legitimadora</h2><p>El tratamiento se fundamenta en el consentimiento libre, específico, informado e inequívoco del titular. Las casillas de aceptación se muestran marcadas para agilizar el registro; la persona puede desmarcarlas antes de enviar. El uso de imagen se acepta por separado, es opcional y no condiciona el registro. El consentimiento puede revocarse sin efectos retroactivos.</p></section>
      <section><h2>6. Base de datos y seguridad</h2><p>Los datos se registran en una base digital para su recepción, validación, consulta, organización, comunicación, respaldo, actualización y eliminación. El nombre, el teléfono y el correo de la persona de contacto se almacenan cifrados. No se adoptan decisiones con efectos jurídicos basadas únicamente en procesos automatizados.</p></section>
      <section><h2>7. Destinatarios y transferencias</h2><p>Accederán únicamente el equipo autorizado del evento y los proveedores tecnológicos necesarios para alojar el sitio y almacenar el registro. Los datos de contacto no se publican. No se comunicarán datos a terceros para finalidades propias sin una base legal.</p></section>
      <section><h2>8. Conservación</h2><p>Los registros se conservarán durante <strong>${controller.retention}</strong>. Actualmente no hay purga automática configurada; el responsable debe gestionar la eliminación o anonimización segura al cumplir el plazo, incluidos respaldos y exportaciones, salvo obligación legal o necesidad documentada para la formulación, ejercicio o defensa de reclamaciones. Cuando la organización retira un registro, este deja de ser visible y su cuenta se desactiva.</p></section>
      <section><h2>9. Derechos</h2><p>El titular puede ejercer sus derechos de acceso, rectificación y actualización, eliminación, oposición, suspensión y portabilidad, así como revocar su consentimiento, escribiendo a <a href="mailto:${controller.email}">${controller.email}</a> desde el correo de la cuenta del medio. La solicitud es gratuita y se atenderá dentro de los plazos de la Ley Orgánica de Protección de Datos Personales. Si considera que su solicitud no fue atendida, puede acudir a la Superintendencia de Protección de Datos Personales.</p></section>`,
  },
});

export const mediaLegalRoutes = Object.freeze(Object.fromEntries(
  Object.entries(mediaLegalDocuments).map(([key, document]) => [key, `/finados/medios/${document.slug}/`]),
));

export function renderMediaLegalPage(page) {
  const document = mediaLegalDocuments[page.documentKey];
  if (!document) throw new Error(`Documento de Medios no reconocido: ${page.documentKey}`);
  const consent = consents[document.consent];
  const canonical = `${site.baseUrl}${page.route}`;

  return `<!doctype html>
<html lang="es" class="scroll-smooth bg-night">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(document.title)} | Finados Mushuc Runa 2026</title>
  <meta name="description" content="${escapeHtml(document.summary)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#241146">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="/assets/finados/favicon-finados.png">
  <link rel="preload" as="image" href="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" fetchpriority="high">
  <link rel="stylesheet" href="/assets/finados/finados.css?v=${campaignRuntimeVersion}">
  <link rel="stylesheet" href="/assets/finados/voceros.css?v=${campaignRuntimeVersion}">
  <link rel="stylesheet" href="/assets/finados/navigation.css?v=${navigationAssetVersion}">
  <script type="module" src="/assets/finados/finados.js?v=${campaignScriptVersion}"></script>
</head>
<body class="voceros-page voceros-legal-page">
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="chumbi-line voceros-chumbi" aria-hidden="true"></div>
  <header class="site-header site-header--finados campaign-header voceros-header" data-header>
    <a class="brand finados-brand voceros-header__brand" href="/finados/" aria-label="Finados 2026, página principal">
      <img src="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" width="766" height="449" alt="Finados 2026, legado que nos une">
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navegacion-principal"><span></span><span></span><span></span><span class="sr-only">Abrir menú</span></button>
    ${renderFinadosNavigation({ currentRoute: page.route })}
  </header>
  <main id="contenido">
    <header class="voceros-legal__hero">
      <div class="voceros-shell">
        <a class="voceros-legal__back" href="/finados/medios/">← Volver a Medios</a>
        <p>${escapeHtml(document.eyebrow)} · Registro de medios</p>
        <h1>${escapeHtml(document.title)}</h1>
        <span>${escapeHtml(document.summary)}</span>
        <small>Versión vigente · <time datetime="2026-09-21">21 de septiembre de 2026</time></small>
      </div>
    </header>
    <div class="voceros-legal__layout voceros-shell">
      <article class="voceros-legal__content">
        ${document.body}
        <section><h2>Texto de aceptación del formulario</h2><p data-consent-text="${document.consent}">${escapeHtml(consent.text)}</p></section>
      </article>
      ${officialSources}
    </div>
  </main>
  ${renderFinadosFooter()}
</body>
</html>`;
}
