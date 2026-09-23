import { escapeHtml as esc } from '../render/html.mjs';
import { STATUSES, PREVIOUS_PARTICIPATION } from './admin.js';
import { MEDIA_STATUSES, MEDIA_TYPE_LABELS, ORIGIN_LABELS } from './admin-medios.js';
import { EMPRENDEDOR_LEVELS, EMPRENDEDOR_STATUSES } from './admin-emprendedores.js';
import { ecuadorProvinces } from '../media-accreditation/page.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';

const options = values => values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
const select = (name, label, values) => `<label>${label}<select name="${name}"><option value="">Todos</option>${options(values)}</select></label>`;
const ADMIN_FORMS = Object.freeze([
  { route: '/admin/voceros/', label: 'Voceros', description: 'Registros y seguimiento', marker: 'V' },
  { route: '/admin/medios/', label: 'Medios', description: 'Acreditación de medios', marker: 'M', children: [{ route: '/admin/medios/eventos/', label: 'Eventos', description: 'Cobertura por evento' }] },
  { route: '/admin/emprendedores/', label: 'Emprendedores', description: 'De emprendedor a influencer', marker: 'E' },
]);
// Public landing that each panel returns to from its header.
const PANEL_LANDINGS = Object.freeze({ '/admin/voceros/': ['/finados/voceros/', 'Volver a Voceros'], '/admin/medios/': ['/finados/medios/', 'Volver a Medios'], '/admin/medios/eventos/': ['/finados/medios/', 'Volver a Medios'], '/admin/emprendedores/': ['/finados/emprendedores/', 'Volver a Emprendedores'] });
const PROGRESS_LEVELS = ['En preparación', 'Primer paso', 'Gorra', 'Kit completo', 'Trae a los tuyos', 'Noche de concierto', 'Tope'];
const VIDEO_SLOTS = Object.freeze([1, 2, 3, 4, 5]);
const videoSlotControls = (prefix = 'video') => VIDEO_SLOTS.map(slot => `<label class="admin-video-control"><span class="admin-video-check"><input type="checkbox" name="${prefix}_${slot}_enabled" value="1"><strong>Video ${slot}</strong></span><span class="admin-video-date"><span>Habilitado desde</span><input type="date" name="${prefix}_${slot}_enabled_at" aria-label="Fecha de habilitación del video ${slot}"></span></label>`).join('');

function adminSidebar(page) {
  const currentForm = ADMIN_FORMS.find(item => item.route === page.route || (item.children ?? []).some(child => child.route === page.route));
  const links = ADMIN_FORMS.map((item) => {
    const current = item.route === page.route ? ' aria-current="page"' : '';
    // A submenu (e.g. Medios → Eventos) renders as indented links right below its parent.
    const children = (item.children ?? []).map(child => `<a class="admin-nav-link admin-nav-link--child" href="${esc(child.route)}"${child.route === page.route ? ' aria-current="page"' : ''}><span class="admin-nav-marker" aria-hidden="true">›</span><span><strong>${esc(child.label)}</strong><small>${esc(child.description)}</small></span></a>`).join('');
    return `<a class="admin-nav-link" href="${esc(item.route)}"${current}><span class="admin-nav-marker" aria-hidden="true">${esc(item.marker)}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></span></a>${children}`;
  }).join('');

  return `<aside class="admin-sidebar" aria-label="Navegación administrativa">
<details class="admin-sidebar__navigation" data-admin-navigation open>
<summary><span>Menú administrativo</span><span class="admin-sidebar__current">${esc(currentForm?.label ?? 'Formularios')}</span><span class="admin-sidebar__chevron" aria-hidden="true">⌄</span></summary>
<div class="admin-sidebar__content">
<div class="admin-sidebar__intro"><p class="eyebrow">Panel de gestión</p><p>Administración</p></div>
<nav aria-labelledby="admin-forms-title"><p id="admin-forms-title" class="admin-nav-title">Formularios</p>${links}</nav>
<p class="admin-sidebar__future">Los próximos formularios aparecerán aquí cuando estén habilitados.</p>
<div class="admin-sidebar__account"><p><span>Sesión activa</span><strong data-admin-sidebar-user>Comprobando…</strong></p><button type="button" class="button-quiet" data-admin-logout disabled>Cerrar sesión</button></div>
</div>
</details>
</aside>`;
}

function layout(page, content, script = '/assets/admin/admin.js?v=20260921-admin-top20-1') {
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
<link rel="stylesheet" href="/assets/admin/admin.css?v=20260922-2">
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
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-voceros>
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
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-medios>
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
<table><caption class="sr-only">Medios registrados. Abre un registro para revisar sus datos, videos y notas.</caption><thead><tr><th scope="col">Medio</th><th scope="col">Frecuencia</th><th scope="col">Ubicación</th><th scope="col">Canales</th><th scope="col">Videos</th><th scope="col">Registro</th><th scope="col">Estado y semáforo</th><th scope="col">Pauta</th><th scope="col">Origen</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody data-records></tbody></table>
<nav class="pagination" aria-label="Paginación de registros"><button class="button-quiet" data-previous disabled>← Anterior</button><span data-page-label>Página —</span><button class="button-quiet" data-next disabled>Siguiente →</button></nav></section>
<dialog class="detail-dialog" aria-labelledby="detail-title" data-detail><div class="detail-heading"><h2 id="detail-title" tabindex="-1">Detalle del medio</h2><button type="button" class="button-quiet" data-detail-close aria-label="Cerrar detalle">Cerrar ×</button></div>
<p class="feedback" data-detail-feedback role="status" aria-live="polite" aria-atomic="true"></p><div data-detail-content></div>
<form data-status-form><fieldset disabled><label>Estado del registro<select name="status" required>${options(MEDIA_STATUSES)}</select></label><label>Semáforo<select name="traffic_light" required><option value="red">Rojo · En preparación</option><option value="yellow">Amarillo · En avance</option><option value="green">Verde · Listo</option></select></label><label>Medio pautado<select name="paid_media" required><option value="no">No · Sin pauta</option><option value="yes">Sí · Pautado</option></select></label><button class="button-primary" type="submit">Guardar estado, semáforo y pauta</button></fieldset></form>
<section class="admin-reset"><h3>Recuperar acceso</h3><button type="button" class="button-quiet" data-admin-reset disabled>Generar enlace temporal</button><div data-reset-output hidden><label>Enlace temporal<input type="text" readonly data-reset-url autocomplete="off" spellcheck="false"></label><button type="button" class="button-quiet" data-reset-copy>Copiar enlace</button></div><p class="feedback" data-reset-feedback role="status" aria-live="polite"></p></section>
<section class="notes-section"><h3>Notas internas</h3><ol data-notes></ol><form data-note-form><fieldset disabled><label>Añadir nota<textarea name="body" rows="3" maxlength="2000" required></textarea></label><button class="button-primary" type="submit">Guardar nota</button></fieldset></form></section>
<div class="detail-danger-zone"><p>¿Este registro ya no debe tener acceso?</p><button type="button" class="button-danger" data-admin-delete disabled>Retirar registro</button></div>
</dialog>${mediaRecordDialog()}</main></div>`, ADMIN_MEDIOS_SCRIPT);
}

const ADMIN_MEDIOS_SCRIPT = '/assets/admin/admin-medios.js?v=20260922-admin-medios-13';
const PROVINCE_OPTIONS = ['Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'];

/** Shared dialog: coordination creates or completes a medium without needing the medium's account. */
function mediaRecordDialog() {
  return `<dialog class="detail-dialog record-dialog" aria-labelledby="record-title" data-record-dialog><div class="detail-heading"><h2 id="record-title" tabindex="-1" data-record-title>Agregar medio</h2><button type="button" class="button-quiet" data-record-close aria-label="Cerrar">Cerrar ×</button></div>
<p class="feedback" data-record-feedback role="status" aria-live="polite"></p>
<form data-record-form novalidate><fieldset><div class="record-grid">
<label class="record-grid__wide">Nombre del medio *<input name="media_name" maxlength="140" required></label>
<fieldset class="record-grid__wide record-types"><legend>Tipo de medio *</legend>${Object.entries(MEDIA_TYPE_LABELS).map(([key, label]) => `<label><input type="checkbox" name="media_types" value="${esc(key)}"> ${esc(label)}</label>`).join('')}</fieldset>
<label>Frecuencia (radio)<input name="frequency" maxlength="120" placeholder="Ej.: 102.5 FM"></label>
<label>Canal (televisión)<input name="tv_channel" maxlength="120" placeholder="Ej.: Canal 38"></label>
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
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-medios-eventos>
<div class="workspace-heading"><div><p class="eyebrow">Finados 2026 · Medios</p><h1>Cobertura por evento</h1><p data-admin-user>Comprobando acceso…</p></div></div>
<p class="feedback" data-admin-feedback role="status" aria-live="polite" aria-atomic="true"></p>
<button type="button" class="button-quiet" data-session-retry hidden>Reintentar conexión</button>
<section class="admin-events-bar" aria-label="Evento"><label>Evento<select data-event-select disabled><option>Cargando…</option></select></label>
<form data-event-form class="admin-event-form"><fieldset disabled><label>Nuevo evento<input name="name" maxlength="160" placeholder="Ej.: Lanzamiento Finados 2026" required></label><label>Fecha<input name="event_date" type="date"></label><button class="button-quiet" type="submit">Crear evento</button></fieldset></form><p class="feedback" data-event-feedback role="status" aria-live="polite"></p></section>
<section class="admin-big-numbers" aria-label="Resumen de cobertura" data-coverage-summary></section>
<section class="records" aria-labelledby="coverage-title" data-records-region><div class="records-heading"><h2 id="coverage-title" tabindex="-1">Medios del evento</h2><p data-coverage-filter>—</p></div>
<p data-coverage-message role="status">Cargando…</p>
<p class="admin-coverage-help">Contrato y resultado alimentan los números de arriba. Toca un número para ver solo ese grupo; los cambios se guardan solos.</p>
<table class="admin-coverage-table"><caption class="sr-only">Cobertura de cada medio en el evento</caption><thead><tr><th scope="col">Medio</th><th scope="col">Contrato</th><th scope="col">Resultado</th><th scope="col">Personas</th><th scope="col">Links</th><th scope="col">Nota</th><th scope="col">Estado</th></tr></thead><tbody data-coverage-rows></tbody></table></section>
<section class="pending-accounts pending-accounts--open" aria-labelledby="coverage-add-title"><h2 id="coverage-add-title">Agregar medio al evento</h2><p>Busca un medio ya registrado (con cuenta o cargado por coordinación). Si no existe, créalo aquí y quedará marcado como cargado por coordinación.</p>
<form data-coverage-add class="admin-coverage-add"><fieldset disabled><label class="search-field">Buscar medio<input type="search" name="search" maxlength="100" placeholder="Nombre del medio"></label><button class="button-quiet" type="submit">Buscar</button></fieldset></form>
<ul class="admin-coverage-results" data-coverage-results aria-live="polite"></ul>
<button type="button" class="button-primary" data-coverage-create disabled>Crear medio nuevo</button>
<p class="feedback" data-coverage-add-feedback role="status" aria-live="polite"></p></section>
${mediaRecordDialog()}</main></div>`, ADMIN_MEDIOS_SCRIPT);
}

export function renderAdminEmprendedoresPage(page) {
  return layout(page, `<div class="admin-shell">${adminSidebar(page)}<main id="contenido" class="admin-workspace" data-admin-emprendedores>
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
</dialog></main></div>`, '/assets/admin/admin-emprendedores.js?v=20260922-emprendedores-1');
}
