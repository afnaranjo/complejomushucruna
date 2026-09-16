import { readFileSync } from 'node:fs';
import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from './footer.mjs';
import { renderFinadosNavigation } from './navigation.mjs';

const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/vocero-consents.json', import.meta.url), 'utf8'));
const legalVersions = { privacy: consents.data.version, image: consents.image.version, policies: consents.policies.version.split(' + ')[0], thermometer: consents.policies.version.split(' + ')[1], rights: '2026-09-14' };

const campaignAssetVersion = '20260914-1';
const campaignRuntimeVersion = '20260916-3';

const controller = Object.freeze({
  name: 'Eventos Finados 2026',
  address: 'Santa Lucía, Tisaleo, Tungurahua – Panamericana Sur km 12, vía Ambato–Riobamba',
  phone: '+593 980 346 729',
  email: 'facturacioncomplejomushuc@gmail.com',
  retention: 'tres años contados desde el envío del formulario',
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

const documents = Object.freeze({
  policies: {
    eyebrow: 'Documento 01',
    title: 'Políticas del Vocero',
    summary: 'Reglas de participación, convivencia, contenidos y entrega de beneficios para la Comunidad de Voceros de Finados Mushuc Runa 2026.',
    body: `
      <section><h2>1. Objeto y aceptación</h2><p>Estas políticas, administradas por ${controller.name}, regulan la participación voluntaria en la Comunidad de Voceros de Finados Mushuc Runa 2026. El registro y la aceptación expresa de estas reglas no crean relación laboral, societaria, de agencia, exclusividad ni representación legal con la organización.</p></section>
      <section><h2>2. Quiénes pueden participar</h2><p>Pueden registrarse personas desde los 18 años. Las personas de 16 o 17 años necesitan autorización escrita de su representante legal y no podrán cubrir actividades nocturnas. La organización podrá solicitar documentos razonables para verificar identidad, edad y representación.</p></section>
      <section><h2>3. Participación voluntaria y gratuita</h2><p>La inscripción no tiene costo. Cada vocero decide si publica, cuándo publica y cómo expresa su experiencia, sin turnos obligatorios. Los beneficios dependen del cumplimiento de las bases y de la verificación de vistas; no constituyen salario ni pago por una relación de trabajo.</p></section>
      <section><h2>4. Contenido permitido</h2><ul><li>Experiencias propias, reales y verificables sobre la feria.</li><li>Información ya comunicada por los canales oficiales.</li><li>Contenido respetuoso con la comunidad Chibuleo, visitantes, artistas, expositores y personal.</li><li>Material propio o utilizado con las licencias y permisos correspondientes.</li></ul></section>
      <section><h2>5. Contenido no permitido</h2><ul><li>Datos, programación, precios o anuncios todavía no publicados oficialmente.</li><li>Mensajes discriminatorios, violentos, engañosos, difamatorios o que vulneren derechos.</li><li>Grabaciones en zonas restringidas o que interfieran con seguridad y operación.</li><li>Imagen, voz o datos de niñas, niños y adolescentes sin autorización verificable de su representante.</li><li>Música, imágenes, marcas o trabajos de terceros sin permiso.</li></ul></section>
      <section><h2>6. Transparencia</h2><p>Cuando exista una contraprestación, regalo, pase, premio o cualquier incentivo relacionado con una publicación, el vocero deberá identificar esa relación de forma clara y visible, conforme a las reglas de la plataforma y la legislación aplicable.</p></section>
      <section><h2>7. Propiedad intelectual</h2><p>El vocero conserva la titularidad de su contenido. La organización solo podrá reutilizar imagen, voz y publicaciones cuando exista la autorización separada aceptada en el formulario, dentro de los medios, plazo y finalidades descritos en ese documento.</p></section>
      <section><h2>8. Seguridad y convivencia</h2><p>Los participantes deben seguir instrucciones legítimas del personal de seguridad, respetar aforos, señalización y zonas de acceso, pedir permiso antes de grabar de cerca y evitar conductas que expongan a otras personas o a sí mismos a riesgos.</p></section>
      <section><h2>9. Verificación y medidas</h2><p>La organización podrá pedir enlaces, capturas o una revisión en vivo de analíticas. Ante información falsa, fraude, compra de vistas, incumplimiento grave o vulneración de derechos, podrá excluir el contenido afectado, suspender la participación o retirar beneficios, explicando el motivo y permitiendo una solicitud de revisión.</p></section>
      <section><h2>10. Cambios y comunicaciones</h2><p>Los cambios materiales se comunicarán por los canales del programa y regirán hacia el futuro. No se reducirán retroactivamente beneficios ya obtenidos y verificados. Si una modificación afecta el consentimiento, se solicitará una nueva aceptación.</p></section>
      <section><h2>11. Consultas y reclamos</h2><p>Las consultas sobre participación se atenderán mediante el canal oficial que figure en la sección “Contacto para ejercer derechos”. Los reclamos sobre el Termómetro se tramitan según sus bases específicas.</p></section>`,
  },
  thermometer: {
    eyebrow: 'Documento 02',
    title: 'Bases del Termómetro',
    summary: 'Criterios verificables para sumar vistas, subir de nivel y recibir los beneficios anunciados en la Comunidad de Voceros.',
    body: `
      <section><h2>1. Organizador y ámbito</h2><p>${controller.name} organiza el Termómetro como una dinámica de reconocimiento por desempeño para participantes registrados en la Comunidad de Voceros de Finados Mushuc Runa 2026. No es un sorteo ni una promoción basada en azar.</p></section>
      <section><h2>2. Vigencia</h2><p>Suman los videos elegibles publicados entre el 1 de septiembre y el 30 de octubre de 2026. Los niveles ordinarios cierran el 30 de octubre de 2026 a las 12:00, hora de Ecuador. La medición de premios económicos cierra el 8 de noviembre de 2026. Los videos deben permanecer públicos al menos hasta el 15 de noviembre de 2026.</p></section>
      <section><h2>3. Plataforma y formato elegibles</h2><p>Solo suman videos verticales publicados en una cuenta pública de TikTok, relacionados directamente con la feria y acompañados por <strong>#vocerofinadosmushucruna</strong>. Historias, transmisiones en vivo, fotos y carruseles no suman.</p></section>
      <section><h2>4. Registro de contenido</h2><p>El participante deberá reportar cada enlace por el canal indicado por la coordinación y conservar una captura de sus analíticas. La fecha de recepción del reporte no reemplaza la fecha pública de publicación del video.</p></section>
      <section><h2>5. Vistas válidas</h2><p>Se contabilizan las vistas orgánicas mostradas por la analítica de TikTok y verificables por la coordinación. No suman vistas obtenidas mediante pauta, promoción pagada, bots, compra o intercambio de vistas, automatizaciones, granjas de interacción ni cualquier manipulación artificial.</p></section>
      <section><h2>6. Niveles acumulativos</h2><ol><li><strong>Eres vocero:</strong> registro aprobado y primer video elegible.</li><li><strong>Gorra:</strong> 4.000 vistas válidas acumuladas.</li><li><strong>Kit completo:</strong> 15.000 vistas válidas acumuladas.</li><li><strong>Trae a los tuyos:</strong> 80.000 vistas válidas acumuladas.</li><li><strong>Noche de concierto:</strong> 300.000 vistas válidas acumuladas.</li><li><strong>Tope:</strong> 1.000.000 de vistas válidas acumuladas.</li></ol><p>Cada nivel conserva los beneficios de los niveles anteriores, sujeto a disponibilidad y condiciones comunicadas en estas bases.</p></section>
      <section><h2>7. Beneficios</h2><p>Los beneficios son los publicados en la página del programa. El pase general no incluye por sí solo acceso al megaescenario. El boleto del nivel Noche de concierto está sujeto a disponibilidad de la noche y localidad comunicadas. La invitación vinculada al nivel Tope depende de la autorización del artista y su producción.</p></section>
      <section><h2>8. Premios económicos</h2><p>El monto, número de ganadores, mecanismo de ordenamiento, impuestos aplicables y forma de entrega deberán anunciarse a más tardar el 16 de octubre de 2026. Si estos elementos no se publican, el componente económico no podrá adjudicarse.</p></section>
      <section><h2>9. Corte, empate y revisión</h2><p>La clasificación se determina por vistas válidas acumuladas al cierre. En caso de empate se prioriza, en este orden: mayor retención promedio verificable, mayor número de videos elegibles y publicación elegible más antigua. El participante puede pedir revisión dentro de los tres días calendario siguientes a la comunicación del resultado.</p></section>
      <section><h2>10. Fraude y descalificación</h2><p>La organización documentará cualquier exclusión de vistas o descalificación. El participante será informado y podrá entregar evidencia dentro de tres días calendario. Una exclusión no se basará únicamente en una decisión automatizada.</p></section>
      <section><h2>11. Entrega</h2><p>La entrega requiere verificación de identidad y cumplimiento. Los beneficios físicos se coordinan en la oficina o Zona de Creadores, según la opción registrada. No son canjeables por dinero salvo que se haya anunciado expresamente como premio económico.</p></section>
      <section><h2>12. Casos de fuerza mayor</h2><p>Si una causa imprevisible hace imposible entregar un beneficio, la organización informará la situación y propondrá una alternativa equivalente cuando sea razonablemente posible, sin afectar beneficios ya verificados.</p></section>`,
  },
  privacy: {
    eyebrow: 'Documento 03',
    title: 'Política de Privacidad',
    summary: 'Información previa sobre el tratamiento de datos personales del registro de Voceros, conforme a la legislación ecuatoriana.',
    body: `
      <section><h2>1. Responsable y contacto</h2><p>El responsable de este tratamiento es <strong>${controller.name}</strong>, con domicilio en ${controller.address}, teléfono <a href="tel:+593980346729">${controller.phone}</a> y correo electrónico <a href="mailto:${controller.email}">${controller.email}</a>.</p></section>
      <section><h2>2. Datos tratados</h2><p>La fotografía para identificación y gafete es obligatoria para los registros nuevos. Se recopilan nombre, cédula, fecha de nacimiento, WhatsApp, correo, ciudad, perfiles sociales, red principal, participación anterior, fuente de conocimiento del programa y modalidad de retiro del kit. Para participantes de 16 o 17 años se recopilan además nombre, cédula, teléfono y correo de su representante. También se registran fecha, URL de origen, parámetros de campaña, dirección IP y navegador como evidencia de consentimiento y seguridad.</p></section>
      <section><h2>3. Origen</h2><p>Los datos se obtienen directamente del participante o, cuando corresponda, de su representante legal. La organización no solicita contraseñas de redes sociales.</p></section>
      <section><h2>4. Finalidades</h2><ul><li>Verificar identidad con la fotografía y, si corresponde, elaborar y entregar la credencial o gafete.</li><li>Gestionar inscripción, elegibilidad, comunicaciones y participación.</li><li>Verificar contenidos, vistas, niveles, beneficios y entregas.</li><li>Atender consultas, reclamos y solicitudes de derechos.</li><li>Prevenir fraude, abuso y envíos automatizados.</li><li>Conservar evidencia de los consentimientos otorgados.</li></ul><p>Los datos no se usarán para publicidad ajena al programa ni se venderán.</p></section>
      <section><h2>5. Base legitimadora</h2><p>El tratamiento se fundamenta en el consentimiento libre, específico, informado e inequívoco del titular. La participación y el uso de imagen se aceptan por separado. El consentimiento puede revocarse sin efectos retroactivos.</p></section>
      <section><h2>6. Base de datos y operaciones</h2><p>Los datos se registran en bases digitales para recepción, validación, consulta, organización, comunicación, respaldo, actualización y eliminación. No se adoptan decisiones con efectos jurídicos basadas únicamente en procesos automatizados.</p></section>
      <section><h2>7. Destinatarios y transferencias</h2><p>Accederán únicamente el equipo autorizado del programa y proveedores tecnológicos necesarios para alojar el sitio, enviar notificaciones y almacenar el registro. La fotografía permanece cifrada con acceso restringido al vocero titular y al equipo administrativo autorizado; no se envía a Google Sheets ni a exportaciones CSV. El resto del registro se sincroniza con Google Sheets; ello puede implicar tratamiento o almacenamiento internacional por Google conforme a sus medidas contractuales y de seguridad. No se comunicarán datos a terceros para finalidades propias sin una base legal.</p></section>
      <section><h2>8. Conservación</h2><p>Los registros y la fotografía se conservarán durante <strong>${controller.retention}</strong>. Actualmente no hay purga automática configurada. El responsable debe gestionar la eliminación o anonimización segura al cumplir el plazo, incluyendo base, fotografía, exportaciones y política de respaldos, salvo obligación legal o necesidad documentada para la formulación, ejercicio o defensa de reclamaciones.</p></section>
      <section><h2>9. Datos de adolescentes</h2><p>El programa admite personas de 16 y 17 años únicamente con autorización escrita de su representante legal. La información se presenta también al representante y se aplican medidas reforzadas de minimización, acceso restringido y seguridad.</p></section>
      <section><h2>10. Entrega o negativa</h2><p>Los campos obligatorios son necesarios para verificar identidad y administrar el programa. No entregarlos impide completar el registro. Los datos inexactos pueden impedir la validación o entrega de beneficios; el titular puede solicitar su rectificación.</p></section>
      <section><h2>11. Derechos</h2><p>El titular puede solicitar acceso, rectificación, actualización, eliminación, oposición, suspensión, limitación, portabilidad y revocación del consentimiento, además de no ser objeto de decisiones exclusivamente automatizadas. Estos derechos son gratuitos y no pueden renunciarse por anticipado.</p></section>
      <section><h2>12. Seguridad</h2><p>Se aplican controles de acceso, almacenamiento fuera del directorio público, limitación de intentos, registro de consentimientos, cifrado en tránsito y copias de respaldo. Ningún sistema elimina por completo el riesgo; cualquier incidente se gestionará conforme a la normativa aplicable.</p></section>
      <section><h2>13. Reclamos</h2><p>Las solicitudes se presentan por el canal publicado en “Contacto para ejercer derechos”. Si la respuesta no satisface al titular, puede acudir a la Superintendencia de Protección de Datos Personales del Ecuador.</p></section>
      <section><h2>14. Cambios</h2><p>Los cambios se versionarán y publicarán con su fecha. Si una modificación introduce nuevas finalidades o altera de forma material el tratamiento basado en consentimiento, se solicitará una nueva autorización.</p></section>`,
  },
  image: {
    eyebrow: 'Documento 04',
    title: 'Autorización de uso de imagen y contenido',
    summary: 'Alcance separado y revocable para el uso de imagen, voz y publicaciones creadas dentro del programa.',
    body: `
      <section><h2>1. Titular</h2><p>La autorización la concede la persona registrada. Si tiene 16 o 17 años, también debe firmarla su representante legal antes de cualquier reutilización por la organización.</p></section>
      <section><h2>2. Material autorizado</h2><p>La carga de la fotografía para identidad y gafete tiene un uso operativo separado y no autoriza por sí sola su publicación. La difusión requiere esta autorización independiente y, para menores, la autorización escrita de su representante. Comprende la imagen y voz del participante, su nombre público, fotografías o videos en los que aparezca y el contenido que identifique voluntariamente como parte del programa de Voceros.</p></section>
      <section><h2>3. Finalidad</h2><p>${controller.name} podrá comunicar, reconocer y documentar la participación en Finados Mushuc Runa 2026; republicar contenidos elegibles; preparar memorias informativas del evento; y difundir el programa en sus canales oficiales.</p></section>
      <section><h2>4. Medios y territorio</h2><p>La autorización cubre sitio web, redes sociales oficiales, piezas digitales, prensa, pantallas y materiales impresos vinculados a la feria, con alcance nacional e internacional por la naturaleza de Internet.</p></section>
      <section><h2>5. Licencia</h2><p>La licencia es no exclusiva, gratuita y limitada a las finalidades descritas. El contenido sigue perteneciendo a su autor. La organización no puede venderlo de forma separada ni cederlo para campañas ajenas sin una nueva autorización.</p></section>
      <section><h2>6. Edición e integridad</h2><p>Se permiten ajustes técnicos de formato, duración, subtítulos, encuadre, color y composición que no alteren el sentido del mensaje ni afecten honor, reputación o dignidad. Se procurará acreditar al creador cuando el formato lo permita.</p></section>
      <section><h2>7. Material de terceros</h2><p>El participante declara que cuenta con derechos o permisos sobre lo que entrega. No deberá incorporar música, imágenes, marcas o personas identificables sin autorización. La organización puede abstenerse de publicar material que genere dudas razonables sobre derechos.</p></section>
      <section><h2>8. Revocación</h2><p>El titular puede revocar la autorización mediante el canal de derechos. La revocación no afecta usos lícitos anteriores; la organización retirará el material de canales digitales bajo su control dentro de un plazo razonable y cesará nuevos usos, salvo deber legal o defensa de reclamaciones.</p></section>
      <section><h2>9. Contenido ya distribuido</h2><p>La organización no puede garantizar el retiro de copias realizadas por terceros, publicaciones compartidas fuera de sus canales o materiales impresos ya distribuidos antes de recibir la revocación.</p></section>
      <section><h2>10. Ausencia de obligación</h2><p>Autorizar no obliga a la organización a publicar el material ni garantiza selección, alcance, premio o contratación.</p></section>
      <section><h2>11. Evidencia</h2><p>La aceptación se registra con versión, fecha, hora, URL de origen, dirección IP, navegador e identificador de registro, exclusivamente para demostrar el consentimiento y atender derechos o controversias.</p></section>`,
  },
  rights: {
    eyebrow: 'Documento 05',
    title: 'Contacto para ejercer derechos',
    summary: 'Procedimiento gratuito para consultar, corregir, limitar o eliminar datos y revocar consentimientos.',
    body: `
      <section><h2>1. Derechos disponibles</h2><p>Puedes solicitar acceso, rectificación, actualización, eliminación, oposición, suspensión, limitación, portabilidad y revocación del consentimiento, además de información sobre el tratamiento y una explicación de cualquier decisión automatizada.</p></section>
      <section><h2>2. Canal oficial</h2><p>Presenta tu solicitud ante <strong>${controller.name}</strong> mediante el correo <a href="mailto:${controller.email}">${controller.email}</a>. También puedes comunicarte al <a href="tel:+593980346729">${controller.phone}</a> o dirigirte a ${controller.address}. No envíes documentos de identidad por canales distintos a estos contactos oficiales.</p></section>
      <section><h2>3. Contenido de la solicitud</h2><ul><li>Nombres completos del titular.</li><li>Derecho que desea ejercer y explicación concreta.</li><li>Correo o teléfono para recibir la respuesta.</li><li>Información razonable que permita localizar el registro.</li></ul><p>Se solicitará prueba de identidad solo cuando sea necesaria y por un medio seguro. Si actúa un representante, deberá acreditar su representación.</p></section>
      <section><h2>4. Atención y plazo</h2><p>La solicitud es gratuita. El responsable confirmará la recepción y la atenderá dentro de los plazos de la Ley Orgánica de Protección de Datos Personales; los derechos de acceso, rectificación, actualización, eliminación y oposición se tramitan, con carácter general, dentro de quince días.</p></section>
      <section><h2>5. Revocación de imagen</h2><p>Para retirar una autorización de imagen o voz, identifica el contenido y el canal donde aparece. La organización cesará nuevos usos y gestionará el retiro de los canales digitales bajo su control, sin efectos retroactivos.</p></section>
      <section><h2>6. Respuesta y negativa</h2><p>Si una solicitud no puede atenderse total o parcialmente por una excepción legal, la respuesta explicará el motivo y los medios disponibles para reclamar. La identidad del solicitante se verificará sin recopilar datos excesivos.</p></section>
      <section><h2>7. Autoridad de control</h2><p>Si consideras que tu solicitud no fue atendida adecuadamente, puedes presentar un reclamo ante la <a href="https://spdp.gob.ec/" target="_blank" rel="noopener noreferrer">Superintendencia de Protección de Datos Personales <span aria-hidden="true">↗</span></a>.</p></section>`,
  },
});

export function renderVocerosLegalPage(page) {
  const document = documents[page.documentKey];
  if (!document) throw new Error(`Documento de Voceros no reconocido: ${page.documentKey}`);
  const version = legalVersions[page.documentKey];
  const consentKey = page.documentKey === 'privacy' ? 'data' : page.documentKey === 'image' ? 'image' : null;
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
  <link rel="stylesheet" href="/assets/styles.css?v=20260916-3">
  <link rel="stylesheet" href="/assets/finados/finados.css?v=${campaignRuntimeVersion}">
  <link rel="stylesheet" href="/assets/finados/voceros.css?v=${campaignRuntimeVersion}">
  <script type="module" src="/assets/finados/finados.js?v=${campaignRuntimeVersion}"></script>
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
        <a class="voceros-legal__back" href="/finados/voceros/#documentos-legales">← Volver a Voceros</a>
        <p>${escapeHtml(document.eyebrow)} · Comunidad de Voceros</p>
        <h1>${escapeHtml(document.title)}</h1>
        <span>${escapeHtml(document.summary)}</span>
        <small>Versión vigente · <time datetime="${version}">${version.slice(-2)} de septiembre de 2026</time></small>
      </div>
    </header>
    <div class="voceros-legal__layout voceros-shell">
      <article class="voceros-legal__content">
        ${document.body}
        ${consentKey ? `<section><h2>Texto de consentimiento del formulario</h2><p data-consent-text="${consentKey}">${escapeHtml(consents[consentKey].text)}</p></section>` : ''}
      </article>
      ${officialSources}
    </div>
  </main>
  ${renderFinadosFooter()}
</body>
</html>`;
}
