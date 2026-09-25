import { escapeHtml as esc } from '../render/html.mjs';
import { STATUSES, PREVIOUS_PARTICIPATION } from './admin.js';
import { MEDIA_STATUSES, MEDIA_TYPE_LABELS, ORIGIN_LABELS } from './admin-medios.js';
import { EMPRENDEDOR_LEVELS, EMPRENDEDOR_STATUSES } from './admin-emprendedores.js';
import { ecuadorProvinces } from '../media-accreditation/page.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';

const options = values => values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
const select = (name, label, values) => `<label>${label}<select name="${name}"><option value="">Todos</option>${options(values)}</select></label>`;
const ADMIN_FORMS = Object.freeze([
  { route: '/admin/noticias/', label: 'Noticias', description: 'Tema central de la campaña', marker: 'N' },
  { route: '/admin/panel/', label: 'Panel', description: 'Resumen de todo', marker: 'P' },
  { route: '/admin/voceros/', label: 'Voceros', description: 'Registros y seguimiento', marker: 'V' },
  { route: '/admin/medios/', label: 'Medios', description: 'Acreditación de medios', marker: 'M', children: [{ route: '/admin/medios/eventos/', label: 'Eventos', description: 'Cobertura por evento' }] },
  { route: '/admin/emprendedores/', label: 'Emprendedores', description: 'De emprendedor a influencer', marker: 'E' },
  { route: '/admin/creadoras/', label: 'Creadoras', description: 'Contenido y calendario', marker: 'C' },
  { route: '/admin/mfs/', label: 'Mushuc Freestyle', description: 'Inscripciones y audiciones', marker: 'F' },
]);
// Public landing that each panel returns to from its header.
const PANEL_LANDINGS = Object.freeze({ '/admin/noticias/': ['/finados/', 'Volver a Finados'], '/admin/panel/': ['/finados/', 'Volver a Finados'], '/admin/voceros/': ['/finados/voceros/', 'Volver a Voceros'], '/admin/medios/': ['/finados/medios/', 'Volver a Medios'], '/admin/medios/eventos/': ['/finados/medios/', 'Volver a Medios'], '/admin/emprendedores/': ['/finados/emprendedores/', 'Volver a Emprendedores'], '/admin/creadoras/': ['/finados/creadoras/', 'Volver a Creadoras'], '/admin/mfs/': ['/finados/mfs/', 'Volver a Mushuc Freestyle'] });
const PROGRESS_LEVELS = ['En preparación', 'Primer paso', 'Gorra', 'Kit completo', 'Trae a los tuyos', 'Noche de concierto', 'Tope'];
const VIDEO_SLOTS = Object.freeze([1, 2, 3, 4, 5]);
const videoSlotControls = (prefix = 'video') => VIDEO_SLOTS.map(slot => `<label class="admin-video-control"><span class="admin-video-check"><input type="checkbox" name="${prefix}_${slot}_enabled" value="1"><strong>Video ${slot}</strong></span><span class="admin-video-date"><span>Habilitado desde</span><input type="date" name="${prefix}_${slot}_enabled_at" aria-label="Fecha de habilitación del video ${slot}"></span></label>`).join('');

function adminSidebar(page) {
  const currentForm = ADMIN_FORMS.find(item => item.route === page.route || (item.children ?? []).some(child => child.route === page.route));
  // «Panel» es la portada de la administración: va sola, arriba de la lista de formularios.
  const home = ADMIN_FORMS.find(item => item.route === '/admin/panel/');
  const homeLink = home ? `<a class="admin-nav-link" href="${esc(home.route)}"${home.route === page.route ? ' aria-current="page"' : ''} data-nav-home><span class="admin-nav-marker" aria-hidden="true">${esc(home.marker)}</span><span><strong>${esc(home.label)}</strong><small>${esc(home.description)}</small></span></a>` : '';
  const links = ADMIN_FORMS.filter(item => item !== home).map((item) => {
    const current = item.route === page.route ? ' aria-current="page"' : '';
    // A submenu (e.g. Medios → Eventos) stays inside its section and opens on the first click.
    const children = item.children ?? [];
    const panel = `admin-nav-${esc(item.route.replace(/\/+$/, '').split('/').pop())}`;
    const body = `<span class="admin-nav-marker" aria-hidden="true">${esc(item.marker)}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></span>${children.length ? '<span class="admin-nav-chevron" aria-hidden="true">⌄</span>' : ''}`;
    const link = `<a class="admin-nav-link" href="${esc(item.route)}"${current}${children.length ? ` data-nav-parent aria-expanded="true" aria-controls="${panel}"` : ''}>${body}</a>`;
    if (!children.length) return link;
    const options = children.map(child => `<a class="admin-nav-link admin-nav-link--child" href="${esc(child.route)}"${child.route === page.route ? ' aria-current="page"' : ''}><span class="admin-nav-marker" aria-hidden="true">›</span><span><strong>${esc(child.label)}</strong><small>${esc(child.description)}</small></span></a>`).join('');
    return `<div class="admin-nav-group" data-nav-group>${link}<div class="admin-nav-children" id="${panel}" data-nav-children>${options}</div></div>`;
  }).join('');

  return `<aside class="admin-sidebar" aria-label="Navegación administrativa">
<details class="admin-sidebar__navigation" data-admin-navigation open>
<summary><span>Menú administrativo</span><span class="admin-sidebar__current">${esc(currentForm?.label ?? 'Formularios')}</span><span class="admin-sidebar__chevron" aria-hidden="true">⌄</span></summary>
<div class="admin-sidebar__content">
<div class="admin-sidebar__intro"><p class="eyebrow">Panel de gestión</p><p>Administración</p></div>
${homeLink ? `<nav class="admin-sidebar__home" aria-label="Resumen general">${homeLink}</nav>` : ''}
<nav aria-labelledby="admin-forms-title"><p id="admin-forms-title" class="admin-nav-title">Panel y formularios</p>${links}</nav>
<p class="admin-sidebar__future">Los próximos formularios aparecerán aquí cuando estén habilitados.</p>
<div class="admin-sidebar__account"><p><span>Sesión activa</span><strong data-admin-sidebar-user>Comprobando…</strong></p><button type="button" class="button-quiet" data-admin-logout disabled>Cerrar sesión</button></div>
</div>
</details>
</aside>`;
}

/** La banda del tema central: el mismo bloque arriba de cada panel. */
const campaignBanner = '<section class="campaign-banner" data-campaign-banner hidden aria-label="Tema central de la campaña"></section>';

function layout(page, content, script = '/assets/admin/admin.js?v=20260923-admin-sidebar-1') {
  const api = page.adminEnvironment === 'development' ? (page.adminApiBase ?? LOCAL_API_BASE) : PRIMARY_API_BASE;
  const connectSources = apiBasesForCsp(api);
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} | Complejo Mushuc Runa</title>
<meta name="description" content="Acceso administrativo a los registros de Finados Mushuc Runa.">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${connectSources}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="admin-api-base" content="${api}">
<link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="stylesheet" href="/assets/admin/admin.css?v=20260924-17">
<script type="module" src="${script}"></script>
</head><body class="admin-page">
<a class="skip-link" href="#contenido">Ir al contenido</a>
<header class="admin-header"><a href="${(PANEL_LANDINGS[page.route] ?? PANEL_LANDINGS['/admin/voceros/'])[0]}" aria-label="${(PANEL_LANDINGS[page.route] ?? PANEL_LANDINGS['/admin/voceros/'])[1]}"><img src="/assets/finados/logo-finados.svg" width="132" height="60" alt="Finados Mushuc Runa"></a><span class="header-context">Administración${Object.hasOwn(PANEL_LANDINGS, page.route) ? ' <span aria-hidden="true">/</span> Formularios' : ''}</span></header>
${content}
<noscript><p class="notice">Activa JavaScript para iniciar sesión y administrar los registros.</p></noscript>
</body></html>`;
}

export function renderAdminLoginPage(page) {
  return layout(page, `<main id="contenido" class="login-workspace">
<div class="login-intro"><p class="eyebrow">Finados 2026</p><h1>Iniciar sesión</h1><p>Acceso del equipo de Voceros.</p></div>
<form data-admin-login class="login-form">
<fieldset disabled data-login-fields>
<label for="username">Usuario</label><input id="username" name="username" autocomplete="username" maxlength="100" required autocapitalize="none" spellcheck="false">
<label for="password">Contraseña</label><div class="password-field"><input id="password" type="password" name="password" autocomplete="current-password" maxlength="1024" required><button type="button" class="button-quiet" data-toggle-password aria-controls="password" aria-pressed="false">Mostrar</button></div>
<button class="button-primary login-submit" type="submit">Iniciar sesión</button>
</fieldset>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true">Comprobando acceso…</p>
<button type="button" class="button-quiet" data-session-retry hidden>Reintentar conexión</button>
</form>
<details class="access-help"><summary>¿Necesitas restablecer tu acceso?</summary><p>Solicita al responsable técnico restablecer la contraseña mediante SSH. No compartas tu contraseña por mensajes.</p></details>
<a class="return-link" href="/finados/voceros/">← Volver a Voceros</a>
</main>`);
}

export function renderAdminVocerosPage(page) {
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-voceros>${campaignBanner}
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026</p><h1>Registros de Voceros</h1><p data-admin-user>Comprobando acceso…</p></div><button type="button" class="button-primary" data-admin-export disabled>Exportar CSV</button></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true"></p>
<button type="button" class="button-quiet" data-session-retry hidden>Reintentar conexión</button>
<section aria-label="Resumen de todos los registros" class="summary" data-admin-dashboard aria-busy="true"></section>
<details class="activity"><summary>Actividad y estados de todos los registros</summary><div class="activity-columns"><div><h2>Por estado</h2><dl data-status-counts></dl></div><div><h2>Registros por fecha (UTC)</h2><dl data-date-counts></dl></div></div></details>
<section class="admin-global-videos" aria-labelledby="global-videos-title"><div class="records-heading"><div><h2 id="global-videos-title">Habilitación global de videos</h2><p>Estas fechas aplican para todos los voceros. Cuando llegue la fecha, podrán pegar el enlace del video habilitado.</p></div><p data-global-video-summary>—</p></div><form data-global-video-form><fieldset disabled><div class="admin-video-list">${videoSlotControls('schedule_video')}</div><button class="button-primary" type="submit">Guardar fechas globales</button></fieldset></form><p class="feedback" data-global-video-feedback role="status" aria-live="polite">Cargando fechas…</p></section>
<section class="followers-leaderboard video-views-leaderboard" aria-labelledby="video-views-leaderboard-title"><div class="records-heading"><div><h2 id="video-views-leaderboard-title">Top 20 por visualizaciones de videos</h2><p>Ranking rápido de los videos con más views validadas por coordinación.</p></div><p data-video-views-leaderboard-count>—</p></div><ol data-video-views-leaderboard aria-live="polite"></ol></section>
<section class="followers-leaderboard" aria-labelledby="followers-leaderboard-title"><div class="records-heading"><div><h2 id="followers-leaderboard-title">Top 20 por seguidores</h2><p>Ranking rápido basado en la cantidad de seguidores validados por coordinación.</p></div><p data-followers-leaderboard-count>—</p></div><ol data-followers-leaderboard aria-live="polite"></ol></section>
<form class="filters" data-admin-filters><fieldset disabled data-panel-fields>
<legend>Filtrar registros</legend>
<div class="filter-grid"><label class="search-field">Buscar<input type="search" name="search" maxlength="180" placeholder="Nombre, cédula, teléfono o correo"></label>
${select('status', 'Estado', STATUSES)}<label>Ciudad exacta<input name="city" maxlength="100" placeholder="Todas las ciudades"></label>
${select('main_network', 'Red principal', ['TikTok', 'Instagram', 'Facebook'])}
${select('previous_participation', 'Participación anterior', PREVIOUS_PARTICIPATION)}
<label>Desde (UTC)<input type="date" name="date_from"></label><label>Hasta (UTC)<input type="date" name="date_to"></label></div>
<div class="filter-actions"><button type="submit" class="button-primary">Aplicar filtros</button><button type="reset" class="button-quiet">Limpiar</button><label>Por página<select name="pageSize"><option>25</option><option>50</option><option>100</option></select></label></div>
</fieldset></form>
<section class="records" aria-labelledby="records-title" aria-busy="true" data-records-region><div class="records-heading"><h2 id="records-title" tabindex="-1">Registros</h2><p data-record-count>—</p></div>
<p data-list-message role="status">Cargando registros…</p>
<table><caption class="sr-only">Voceros registrados. Abre un registro para revisar sus datos y notas.</caption><thead><tr><th scope="col">Vocero</th><th scope="col">Contacto</th><th scope="col">Ciudad / red</th><th scope="col">Registro</th><th scope="col">Videos</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-records></tbody></table>
<nav class="pagination" aria-label="Paginación de registros"><button class="button-quiet" data-previous disabled>← Anterior</button><span data-page-label>Página —</span><button class="button-quiet" data-next disabled>Siguiente →</button></nav></section>
<details class="pending-accounts" data-pending-panel><summary><span><strong id="pending-accounts-title">Cuentas pendientes de ficha</strong><small>Última sección. Ábrela solo cuando necesites revisar cuentas creadas sin formulario.</small></span><span data-pending-count>—</span></summary><div class="pending-accounts-body" aria-labelledby="pending-accounts-title"><p class="feedback" data-pending-message role="status" aria-live="polite">Cargando cuentas…</p><div class="pending-accounts-table"><table><caption class="sr-only">Cuentas creadas que todavía no completan su ficha</caption><thead><tr><th scope="col">Correo</th><th scope="col">Creada</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-pending-accounts></tbody></table></div></div></details>
<dialog class="detail-dialog" aria-labelledby="detail-title" data-detail><div class="detail-heading"><h2 id="detail-title" tabindex="-1">Detalle del vocero</h2><button type="button" class="button-quiet" data-detail-close aria-label="Cerrar detalle">Cerrar ×</button></div>
<p class="feedback" data-detail-feedback role="status" aria-live="polite" aria-atomic="true"></p><div data-detail-content></div>
<div class="detail-danger-zone"><p>¿Este registro ya no debe tener acceso?</p><button type="button" class="button-danger" data-admin-delete disabled>Eliminar registro</button></div>
<section class="admin-photo" data-admin-photo aria-label="Fotografía privada"><h3>Fotografía para identificación y gafete</h3><p data-admin-photo-message role="status">Sin fotografía histórica</p><img data-admin-photo-image alt="Fotografía privada del vocero" hidden><a class="button-quiet" data-admin-photo-download hidden>Descargar fotografía</a></section>
<section class="admin-reset"><h3>Recuperar acceso</h3><button type="button" class="button-quiet" data-admin-reset disabled>Generar enlace temporal</button><div data-reset-output hidden><label>Enlace temporal<input type="text" readonly data-reset-url autocomplete="off" spellcheck="false"></label><button type="button" class="button-quiet" data-reset-copy>Copiar enlace</button></div><p class="feedback" data-reset-feedback role="status" aria-live="polite"></p></section>
<form data-status-form><fieldset disabled><label>Estado del registro<select name="status" required>${options(STATUSES)}</select></label><button class="button-primary" type="submit">Guardar estado</button></fieldset></form>
<section class="admin-progress" aria-labelledby="admin-progress-title"><div class="admin-progress-heading"><div><h3 id="admin-progress-title">Progreso del vocero</h3><p>Registra la métrica validada, semáforo, retiro de kit y views validadas de cada video. Las fechas se configuran una sola vez en la sección global.</p></div><span data-admin-progress-summary>Sin actualizar</span></div><form data-progress-form><fieldset disabled><div class="admin-progress-grid"><label>Seguidores validados<input type="number" name="followers_count" min="0" max="1000000000" step="1" required></label><label>Nivel<select name="level" required>${PROGRESS_LEVELS.map((label, index) => `<option value="${index}">${index} · ${esc(label)}</option>`).join('')}</select></label><label>Semáforo<select name="traffic_light" required><option value="red">Rojo · En preparación</option><option value="yellow">Amarillo · En avance</option><option value="green">Verde · Listo</option></select></label><label>Kit<select name="kit_status" required><option value="pendiente">Pendiente de retiro</option><option value="retirado">Retirado</option></select></label></div><div class="admin-videos" data-admin-videos></div><button class="button-primary" type="submit">Guardar progreso</button></fieldset></form><p class="feedback" data-progress-feedback role="status" aria-live="polite"></p></section>
<section class="notes-section"><h3>Notas internas</h3><ol data-notes></ol><form data-note-form><fieldset disabled><label>Añadir nota<textarea name="body" rows="3" maxlength="2000" required></textarea></label><button class="button-primary" type="submit">Guardar nota</button></fieldset></form></section>
</dialog></main></div>`);
}

export function renderAdminMediosPage(page) {
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-medios>${campaignBanner}
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026</p><h1>Registros de Medios</h1><p data-admin-user>Comprobando acceso…</p></div><div class="workspace-actions"><button type="button" class="button-primary" data-admin-add disabled>Agregar medio</button><button type="button" class="button-quiet" data-admin-export disabled>Exportar CSV</button></div></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true"></p>
<button type="button" class="button-quiet" data-session-retry hidden>Reintentar conexión</button>
<section aria-label="Resumen de todos los registros de medios" class="summary" data-admin-dashboard aria-busy="true"></section>
<section class="followers-leaderboard video-views-leaderboard" aria-labelledby="media-views-leaderboard-title"><div class="records-heading"><div><h2 id="media-views-leaderboard-title">Top 20 por visualizaciones</h2><p>Medios con más views validadas, sumando todos los videos que reportaron. Las views se registran en el detalle de cada medio, al lado de cada video.</p></div><p data-media-views-leaderboard-count>—</p></div><ol data-media-views-leaderboard aria-live="polite"></ol></section>
<section class="followers-leaderboard" aria-labelledby="media-followers-leaderboard-title"><div class="records-heading"><div><h2 id="media-followers-leaderboard-title">Top 20 por seguidores</h2><p>Suma de los seguidores que cada medio declaró en todos sus canales. Es un dato del propio medio, no validado.</p></div><p data-media-followers-leaderboard-count>—</p></div><ol data-media-followers-leaderboard aria-live="polite"></ol></section>
<details class="pending-accounts" data-claims-panel><summary><span><strong id="claims-title">Solicitudes de vinculación</strong><small>Medios que crearon su cuenta y piden quedarse con una ficha cargada por coordinación. Revisa y aprueba desde el detalle.</small></span><span data-claims-count>—</span></summary><div class="pending-accounts-body" aria-labelledby="claims-title"><p class="feedback" data-claims-message role="status" aria-live="polite">Cargando solicitudes…</p><div class="pending-accounts-table"><table><caption class="sr-only">Solicitudes de vinculación pendientes</caption><thead><tr><th scope="col">Medio</th><th scope="col">Ciudad</th><th scope="col">Cuenta</th><th scope="col">Solicitado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-claims-rows></tbody></table></div></div></details>
<details class="pending-accounts" data-pending-panel><summary><span><strong id="pending-accounts-title">Cuentas pendientes de registro</strong><small>Medios que ya crearon su cuenta pero aún no guardan su registro. Aparecerán en la tabla cuando lo guarden.</small></span><span data-pending-count>—</span></summary><div class="pending-accounts-body" aria-labelledby="pending-accounts-title"><p class="feedback" data-pending-message role="status" aria-live="polite">Cargando cuentas…</p><div class="pending-accounts-table"><table><caption class="sr-only">Cuentas de medios que todavía no completan su registro</caption><thead><tr><th scope="col">Correo</th><th scope="col">Creada</th><th scope="col">Último acceso</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-pending-accounts></tbody></table></div></div></details>
<form class="filters" data-admin-filters><fieldset disabled data-panel-fields>
<legend>Filtrar registros</legend>
<div class="filter-grid"><label class="search-field">Buscar<input type="search" name="search" maxlength="100" placeholder="Medio, frecuencia o ciudad"></label>
${select('status', 'Estado', MEDIA_STATUSES)}
<label>Tipo de medio<select name="media_type"><option value="">Todos</option>${Object.entries(MEDIA_TYPE_LABELS).map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join('')}</select></label>
<label>Medio pautado<select name="paid_media"><option value="">Todos</option><option value="yes">Sí · Pautado</option><option value="no">No · Sin pauta</option></select></label>
<label>Origen<select name="origin"><option value="">Todos</option>${Object.entries(ORIGIN_LABELS).map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join('')}</select></label>
${select('province', 'Provincia', ecuadorProvinces)}</div>
<div class="filter-actions"><button type="submit" class="button-primary">Aplicar filtros</button><button type="reset" class="button-quiet">Limpiar</button><label>Por página<select name="pageSize"><option>25</option><option>50</option><option>100</option></select></label></div>
</fieldset></form>
<section class="records" aria-labelledby="records-title" aria-busy="true" data-records-region><div class="records-heading"><h2 id="records-title" tabindex="-1">Registros</h2><p data-record-count>—</p></div>
<p data-list-message role="status">Cargando registros…</p>
<table><caption class="sr-only">Medios registrados. Abre un registro para revisar sus datos, videos y notas.</caption><thead><tr><th scope="col">Medio</th><th scope="col">Frecuencia</th><th scope="col">Ubicación</th><th scope="col">Canales</th><th scope="col">Videos</th><th scope="col">Eventos</th><th scope="col">Registro</th><th scope="col">Estado y semáforo</th><th scope="col">Pauta</th><th scope="col">Origen</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-records></tbody></table>
<nav class="pagination" aria-label="Paginación de registros"><button class="button-quiet" data-previous disabled>← Anterior</button><span data-page-label>Página —</span><button class="button-quiet" data-next disabled>Siguiente →</button></nav></section>
<dialog class="detail-dialog" aria-labelledby="detail-title" data-detail><div class="detail-heading"><h2 id="detail-title" tabindex="-1">Detalle del medio</h2><button type="button" class="button-quiet" data-detail-close aria-label="Cerrar detalle">Cerrar ×</button></div>
<p class="feedback" data-detail-feedback role="status" aria-live="polite" aria-atomic="true"></p><div data-detail-content></div>
<form data-status-form><fieldset disabled><label>Estado del registro<select name="status" required>${options(MEDIA_STATUSES)}</select></label><label>Semáforo<select name="traffic_light" required><option value="red">Rojo · En preparación</option><option value="yellow">Amarillo · En avance</option><option value="green">Verde · Listo</option></select></label><label>Medio pautado<select name="paid_media" required><option value="no">No · Sin pauta</option><option value="yes">Sí · Pautado</option></select></label><button class="button-primary" type="submit">Guardar estado, semáforo y pauta</button></fieldset></form>
<section class="admin-reset"><h3>Recuperar acceso</h3><button type="button" class="button-quiet" data-admin-reset disabled>Generar enlace temporal</button><div data-reset-output hidden><label>Enlace temporal<input type="text" readonly data-reset-url autocomplete="off" spellcheck="false"></label><button type="button" class="button-quiet" data-reset-copy>Copiar enlace</button></div><p class="feedback" data-reset-feedback role="status" aria-live="polite"></p></section>
<section class="notes-section"><h3>Notas internas</h3><ol data-notes></ol><form data-note-form><fieldset disabled><label>Añadir nota<textarea name="body" rows="3" maxlength="2000" required></textarea></label><button class="button-primary" type="submit">Guardar nota</button></fieldset></form></section>
<div class="detail-danger-zone"><p>¿Este registro ya no debe tener acceso?</p><button type="button" class="button-danger" data-admin-delete disabled>Retirar registro</button></div>
</dialog>${mediaRecordDialog()}</main></div>`, ADMIN_MEDIOS_SCRIPT);
}

const ADMIN_CREADORAS_SCRIPT = '/assets/admin/admin-creadoras.js?v=20260924-creadoras-9';
const ADMIN_MEDIOS_SCRIPT = '/assets/admin/admin-medios.js?v=20260924-admin-medios-21';
const RADIO_GENRE_OPTIONS = ['Noticias e información', 'Musical variada', 'Popular y tropical', 'Folclórica y andina', 'Juvenil y pop', 'Romántica', 'Religiosa', 'Deportiva', 'Comunitaria', 'Otro'];
const PROVINCE_OPTIONS = ['Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'];

/** Shared dialog: coordination creates or completes a medium without needing the medium's account. */
function mediaRecordDialog() {
  return `<dialog class="detail-dialog record-dialog" aria-labelledby="record-title" data-record-dialog><div class="detail-heading"><h2 id="record-title" tabindex="-1" data-record-title>Agregar medio</h2><button type="button" class="button-quiet" data-record-close aria-label="Cerrar">Cerrar ×</button></div>
<p class="feedback" data-record-feedback role="status" aria-live="polite"></p>
<form data-record-form novalidate><fieldset><div class="record-grid">
<label class="record-grid__wide">Nombre del medio *<input name="media_name" maxlength="140" required></label>
<fieldset class="record-grid__wide record-types"><legend>Tipo de medio *</legend>${Object.entries(MEDIA_TYPE_LABELS).map(([key, label]) => `<label><input type="checkbox" name="media_types" value="${esc(key)}"> ${esc(label)}</label>`).join('')}</fieldset>
<label>Frecuencias de radio<textarea name="frequency" rows="2" placeholder="Una por línea. Ej.: 102.5 FM"></textarea></label>
<label>Canales de televisión<textarea name="tv_channel" rows="2" placeholder="Uno por línea. Ej.: Canal 38"></textarea></label>
<label>Oyentes (dato del medio)<input name="audience_count" inputmode="numeric" pattern="[0-9]*" maxlength="9" placeholder="Ej.: 25000"></label>
<label>Género de la radio<select name="radio_genre"><option value="">Sin dato</option>${RADIO_GENRE_OPTIONS.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>
<label>Provincia<select name="province"><option value="">Sin dato</option>${PROVINCE_OPTIONS.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>
<label>Ciudad<input name="city" maxlength="100"></label>
<label class="record-grid__wide">Programa<input name="program_name" maxlength="160" placeholder="Ej.: Noticiero Controversia"></label>
<label class="record-grid__wide">Representantes<textarea name="representatives" rows="3" placeholder="Una persona por línea: Nombre - Cargo"></textarea></label>
<label class="record-grid__wide">Redes y páginas<textarea name="channels" rows="3" placeholder="Un enlace por línea (Facebook, TikTok, Instagram, YouTube, X o web)"></textarea></label>
<label>Seguidores validados por coordinación<input name="followers_validated" inputmode="numeric" pattern="[0-9]*" maxlength="10" placeholder="Ej.: 284000"></label>
<label>Medio pautado<select name="paid_media"><option value="no">No · Sin pauta</option><option value="yes">Sí · Pautado</option></select></label>
<label>Persona de contacto<input name="contact_name" maxlength="160"></label>
<label>Teléfono<input name="phone" maxlength="25" inputmode="tel"></label>
<label class="record-grid__wide">Correo de contacto<input name="contact_email" type="email" maxlength="180"></label>
</div><button class="button-primary" type="submit">Guardar medio</button></fieldset></form></dialog>`;
}

export function renderAdminMediosEventosPage(page) {
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-medios-eventos>${campaignBanner}
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026 · Medios</p><h1>Cobertura por evento</h1><p data-admin-user>Comprobando acceso…</p></div></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true"></p>
<button type="button" class="button-quiet" data-session-retry hidden>Reintentar conexión</button>
<section class="admin-events-bar" aria-label="Evento"><label>Evento<select data-event-select disabled><option>Cargando…</option></select></label>
<form data-event-form class="admin-event-form"><fieldset disabled><label>Nuevo evento<input name="name" maxlength="160" placeholder="Ej.: Lanzamiento Finados 2026" required></label><label>Fecha<input name="event_date" type="date"></label><label>Lugar<input name="place" maxlength="160" placeholder="Ej.: Complejo Mushuc Runa"></label><label>Detalles<input name="details" maxlength="500" placeholder="Hora de acreditación, indicaciones"></label><button class="button-quiet" type="submit">Crear evento e invitar a todos</button></fieldset></form><p class="feedback" data-event-feedback role="status" aria-live="polite"></p></section>
<section class="admin-accreditation" data-accreditation hidden aria-labelledby="accreditation-title">
<div><h2 id="accreditation-title">Acreditación del evento</h2><p>Comparte este enlace o imprime el QR. Quien lo abra inicia sesión o crea la cuenta de su medio y registra su llegada; eso marca su asistencia.</p>
<label>Enlace de acreditación<input type="text" readonly data-accreditation-url autocomplete="off" spellcheck="false"></label>
<div class="admin-accreditation__actions"><button type="button" class="button-quiet" data-accreditation-copy>Copiar enlace</button><a class="button-quiet" data-accreditation-download download>Descargar QR</a></div>
<p class="feedback" data-accreditation-state role="status" aria-live="polite"></p></div>
<canvas data-accreditation-qr width="560" height="560"></canvas></section>
<section class="admin-big-numbers" aria-label="Resumen de cobertura" data-coverage-summary></section>
<section class="records" aria-labelledby="coverage-title" data-records-region><div class="records-heading"><h2 id="coverage-title" tabindex="-1">Medios del evento</h2><p data-coverage-filter>—</p></div>
<p data-coverage-message role="status">Cargando…</p>
<p class="admin-coverage-help">Al crear un evento se invita a todos los medios: los que tienen cuenta confirman desde su portal y aquí ves su respuesta. Marca el check de «Asistió» a quienes llegaron; el de «Link» se marca solo cuando cargas una publicación. Usa la nota para lo puntual. Contrato, asistencia y resultado alimentan los números de arriba. Toca un número para ver solo ese grupo; los cambios se guardan solos.</p>
<div class="admin-coverage-scroll"><table class="admin-coverage-table"><caption class="sr-only">Cobertura de cada medio en el evento</caption><thead><tr><th scope="col">Medio</th><th scope="col">Contrato</th><th scope="col">Confirmó</th><th scope="col">Asistió</th><th scope="col">Link</th><th scope="col">Resultado</th><th scope="col">Personas</th><th scope="col">Links</th><th scope="col">Nota</th><th scope="col">Estado</th></tr></thead><tbody data-coverage-rows></tbody></table></div></section>
<section class="pending-accounts pending-accounts--open" aria-labelledby="coverage-add-title"><h2 id="coverage-add-title">Agregar medio al evento</h2><p>Busca un medio ya registrado (con cuenta o cargado por coordinación). Si no existe, créalo aquí y quedará marcado como cargado por coordinación.</p>
<form data-coverage-add class="admin-coverage-add"><fieldset disabled><label class="search-field">Buscar medio<input type="search" name="search" maxlength="100" placeholder="Nombre del medio"></label><button class="button-quiet" type="submit">Buscar</button></fieldset></form>
<ul class="admin-coverage-results" data-coverage-results aria-live="polite"></ul>
<button type="button" class="button-primary" data-coverage-create disabled>Crear medio nuevo</button>
<p class="feedback" data-coverage-add-feedback role="status" aria-live="polite"></p></section>
${mediaRecordDialog()}</main></div>`, ADMIN_MEDIOS_SCRIPT);
}

export function renderAdminEmprendedoresPage(page) {
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-emprendedores>${campaignBanner}
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026 · De emprendedor a influencer</p><h1>Registros de Emprendedores</h1><p data-admin-user>Comprobando acceso…</p></div><button type="button" class="button-primary" data-admin-export disabled>Exportar CSV</button></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true"></p>
<button type="button" class="button-quiet" data-session-retry hidden>Reintentar conexión</button>
<section aria-label="Resumen de todos los registros" class="summary" data-admin-dashboard aria-busy="true"></section>
<details class="activity"><summary>Estados de todos los registros</summary><div class="activity-columns"><div><h2>Por estado</h2><dl data-status-counts></dl></div></div></details>
<section class="admin-global-videos" aria-labelledby="global-videos-title"><div class="records-heading"><div><h2 id="global-videos-title">Habilitación global de videos</h2><p>Estas fechas aplican para todos los emprendedores. Cuando llegue la fecha, podrán pegar el enlace del video habilitado.</p></div><p data-global-video-summary>—</p></div><form data-global-video-form><fieldset disabled><div class="admin-video-list">${videoSlotControls('schedule_video')}</div><button class="button-primary" type="submit">Guardar fechas globales</button></fieldset></form><p class="feedback" data-global-video-feedback role="status" aria-live="polite">Cargando fechas…</p></section>
<section class="followers-leaderboard video-views-leaderboard" aria-labelledby="video-views-leaderboard-title"><div class="records-heading"><div><h2 id="video-views-leaderboard-title">Top 20 por visualizaciones de videos</h2><p>Ranking rápido de los videos con más views validadas por coordinación.</p></div><p data-video-views-leaderboard-count>—</p></div><ol data-video-views-leaderboard aria-live="polite"></ol></section>
<section class="followers-leaderboard" aria-labelledby="followers-leaderboard-title"><div class="records-heading"><div><h2 id="followers-leaderboard-title">Top 20 por seguidores</h2><p>Ranking rápido basado en la cantidad de seguidores validados por coordinación.</p></div><p data-followers-leaderboard-count>—</p></div><ol data-followers-leaderboard aria-live="polite"></ol></section>
<form class="filters" data-admin-filters><fieldset disabled data-panel-fields>
<legend>Filtrar registros</legend>
<div class="filter-grid"><label class="search-field">Buscar<input type="search" name="search" maxlength="180" placeholder="Nombre, emprendimiento, producto, stand, cédula o teléfono"></label>
${select('status', 'Estado', EMPRENDEDOR_STATUSES)}<label>Ciudad exacta<input name="city" maxlength="100" placeholder="Todas las ciudades"></label>
${select('main_network', 'Red principal', ['TikTok', 'Instagram', 'Facebook'])}</div>
<div class="filter-actions"><button type="submit" class="button-primary">Aplicar filtros</button><button type="reset" class="button-quiet">Limpiar</button><label>Por página<select name="pageSize"><option>25</option><option>50</option><option>100</option></select></label></div>
</fieldset></form>
<section class="records" aria-labelledby="records-title" aria-busy="true" data-records-region><div class="records-heading"><h2 id="records-title" tabindex="-1">Registros</h2><p data-record-count>—</p></div>
<p data-list-message role="status">Cargando registros…</p>
<table><caption class="sr-only">Emprendedores registrados. Abre un registro para revisar sus datos, progreso y notas.</caption><thead><tr><th scope="col">Emprendedor</th><th scope="col">Contacto</th><th scope="col">Ciudad / red</th><th scope="col">Registro</th><th scope="col">Videos</th><th scope="col">Nivel</th><th scope="col">Estado y semáforo</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-records></tbody></table>
<nav class="pagination" aria-label="Paginación de registros"><button class="button-quiet" data-previous disabled>← Anterior</button><span data-page-label>Página —</span><button class="button-quiet" data-next disabled>Siguiente →</button></nav></section>
<details class="pending-accounts" data-pending-panel><summary><span><strong id="pending-accounts-title">Cuentas pendientes de ficha</strong><small>Última sección. Ábrela solo cuando necesites revisar cuentas creadas sin formulario.</small></span><span data-pending-count>—</span></summary><div class="pending-accounts-body" aria-labelledby="pending-accounts-title"><p class="feedback" data-pending-message role="status" aria-live="polite">Cargando cuentas…</p><div class="pending-accounts-table"><table><caption class="sr-only">Cuentas creadas que todavía no completan su ficha</caption><thead><tr><th scope="col">Correo</th><th scope="col">Creada</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-pending-accounts></tbody></table></div></div></details>
<dialog class="detail-dialog" aria-labelledby="detail-title" data-detail><div class="detail-heading"><h2 id="detail-title" tabindex="-1">Detalle del emprendedor</h2><button type="button" class="button-quiet" data-detail-close aria-label="Cerrar detalle">Cerrar ×</button></div>
<p class="feedback" data-detail-feedback role="status" aria-live="polite" aria-atomic="true"></p><div data-detail-content></div>
<div class="detail-danger-zone"><p>¿Este registro ya no debe tener acceso?</p><button type="button" class="button-danger" data-admin-delete disabled>Retirar registro</button></div>
<section class="admin-photo" data-admin-photo aria-label="Fotografía privada"><h3>Fotografía para identificación y gafete</h3><p data-admin-photo-message role="status">Sin fotografía</p><img data-admin-photo-image alt="Fotografía privada del emprendedor" hidden><a class="button-quiet" data-admin-photo-download hidden>Descargar fotografía</a></section>
<section class="admin-reset"><h3>Recuperar acceso</h3><button type="button" class="button-quiet" data-admin-reset disabled>Generar enlace temporal</button><div data-reset-output hidden><label>Enlace temporal<input type="text" readonly data-reset-url autocomplete="off" spellcheck="false"></label><button type="button" class="button-quiet" data-reset-copy>Copiar enlace</button></div><p class="feedback" data-reset-feedback role="status" aria-live="polite"></p></section>
<form data-status-form><fieldset disabled><label>Estado del registro<select name="status" required>${options(EMPRENDEDOR_STATUSES)}</select></label><button class="button-primary" type="submit">Guardar estado</button></fieldset></form>
<section class="admin-progress" aria-labelledby="admin-progress-title"><div class="admin-progress-heading"><div><h3 id="admin-progress-title">Progreso del emprendedor</h3><p>Registra los seguidores validados, el nivel, el semáforo y las views validadas de cada video. Las fechas se configuran una sola vez en la sección global.</p></div><span data-admin-progress-summary>Sin actualizar</span></div><form data-progress-form><fieldset disabled><div class="admin-progress-grid"><label>Seguidores validados<input type="number" name="followers_count" min="0" max="1000000000" step="1" required></label><label>Nivel<select name="level" required>${EMPRENDEDOR_LEVELS.map((label, index) => `<option value="${index}">${index} · ${esc(label)}</option>`).join('')}</select></label><label>Semáforo<select name="traffic_light" required><option value="red">Rojo · En preparación</option><option value="yellow">Amarillo · En avance</option><option value="green">Verde · Listo</option></select></label></div><div class="admin-videos" data-admin-videos></div><button class="button-primary" type="submit">Guardar progreso</button></fieldset></form><p class="feedback" data-progress-feedback role="status" aria-live="polite"></p></section>
<section class="notes-section"><h3>Notas internas</h3><ol data-notes></ol><form data-note-form><fieldset disabled><label>Añadir nota<textarea name="body" rows="3" maxlength="2000" required></textarea></label><button class="button-primary" type="submit">Guardar nota</button></fieldset></form></section>
</dialog></main></div>`, '/assets/admin/admin-emprendedores.js?v=20260923-admin-sidebar-1');
}

export function renderAdminNoticiasPage(page) {
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-noticias>
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026</p><h1>Noticias</h1><p data-admin-user>Comprobando acceso…</p></div>
<div class="workspace-actions"><button type="button" class="button-quiet" data-notice-new>Publicar aviso</button><button type="button" class="button-primary" data-phase-new>Agregar tramo</button></div></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true">Cargando noticias…</p>
<section class="admin-panel-section" aria-labelledby="mapa-title">
<div class="records-heading"><div><h2 id="mapa-title">Mapa de la campaña</h2><p>El tema central de cada tramo. Es lo que ve el equipo arriba de cada panel.</p></div></div>
<ol class="campaign-map" data-phase-list></ol>
</section>
<section class="admin-panel-section" aria-labelledby="avisos-title">
<div class="records-heading"><div><h2 id="avisos-title">Avisos</h2><p>Mensajes puntuales. Con fechas se muestran solo mientras están vigentes.</p></div></div>
<ol class="campaign-notices" data-notice-list></ol>
</section>
<dialog class="record-dialog record-dialog--compact" data-phase-dialog aria-label="Tramo de la campaña">
<form method="dialog" class="record-form">
<div class="records-heading"><div><h2 data-phase-title>Agregar tramo</h2><p>Desde qué fecha hasta qué fecha y con qué tema.</p></div></div>
<div class="record-grid">
<label class="record-grid__wide">Tema<input name="title" maxlength="160" required placeholder="Ej.: Revelación + Preventa"></label>
<label class="record-grid__wide">Detalle<input name="detail" maxlength="300" placeholder="Ej.: Comercial · mixto · feria"></label>
<label>Desde<input name="starts_on" type="date" required></label>
<label>Hasta<input name="ends_on" type="date" required></label>
<label class="record-grid__wide">Color<input name="accent" type="color" value="#94165e"></label>
</div>
<p class="feedback" data-phase-feedback role="status" aria-live="polite"></p>
<div class="record-form__actions record-form__actions--split">
<span class="record-form__side"><button type="button" class="button-quiet" data-phase-remove hidden>Quitar</button></span>
<span class="record-form__side"><button type="submit" value="cancel" class="button-quiet">Cancelar</button><button type="submit" value="save" class="button-primary">Guardar</button></span>
</div>
</form>
</dialog>
<dialog class="record-dialog record-dialog--compact" data-notice-dialog aria-label="Aviso">
<form method="dialog" class="record-form">
<div class="records-heading"><div><h2>Publicar aviso</h2><p>Se muestra arriba de todos los paneles mientras esté vigente.</p></div></div>
<div class="record-grid">
<label class="record-grid__wide">Aviso<input name="body" maxlength="400" required placeholder="Ej.: Esta semana grabamos con audiovisual"></label>
<label>Desde<input name="starts_on" type="date"></label>
<label>Hasta<input name="ends_on" type="date"></label>
</div>
<p class="feedback" data-notice-feedback role="status" aria-live="polite"></p>
<div class="record-form__actions"><button type="submit" value="cancel" class="button-quiet">Cancelar</button><button type="submit" value="save" class="button-primary">Publicar</button></div>
</form>
</dialog>
</main></div>`, '/assets/admin/admin-noticias.js?v=20260923-noticias-1');
}

export function renderAdminCreadorasPage(page) {
  const statuses = ['Activa', 'Nuevo', 'En pausa'].map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
  const networks = Object.entries({ tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', otro: 'Otra red' })
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-creadoras>${campaignBanner}
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026</p><h1>Creadoras de contenido</h1><p data-admin-user>Comprobando acceso…</p></div>
<div class="workspace-actions"><button type="button" class="button-quiet" data-creadora-new>Agregar creadora</button><button type="button" class="button-primary" data-shift-new>Agregar turno</button></div></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true">Cargando calendario…</p>
<div class="calendar-bar">
<div class="calendar-views" role="group" aria-label="Vista del calendario">
<button type="button" class="button-quiet" data-view="day" aria-pressed="false">Día</button>
<button type="button" class="button-quiet" data-view="week" aria-pressed="true">Semana</button>
<button type="button" class="button-quiet" data-view="month" aria-pressed="false">Mes</button>
</div>
<div class="calendar-move">
<button type="button" class="button-quiet" data-calendar-previous aria-label="Periodo anterior">◀</button>
<strong data-calendar-label>…</strong>
<button type="button" class="button-quiet" data-calendar-next aria-label="Periodo siguiente">▶</button>
<button type="button" class="button-quiet" data-calendar-today>Hoy</button>
</div>
</div>
<section class="creadora-indicators" aria-labelledby="indicadores-title">
<div class="records-heading"><div><h2 id="indicadores-title">Indicadores por creadora</h2><p>Turnos, asistencias, guiones, cuántos ya se grabaron y el contenido registrado en toda la campaña.</p></div></div>
<div class="creadora-totals" data-creadora-totals></div>
<ul class="creadora-indicators__list" data-creadora-indicators></ul>
</section>
<div class="calendar-layout">
<aside class="calendar-people" aria-labelledby="creadoras-title">
<h2 id="creadoras-title">Creadoras</h2>
<p>Toca un nombre para agendarle un turno, o arrástralo al calendario. Suéltalo sobre una caja para sumarlo a ese turno. «Ver ficha» abre sus datos.</p>
<ul data-creadora-list></ul>
</aside>
<section class="calendar-board" aria-label="Calendario de turnos">
<div class="calendar-grid" data-calendar-grid></div>
<div class="calendar-month" data-calendar-month hidden></div>
<p class="calendar-help">Arrastra una caja para moverla de día u hora y su borde de abajo para cambiar la hora de fin. Tócala para abrirla, duplicarla o copiarla. Un mismo turno puede reunir a varias creadoras en una sola caja.</p>
<p class="calendar-clipboard" data-clipboard hidden>Copiaste <strong data-clipboard-label></strong>. Toca una hora del calendario para pegarlo. <button type="button" class="button-quiet" data-clipboard-cancel>Cancelar</button></p>
</section>
</div>
<section class="admin-panel-section" aria-labelledby="bitacora-title">
<div class="records-heading"><div><h2 id="bitacora-title">Cambios del calendario</h2><p>Quién cambió qué y cómo quedó. Lo más reciente primero.</p></div></div>
<ol class="calendar-log" data-calendar-log></ol>
</section>
<dialog class="record-dialog record-dialog--shift" data-shift-dialog aria-label="Turno del calendario">
<form method="dialog" class="record-form">
<div class="records-heading"><div><h2 data-shift-title>Agregar turno</h2><p>Marca a todas las creadoras que vienen en este horario: quedan en la misma caja.</p></div></div>
<div class="shift-columns">
<div class="shift-columns__main">
<div class="record-grid">
<fieldset class="record-grid__wide shift-people" data-shift-people><legend>Creadoras del turno</legend><div class="shift-people__list" data-shift-people-list></div></fieldset>
<label>Día<input name="day" type="date" required></label>
<label>Lugar<input name="place" maxlength="160" placeholder="Opcional"></label>
<label>Hora de inicio<input name="start" type="time" step="900" required></label>
<label>Hora de fin<input name="end" type="time" step="900" required></label>
<label class="record-grid__wide">Nota<input name="note" maxlength="400" placeholder="Opcional"></label>
</div>
<p class="calendar-duration" data-shift-duration></p>
<section class="shift-record" data-shift-record hidden aria-labelledby="registro-title">
<div class="records-heading"><div><h3 id="registro-title">Lo que pasó en el turno</h3><p>Marca la asistencia y registra el contenido que se hizo.</p></div></div>
<div class="shift-attendance-list" data-shift-attendance aria-label="Asistencia de cada creadora"></div>
<div class="shift-content">
<div class="shift-content__heading"><strong>Contenido realizado</strong><button type="button" class="button-quiet shift-content__add" data-content-add aria-label="Agregar contenido">+</button></div>
<ol class="shift-content__list" data-content-list></ol>
<div class="shift-content__form" data-content-form hidden>
<label data-content-creadora-field hidden>Creadora<select data-content-creadora></select></label>
<label>Tipo<select data-content-kind><option value="video">Video</option><option value="live">En vivo</option><option value="historia">Historia</option><option value="foto">Fotografía</option><option value="otro">Otro</option></select></label>
<label>Nombre del contenido<input data-content-title maxlength="200" placeholder="Ej.: Recorrido por la feria"></label>
<label>Enlace<input data-content-url type="url" maxlength="500" placeholder="https:// (opcional)"></label>
<div class="shift-content__actions"><button type="button" class="button-quiet" data-content-cancel>Cancelar</button><button type="button" class="button-primary" data-content-save>Agregar</button></div>
</div>
</div>
</section>
</div>
<aside class="shift-notebook" data-shift-notebook hidden aria-labelledby="cuaderno-title">
<div class="records-heading"><div><h3 id="cuaderno-title">Cuaderno de apuntes</h3><p>La referencia y el guion de lo que se va a grabar.</p></div><button type="button" class="button-quiet shift-content__add" data-script-add aria-label="Agregar guion">+</button></div>
<div class="shift-notebook__list" data-script-list></div>
<div class="shift-notebook__form" data-script-form hidden>
<label>Nombre de la idea<input data-script-title maxlength="200" placeholder="Ej.: Recorrido de apertura"></label>
<label>Para<select data-script-creadora></select></label>
<label>Guion<textarea data-script-body rows="8" placeholder="Plano 1: …"></textarea></label>
<label>Referencia<input data-script-url type="url" maxlength="500" placeholder="https:// (opcional)"></label>
<div class="shift-content__actions"><button type="button" class="button-quiet" data-script-cancel>Cancelar</button><button type="button" class="button-primary" data-script-save>Guardar guion</button></div>
</div>
</aside>
</div>
<p class="feedback" data-shift-feedback role="status" aria-live="polite"></p>
<div class="record-form__actions record-form__actions--split">
<span class="record-form__side"><button type="button" class="button-quiet" data-shift-duplicate hidden>Duplicar</button><button type="button" class="button-quiet" data-shift-copy hidden>Copiar</button><button type="button" class="button-quiet" data-shift-remove hidden>Quitar</button></span>
<span class="record-form__side"><button type="submit" value="cancel" class="button-quiet">Cancelar</button><button type="submit" value="save" class="button-primary">Guardar turno</button></span>
</div>
</form>
</dialog>
<dialog class="record-dialog" data-creadora-dialog aria-label="Ficha de la creadora">
<form method="dialog" class="record-form">
<div class="records-heading"><div><h2 data-dialog-title>Agregar creadora</h2><p>Los datos personales se guardan cifrados y solo los ve coordinación.</p></div></div>
<div class="record-grid">
<label class="record-grid__wide">Nombre y apellido<input name="full_name" maxlength="160" required></label>
<label>Cédula<input name="cedula" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" placeholder="Ej.: 1801234567"></label>
<label>Fecha de nacimiento<input name="birth_date" type="date"></label>
<label>WhatsApp<input name="whatsapp" maxlength="32" inputmode="tel" placeholder="0990000000"></label>
<label>Correo de contacto<input name="contact_email" type="email" maxlength="254"></label>
<label>Ciudad<input name="city" maxlength="120"></label>
<label>Estado<select name="status">${statuses}</select></label>
<label>Red principal<select name="main_network"><option value="">Sin definir</option>${networks}</select></label>
<label>Seguidores declarados<input name="followers_count" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></label>
<label class="record-grid__wide">Enlace principal de su cuenta<input name="social_link" type="url" maxlength="400" placeholder="https://"></label>
<label>TikTok<input name="tiktok" type="url" maxlength="400" placeholder="https://"></label>
<label>Instagram<input name="instagram" type="url" maxlength="400" placeholder="https://"></label>
<label class="record-grid__wide">Facebook<input name="facebook" type="url" maxlength="400" placeholder="https://"></label>
<label class="record-grid__wide">Nota de coordinación<textarea name="note" rows="3" maxlength="2000"></textarea></label>
</div>
<div class="record-form__actions"><button type="submit" value="cancel" class="button-quiet">Cancelar</button><button type="submit" value="save" class="button-primary">Guardar</button></div>
</form>
</dialog>
</main></div>`, ADMIN_CREADORAS_SCRIPT);
}

export function renderAdminPanelPage(page) {
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-panel>${campaignBanner}
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026</p><h1>Panel</h1><p data-admin-user>Comprobando acceso…</p></div></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true">Cargando panel…</p>
<button type="button" class="button-quiet" data-session-retry hidden>Reintentar conexión</button>
<section class="admin-panel-section admin-social" aria-labelledby="panel-redes-title" data-panel-social><div class="records-heading"><div><h2 id="panel-redes-title">Redes sociales</h2><p>Solo la cuenta Finados Mushuc Runa, leída de Metricool. Cada cifra se compara con el periodo anterior del mismo largo.</p></div></div>
<div class="admin-social__controls" role="group" aria-label="Periodo de las redes sociales"><div class="admin-social__presets"><button type="button" class="button-quiet" data-social-preset="7" aria-pressed="false">7 días</button><button type="button" class="button-quiet" data-social-preset="30" aria-pressed="true">30 días</button><button type="button" class="button-quiet" data-social-preset="90" aria-pressed="false">90 días</button></div>
<label>Desde<input type="date" data-social-from></label><label>Hasta<input type="date" data-social-to></label><button type="button" class="button-primary" data-social-apply>Ver periodo</button><button type="button" class="button-quiet" data-social-refresh title="Volver a leer Metricool ahora">Actualizar datos</button></div>
<p class="feedback" data-social-feedback role="status" aria-live="polite"></p><div data-social-content></div></section>
<section class="admin-panel-section" aria-labelledby="panel-medios-title"><div class="records-heading"><div><h2 id="panel-medios-title">Medios</h2><p>Toca un número para ver la lista.</p></div></div><div data-panel-media></div>
<section class="admin-panel-subsection" aria-labelledby="panel-eventos-title"><div class="records-heading"><div><h3 id="panel-eventos-title">Medios por evento</h3><p>Abre un evento para ver su cobertura.</p></div></div><div data-panel-events></div></section></section>
<section class="admin-panel-section" aria-labelledby="panel-creadoras-title"><div class="records-heading"><div><h2 id="panel-creadoras-title">Creadoras de contenido</h2><p>Horas que vinieron, lo que grabaron y sus videos. Toca a una creadora para ver su historial.</p></div></div><div data-panel-creadoras></div></section>
<section class="admin-panel-section" aria-labelledby="panel-voceros-title"><div class="records-heading"><div><h2 id="panel-voceros-title">Voceros</h2><p>Toca un número para ver la lista.</p></div></div><div data-panel-voceros></div></section>
</main></div>`, '/assets/admin/panel.js?v=20260924-admin-panel-5');
}

// Mushuc Freestyle: los estados viven aquí para que el HTML no dependa del módulo del navegador.
const MFS_STATUS_OPTIONS = Object.freeze(['Nuevo', 'En revisión', 'Aprobado', 'Rechazado', 'Seleccionado']);
export const ADMIN_MFS_SCRIPT = '/assets/admin/admin-mfs.js?v=20260924-admin-mfs-2';

export function renderAdminMfsPage(page) {
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-mfs>${campaignBanner}
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026 · 2da edición</p><h1>Mushuc Freestyle</h1><p data-admin-user>Comprobando acceso…</p></div><button type="button" class="button-primary" data-admin-export disabled>Exportar CSV</button></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true"></p>
<button type="button" class="button-quiet" data-session-retry hidden>Reintentar conexión</button>
<section aria-label="Resumen de inscripciones" class="summary" data-admin-dashboard aria-busy="true"></section>
<form class="filters" data-admin-filters><fieldset disabled data-panel-fields>
<legend>Filtrar inscripciones</legend>
<div class="filter-grid"><label class="search-field">Buscar<input type="search" name="search" maxlength="180" placeholder="Nombre, nombre artístico, cédula, correo o WhatsApp"></label>
<label>Estado<select name="status"><option value="">Todos (sin archivados)</option>${options(MFS_STATUS_OPTIONS)}<option value="Archivado">Archivado</option></select></label></div>
<div class="filter-actions"><button type="submit" class="button-primary">Aplicar filtros</button><button type="reset" class="button-quiet">Limpiar</button><label>Por página<select name="pageSize"><option>25</option><option>50</option><option>100</option></select></label></div>
</fieldset></form>
<section class="records" aria-labelledby="records-title" aria-busy="true" data-records-region><div class="records-heading"><h2 id="records-title" tabindex="-1">Inscripciones</h2><p data-record-count>—</p></div>
<p data-list-message role="status">Cargando inscripciones…</p>
<table><caption class="sr-only">Participantes inscritos en Mushuc Freestyle. Abre una inscripción para revisar su audición, foto y notas.</caption><thead><tr><th scope="col">Participante</th><th scope="col">Contacto</th><th scope="col">Audición</th><th scope="col">Foto</th><th scope="col">Inscripción</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-records></tbody></table>
<nav class="pagination" aria-label="Paginación de inscripciones"><button class="button-quiet" data-previous disabled>← Anterior</button><span data-page-label>Página —</span><button class="button-quiet" data-next disabled>Siguiente →</button></nav></section>
<details class="pending-accounts" data-pending-panel><summary><span><strong id="pending-accounts-title">Cuentas pendientes de ficha</strong><small>Personas que crearon su cuenta pero todavía no envían su inscripción.</small></span><span data-pending-count>—</span></summary><div class="pending-accounts-body" aria-labelledby="pending-accounts-title"><p class="feedback" data-pending-message role="status" aria-live="polite">Cargando cuentas…</p><div class="pending-accounts-table"><table><caption class="sr-only">Cuentas creadas que todavía no envían su inscripción</caption><thead><tr><th scope="col">Correo</th><th scope="col">Creada</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-pending-accounts></tbody></table></div></div></details>
<dialog class="detail-dialog" aria-labelledby="detail-title" data-detail><div class="detail-heading"><h2 id="detail-title" tabindex="-1">Detalle del participante</h2><button type="button" class="button-quiet" data-detail-close aria-label="Cerrar detalle">Cerrar ×</button></div>
<p class="feedback" data-detail-feedback role="status" aria-live="polite" aria-atomic="true"></p><div data-detail-content></div>
<section class="admin-photo" aria-label="Fotografía privada"><h3>Fotografía tipo retrato</h3><p data-admin-photo-message role="status">Sin fotografía</p><img data-admin-photo-image alt="Fotografía privada del participante" hidden></section>
<form data-status-form><fieldset disabled><label>Estado de la inscripción<select name="status" required>${options(MFS_STATUS_OPTIONS)}</select></label><button class="button-primary" type="submit">Guardar estado</button></fieldset></form>
<form data-audition-form><fieldset disabled><label>Corregir audición (solo si el participante lo solicita)<input type="url" name="url" maxlength="500" inputmode="url" placeholder="https://www.tiktok.com/@usuario/video/…" required></label><button class="button-quiet" type="submit">Reemplazar enlace</button></fieldset></form>
<section class="notes-section"><h3>Notas internas</h3><ol data-notes></ol><form data-note-form><fieldset disabled><label>Añadir nota<textarea name="body" rows="3" maxlength="2000" required></textarea></label><button class="button-primary" type="submit">Guardar nota</button></fieldset></form></section>
<section class="admin-reset"><h3>Recuperar acceso</h3><button type="button" class="button-quiet" data-admin-reset disabled>Generar enlace temporal</button><div data-reset-output hidden><label>Enlace temporal<input type="text" readonly data-reset-url autocomplete="off" spellcheck="false"></label><button type="button" class="button-quiet" data-reset-copy>Copiar enlace</button></div><p class="feedback" data-reset-feedback role="status" aria-live="polite"></p></section>
<div class="detail-danger-zone"><p>Retirar oculta la inscripción y desactiva el acceso; no borra nada y se puede deshacer.</p><button type="button" class="button-danger" data-admin-delete disabled>Retirar inscripción</button><button type="button" class="button-primary" data-admin-restore hidden>Restaurar inscripción</button></div>
</dialog></main></div>`, ADMIN_MFS_SCRIPT);
}
