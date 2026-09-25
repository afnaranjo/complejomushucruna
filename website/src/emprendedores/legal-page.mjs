import { readFileSync } from 'node:fs';
import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from '../finados/footer.mjs';
import { renderFinadosNavigation } from '../finados/navigation.mjs';

const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/emprendedor-consents.json', import.meta.url), 'utf8'));
const legalVersion = '2026-09-22';

const campaignAssetVersion = '20260914-1';
const campaignRuntimeVersion = '20260916-7';
const campaignScriptVersion = '20260918-navigation-progress-1';
const navigationAssetVersion = '20260925-navigation-fluid-1';

// Same controller already published in the Voceros and Medios legal documents.
const controller = Object.freeze({
  name: 'Eventos Finados 2026',
  address: 'Santa Lucía, Tisaleo, Tungurahua – Panamericana Sur km 12, vía Ambato–Riobamba',
  phone: '+593 980 346 729',
  email: 'facturacioncomplejomushuc@gmail.com',
  retention: 'tres años contados desde el último guardado del registro',
});

const officialSources = `<aside class="voceros-legal__sources" aria-labelledby="fuentes-normativas">
  <h2 id="fuentes-normativas">Marco normativo consultado</h2>
  <p>Estos documentos se prepararon con base en la normativa ecuatoriana vigente y la información proporcionada por el responsable del programa.</p>
  <ul>
    <li><a href="https://www.registroficial.gob.ec/quinto-suplemento-al-registro-oficial-no-459/" target="_blank" rel="noopener noreferrer">Ley Orgánica de Protección de Datos Personales <span aria-hidden="true">↗</span></a></li>
    <li><a href="https://www.registroficial.gob.ec/tercer-suplemento-al-registro-oficial-no-435/" target="_blank" rel="noopener noreferrer">Reglamento General de la LOPDP <span aria-hidden="true">↗</span></a></li>
    <li><a href="https://www.asambleanacional.gob.ec/es/contenido/constitucion-de-la-republica-del-ecuador" target="_blank" rel="noopener noreferrer">Constitución de la República del Ecuador <span aria-hidden="true">↗</span></a></li>
  </ul>
</aside>`;

export const emprendedorLegalDocuments = Object.freeze({
  policies: {
    slug: 'politicas-del-programa',
    consent: 'policies',
    eyebrow: 'Documento 01',
    title: 'Políticas del programa De emprendedor a influencer',
    summary: 'Reglas de participación, convivencia y contenidos para los emprendedores que cuentan su historia en video dentro de Finados Mushuc Runa 2026.',
    body: `
      <section><h2>1. Objeto y aceptación</h2><p>Estas políticas, administradas por ${controller.name}, regulan la participación voluntaria en el programa De emprendedor a influencer de Finados Mushuc Runa 2026. El registro y la aceptación expresa de estas reglas no crean relación laboral, societaria, de agencia, exclusividad ni representación legal con la organización, y no sustituyen el contrato o las condiciones de compra del stand cuando existan.</p></section>
      <section><h2>2. Quiénes pueden participar</h2><p>Pueden registrarse personas mayores de edad que produzcan o vendan un producto o servicio y participen o tengan previsto participar como expositoras en la feria. La organización podrá solicitar documentos razonables para verificar identidad, edad y vínculo con el emprendimiento.</p></section>
      <section><h2>3. Participación voluntaria y gratuita</h2><p>La inscripción no tiene costo y no garantiza por sí sola un stand, un lugar ni un beneficio. Cada emprendedor decide si publica, cuándo publica y cómo cuenta su historia. La participación no constituye trabajo para la organización ni promete ventas.</p></section>
      <section><h2>4. Contenido permitido</h2><ul><li>Historias propias y reales sobre el emprendimiento, su producto, su ubicación en la feria y los motivos para visitarlo.</li><li>Información ya comunicada por los canales oficiales de la feria.</li><li>Contenido respetuoso con la comunidad Chibuleo, visitantes, artistas, otros expositores y personal.</li><li>Material propio o utilizado con las licencias y permisos correspondientes.</li></ul></section>
      <section><h2>5. Contenido no permitido</h2><ul><li>Datos, programación, precios de entradas o anuncios de la feria todavía no publicados oficialmente.</li><li>Mensajes discriminatorios, violentos, engañosos, difamatorios o que vulneren derechos.</li><li>Promesas sobre resultados, premios o ventas que la organización no haya comunicado.</li><li>Imagen, voz o datos de niñas, niños y adolescentes sin autorización verificable de su representante.</li><li>Música, imágenes, marcas o trabajos de terceros sin permiso.</li></ul></section>
      <section><h2>6. Transparencia</h2><p>Cuando exista una contraprestación, regalo, pase, reconocimiento o cualquier incentivo relacionado con una publicación, el emprendedor deberá identificar esa relación de forma clara y visible, conforme a las reglas de la plataforma y la legislación aplicable.</p></section>
      <section><h2>7. Propiedad intelectual</h2><p>El emprendedor conserva la titularidad de su contenido y de su marca. La organización solo podrá reutilizar imagen, voz y publicaciones cuando exista la autorización separada aceptada en el formulario, dentro de los medios, plazo y finalidades descritos en ese documento.</p></section>
      <section><h2>8. Seguridad y convivencia</h2><p>Los participantes deben seguir instrucciones legítimas del personal de seguridad y producción, respetar aforos, señalización y zonas de acceso, pedir permiso antes de grabar de cerca a otras personas y evitar conductas que expongan a otros o a sí mismos a riesgos.</p></section>
      <section><h2>9. Verificación y medidas</h2><p>La organización podrá pedir enlaces, capturas o una revisión en vivo de analíticas. Ante información falsa, fraude, compra de vistas, incumplimiento grave o vulneración de derechos, podrá excluir el contenido afectado, suspender la participación o retirar reconocimientos, explicando el motivo y permitiendo una solicitud de revisión.</p></section>
      <section><h2>10. Cambios y comunicaciones</h2><p>Los cambios materiales se comunicarán por los canales del programa y regirán hacia el futuro. Si una modificación afecta el consentimiento, se solicitará una nueva aceptación.</p></section>
      <section><h2>11. Consultas y reclamos</h2><p>Las consultas sobre participación se atenderán mediante el canal oficial que figura en “Contacto para ejercer derechos”. Los reclamos sobre la medición se tramitan según las Bases de participación.</p></section>`,
  },
  bases: {
    slug: 'bases-de-participacion',
    consent: 'policies',
    eyebrow: 'Documento 02',
    title: 'Bases de participación',
    summary: 'Cómo se registran los videos, cómo valida la coordinación los seguidores y las vistas, y cómo se comunican niveles y reconocimientos.',
    body: `
      <section><h2>1. Organizador y ámbito</h2><p>${controller.name} organiza el programa De emprendedor a influencer como una dinámica de acompañamiento y reconocimiento por desempeño para expositores registrados en Finados Mushuc Runa 2026. No es un sorteo ni una promoción basada en azar.</p></section>
      <section><h2>2. Videos del programa</h2><p>Cada emprendedor cuenta con cinco espacios de video. La coordinación habilita cada espacio en una fecha común para todos los participantes, visible en el registro. Una vez habilitado, el emprendedor pega el enlace público de su video; el enlace recibido queda como evidencia y no puede editarse. Solo cuentan videos publicados desde un perfil público declarado en el registro.</p></section>
      <section><h2>3. Vistas y seguidores válidos</h2><p>La coordinación registra, junto a cada video, las vistas validadas según la analítica de la plataforma, y los seguidores validados del perfil principal. No suman vistas o seguidores obtenidos mediante pauta no autorizada, promoción pagada, bots, compra o intercambio de interacciones, automatizaciones ni cualquier manipulación artificial.</p></section>
      <section><h2>4. Niveles y semáforo</h2><p>El registro muestra un nivel del 0 al 6 y un semáforo (rojo, amarillo, verde) que la coordinación actualiza con la métrica validada. Los criterios de cada nivel, los reconocimientos asociados y las fechas de cierre serán publicados por la organización en sus canales oficiales antes de aplicarse. Mientras no se publiquen, el nivel es una referencia de seguimiento y no otorga por sí solo un beneficio.</p></section>
      <section><h2>5. Reconocimientos</h2><p>Cualquier reconocimiento, premio o incentivo del programa, su monto o descripción, el número de personas reconocidas, el mecanismo de ordenamiento, los impuestos aplicables y la forma de entrega deberán anunciarse por escrito antes de adjudicarse. Si estos elementos no se publican, no podrán adjudicarse.</p></section>
      <section><h2>6. Corte, empate y revisión</h2><p>Cuando se publique una clasificación, se determinará por la métrica validada al cierre comunicado. El participante podrá pedir revisión dentro de los tres días calendario siguientes a la comunicación del resultado.</p></section>
      <section><h2>7. Fraude y descalificación</h2><p>La organización documentará cualquier exclusión de vistas o descalificación. El participante será informado y podrá entregar evidencia dentro de tres días calendario. Una exclusión no se basará únicamente en una decisión automatizada.</p></section>
      <section><h2>8. Entrega</h2><p>La entrega de cualquier reconocimiento requiere verificación de identidad y cumplimiento de estas bases. Los reconocimientos no son canjeables por dinero salvo que se haya anunciado expresamente como tal.</p></section>
      <section><h2>9. Casos de fuerza mayor</h2><p>Si una causa imprevisible hace imposible entregar un reconocimiento, la organización informará la situación y propondrá una alternativa equivalente cuando sea razonablemente posible.</p></section>`,
  },
  privacy: {
    slug: 'politica-de-privacidad',
    consent: 'data',
    eyebrow: 'Documento 03',
    title: 'Política de Privacidad',
    summary: 'Información previa sobre el tratamiento de datos personales del registro de emprendedores, conforme a la legislación ecuatoriana.',
    body: `
      <section><h2>1. Responsable y contacto</h2><p>El responsable de este tratamiento es <strong>${controller.name}</strong>, con domicilio en ${controller.address}, teléfono <a href="tel:+593980346729">${controller.phone}</a> y correo electrónico <a href="mailto:${controller.email}">${controller.email}</a>.</p></section>
      <section><h2>2. Datos tratados</h2><p>Se recopilan correo de la cuenta, nombre, cédula, fecha de nacimiento, WhatsApp, ciudad, nombre del emprendimiento, producto o servicio, número o código de stand cuando exista, perfiles sociales, red principal y participación anterior. La fotografía de la persona registrada es obligatoria para identificación y gafete. También se registran fecha, dirección IP y navegador como evidencia de consentimiento y seguridad, y la coordinación registra seguidores, nivel, semáforo, enlaces de video y vistas validadas.</p></section>
      <section><h2>3. Origen</h2><p>Los datos se obtienen directamente del participante. La organización no solicita contraseñas de redes sociales.</p></section>
      <section><h2>4. Finalidades</h2><ul><li>Verificar identidad con la fotografía y elaborar el gafete digital del programa.</li><li>Gestionar inscripción, elegibilidad, comunicaciones y participación.</li><li>Registrar y validar videos, vistas, seguidores, niveles y reconocimientos.</li><li>Atender consultas, reclamos y solicitudes de derechos.</li><li>Prevenir fraude, abuso y envíos automatizados.</li><li>Conservar evidencia de los consentimientos otorgados.</li></ul><p>Los datos no se usarán para publicidad ajena al programa ni se venderán.</p></section>
      <section><h2>5. Base legitimadora</h2><p>El tratamiento se fundamenta en el consentimiento libre, específico, informado e inequívoco del titular. La participación y el uso de imagen se aceptan por separado. El consentimiento puede revocarse sin efectos retroactivos.</p></section>
      <section><h2>6. Base de datos y operaciones</h2><p>Los datos se registran en bases digitales propias del programa, separadas de las de otros programas de la feria, para recepción, validación, consulta, organización, comunicación, respaldo, actualización y eliminación. No se adoptan decisiones con efectos jurídicos basadas únicamente en procesos automatizados.</p></section>
      <section><h2>7. Destinatarios y transferencias</h2><p>Accederán únicamente el equipo autorizado del programa y los proveedores tecnológicos necesarios para alojar el sitio y almacenar el registro. La cédula, la fecha de nacimiento, el WhatsApp y el correo se guardan cifrados. La fotografía permanece cifrada en un almacén propio, con acceso restringido al titular y al equipo administrativo autorizado, y no se incluye en exportaciones. El gafete que el titular genera muestra su nombre, su emprendimiento, una versión parcial de su cédula, su nivel y su semáforo, y solo él decide si lo comparte. La validación pública del QR expone únicamente nombre, emprendimiento, nivel y semáforo.</p></section>
      <section><h2>8. Conservación</h2><p>Los registros y la fotografía se conservarán durante <strong>${controller.retention}</strong>. Actualmente no hay purga automática configurada. El responsable debe gestionar la eliminación o anonimización segura al cumplir el plazo, incluyendo base, fotografía, exportaciones y política de respaldos, salvo obligación legal o necesidad documentada para la formulación, ejercicio o defensa de reclamaciones.</p></section>
      <section><h2>9. Entrega o negativa</h2><p>Los campos obligatorios son necesarios para verificar identidad y administrar el programa. No entregarlos impide completar el registro. Los datos inexactos pueden impedir la validación; el titular puede solicitar su rectificación.</p></section>
      <section><h2>10. Derechos</h2><p>El titular puede solicitar acceso, rectificación, actualización, eliminación, oposición, suspensión, limitación, portabilidad y revocación del consentimiento, además de no ser objeto de decisiones exclusivamente automatizadas. Estos derechos son gratuitos y no pueden renunciarse por anticipado.</p></section>
      <section><h2>11. Seguridad</h2><p>Se aplican controles de acceso, cifrado de datos identificativos y fotografías, almacenamiento fuera del directorio público, limitación de intentos, registro de consentimientos y de acciones administrativas, cifrado en tránsito y copias de respaldo. Ningún sistema elimina por completo el riesgo; cualquier incidente se gestionará conforme a la normativa aplicable.</p></section>
      <section><h2>12. Reclamos</h2><p>Las solicitudes se presentan por el canal publicado en “Contacto para ejercer derechos”. Si la respuesta no satisface al titular, puede acudir a la Superintendencia de Protección de Datos Personales del Ecuador.</p></section>
      <section><h2>13. Cambios</h2><p>Los cambios se versionarán y publicarán con su fecha. Si una modificación introduce nuevas finalidades o altera de forma material el tratamiento basado en consentimiento, se solicitará una nueva autorización.</p></section>`,
  },
  image: {
    slug: 'autorizacion-de-imagen',
    consent: 'image',
    eyebrow: 'Documento 04',
    title: 'Autorización de uso de imagen y contenido',
    summary: 'Alcance separado y revocable para el uso de la imagen del emprendedor, la de su emprendimiento y las publicaciones creadas dentro del programa.',
    body: `
      <section><h2>1. Titular</h2><p>La autorización la concede la persona registrada, quien declara ser mayor de edad y estar facultada para autorizar el uso del nombre y la imagen de su emprendimiento.</p></section>
      <section><h2>2. Material autorizado</h2><p>La carga de la fotografía para identidad y gafete tiene un uso operativo separado y no autoriza por sí sola su publicación. La difusión requiere esta autorización independiente. Comprende la imagen y voz del participante, su nombre público, el nombre e imagen de su emprendimiento y sus productos, fotografías o videos en los que aparezca y el contenido que identifique voluntariamente como parte del programa.</p></section>
      <section><h2>3. Finalidad</h2><p>${controller.name} podrá comunicar, reconocer y documentar la participación en Finados Mushuc Runa 2026; republicar contenidos elegibles; preparar memorias informativas del evento; y difundir el programa y a sus expositores en sus canales oficiales.</p></section>
      <section><h2>4. Medios y territorio</h2><p>La autorización cubre sitio web, redes sociales oficiales, piezas digitales, prensa, pantallas y materiales impresos vinculados a la feria, con alcance nacional e internacional por la naturaleza de Internet.</p></section>
      <section><h2>5. Licencia</h2><p>La licencia es no exclusiva, gratuita y limitada a las finalidades descritas. El contenido y la marca siguen perteneciendo a su titular. La organización no puede venderlos de forma separada ni cederlos para campañas ajenas sin una nueva autorización.</p></section>
      <section><h2>6. Edición e integridad</h2><p>Se permiten ajustes técnicos de formato, duración, subtítulos, encuadre, color y composición que no alteren el sentido del mensaje ni afecten honor, reputación o dignidad. Se procurará acreditar al emprendedor cuando el formato lo permita.</p></section>
      <section><h2>7. Material de terceros</h2><p>El participante declara que cuenta con derechos o permisos sobre lo que entrega. No deberá incorporar música, imágenes, marcas o personas identificables sin autorización. La organización puede abstenerse de publicar material que genere dudas razonables sobre derechos.</p></section>
      <section><h2>8. Revocación</h2><p>El titular puede revocar la autorización mediante el canal de derechos. La revocación no afecta usos lícitos anteriores; la organización retirará el material de canales digitales bajo su control dentro de un plazo razonable y cesará nuevos usos, salvo deber legal o defensa de reclamaciones.</p></section>
      <section><h2>9. Contenido ya distribuido</h2><p>La organización no puede garantizar el retiro de copias realizadas por terceros, publicaciones compartidas fuera de sus canales o materiales impresos ya distribuidos antes de recibir la revocación.</p></section>
      <section><h2>10. Ausencia de obligación</h2><p>Autorizar no obliga a la organización a publicar el material ni garantiza selección, alcance, reconocimiento, ventas o contratación.</p></section>
      <section><h2>11. Evidencia</h2><p>La aceptación se registra con versión, fecha, hora, dirección IP no reversible e identificador de registro, exclusivamente para demostrar el consentimiento y atender derechos o controversias.</p></section>`,
  },
  rights: {
    slug: 'ejercer-derechos',
    consent: null,
    eyebrow: 'Documento 05',
    title: 'Contacto para ejercer derechos',
    summary: 'Procedimiento gratuito para consultar, corregir, limitar o eliminar datos y revocar consentimientos.',
    body: `
      <section><h2>1. Derechos disponibles</h2><p>Puedes solicitar acceso, rectificación, actualización, eliminación, oposición, suspensión, limitación, portabilidad y revocación del consentimiento, además de información sobre el tratamiento y una explicación de cualquier decisión automatizada.</p></section>
      <section><h2>2. Canal oficial</h2><p>Presenta tu solicitud ante <strong>${controller.name}</strong> mediante el correo <a href="mailto:${controller.email}">${controller.email}</a>. También puedes comunicarte al <a href="tel:+593980346729">${controller.phone}</a> o dirigirte a ${controller.address}. No envíes documentos de identidad por canales distintos a estos contactos oficiales.</p></section>
      <section><h2>3. Contenido de la solicitud</h2><ul><li>Nombres completos del titular.</li><li>Derecho que desea ejercer y explicación concreta.</li><li>Correo o teléfono para recibir la respuesta.</li><li>Información razonable que permita localizar el registro.</li></ul><p>Se solicitará prueba de identidad solo cuando sea necesaria y por un medio seguro. Si actúa un representante, deberá acreditar su representación.</p></section>
      <section><h2>4. Atención y plazo</h2><p>La solicitud es gratuita. El responsable confirmará la recepción y la atenderá dentro de los plazos de la Ley Orgánica de Protección de Datos Personales; los derechos de acceso, rectificación, actualización, eliminación y oposición se tramitan, con carácter general, dentro de quince días.</p></section>
      <section><h2>5. Recuperación de acceso</h2><p>Si olvidaste tu contraseña, solicita por este mismo canal un enlace temporal de restablecimiento. El enlace es de un solo uso y vence a los treinta minutos.</p></section>
      <section><h2>6. Revocación de imagen</h2><p>Para retirar una autorización de imagen o voz, identifica el contenido y el canal donde aparece. La organización cesará nuevos usos y gestionará el retiro de los canales digitales bajo su control, sin efectos retroactivos.</p></section>
      <section><h2>7. Respuesta y negativa</h2><p>Si una solicitud no puede atenderse total o parcialmente por una excepción legal, la respuesta explicará el motivo y los medios disponibles para reclamar. La identidad del solicitante se verificará sin recopilar datos excesivos.</p></section>
      <section><h2>8. Autoridad de control</h2><p>Si consideras que tu solicitud no fue atendida adecuadamente, puedes presentar un reclamo ante la <a href="https://spdp.gob.ec/" target="_blank" rel="noopener noreferrer">Superintendencia de Protección de Datos Personales <span aria-hidden="true">↗</span></a>.</p></section>`,
  },
});

export const emprendedorLegalRoutes = Object.freeze(Object.fromEntries(
  Object.entries(emprendedorLegalDocuments).map(([key, document]) => [key, `/finados/emprendedores/${document.slug}/`]),
));

export function renderEmprendedorLegalPage(page) {
  const document = emprendedorLegalDocuments[page.documentKey];
  if (!document) throw new Error(`Documento de Emprendedores no reconocido: ${page.documentKey}`);
  const consent = document.consent ? consents[document.consent] : null;
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
        <a class="voceros-legal__back" href="/finados/emprendedores/#documentos-legales">← Volver a Emprendedores</a>
        <p>${escapeHtml(document.eyebrow)} · De emprendedor a influencer</p>
        <h1>${escapeHtml(document.title)}</h1>
        <span>${escapeHtml(document.summary)}</span>
        <small>Versión vigente · <time datetime="${legalVersion}">22 de septiembre de 2026</time></small>
      </div>
    </header>
    <div class="voceros-legal__layout voceros-shell">
      <article class="voceros-legal__content">
        ${document.body}
        ${consent ? `<section><h2>Texto de aceptación del formulario</h2><p data-consent-text="${document.consent}">${escapeHtml(consent.text)}</p></section>` : ''}
      </article>
      ${officialSources}
    </div>
  </main>
  ${renderFinadosFooter()}
</body>
</html>`;
}
