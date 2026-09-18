import { escapeHtml as esc } from '../render/html.mjs';
import { STATUSES, PREVIOUS_PARTICIPATION } from './admin.js';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';

const options = values => values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
const select = (name, label, values) => `<label>${label}<select name="${name}"><option value="">Todos</option>${options(values)}</select></label>`;
const ADMIN_FORMS = Object.freeze([
  { route: '/admin/voceros/', label: 'Voceros', description: 'Registros y seguimiento', marker: 'V' },
]);
const PROGRESS_LEVELS = ['En preparación', 'Primer paso', 'Gorra', 'Kit completo', 'Trae a los tuyos', 'Noche de concierto', 'Tope'];
const VIDEO_SLOTS = Object.freeze([1, 2, 3, 4, 5]);
const videoSlotControls = (prefix = 'video') => VIDEO_SLOTS.map(slot => `<label class="admin-video-control"><span class="admin-video-check"><input type="checkbox" name="${prefix}_${slot}_enabled" value="1"><strong>Video ${slot}</strong></span><span class="admin-video-date"><span>Habilitado desde</span><input type="date" name="${prefix}_${slot}_enabled_at" aria-label="Fecha de habilitación del video ${slot}"></span></label>`).join('');

function adminSidebar(page) {
  const currentForm = ADMIN_FORMS.find(item => item.route === page.route);
  const links = ADMIN_FORMS.map((item) => {
    const current = item.route === page.route ? ' aria-current="page"' : '';
    return `<a class="admin-nav-link" href="${esc(item.route)}"${current}><span class="admin-nav-marker" aria-hidden="true">${esc(item.marker)}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></span></a>`;
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

function layout(page, content) {
  const api = page.adminEnvironment === 'development' ? (page.adminApiBase ?? LOCAL_API_BASE) : PRIMARY_API_BASE;
  const connectSources = apiBasesForCsp(api);
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} | Complejo Mushuc Runa</title>
<meta name="description" content="Acceso administrativo a los registros de Voceros de Finados Mushuc Runa.">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${connectSources}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="admin-api-base" content="${api}">
<link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="stylesheet" href="/assets/admin/admin.css?v=20260915-2">
<script type="module" src="/assets/admin/admin.js?v=20260918-admin-video-checks-1"></script>
</head><body class="admin-page">
<a class="skip-link" href="#contenido">Ir al contenido</a>
<header class="admin-header"><a href="/finados/voceros/" aria-label="Volver a Voceros"><img src="/assets/finados/logo-finados.svg" width="132" height="60" alt="Finados Mushuc Runa"></a><span class="header-context">Administración${page.route === '/admin/voceros/' ? ' <span aria-hidden="true">/</span> Formularios' : ''}</span></header>
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
<section class="admin-progress" aria-labelledby="admin-progress-title"><div class="admin-progress-heading"><div><h3 id="admin-progress-title">Progreso del vocero</h3><p>Registra la métrica validada, semáforo y retiro de kit. Las fechas de videos se configuran una sola vez en la sección global.</p></div><span data-admin-progress-summary>Sin actualizar</span></div><form data-progress-form><fieldset disabled><div class="admin-progress-grid"><label>Seguidores validados<input type="number" name="followers_count" min="0" max="1000000000" step="1" required></label><label>Nivel<select name="level" required>${PROGRESS_LEVELS.map((label, index) => `<option value="${index}">${index} · ${esc(label)}</option>`).join('')}</select></label><label>Semáforo<select name="traffic_light" required><option value="red">Rojo · En preparación</option><option value="yellow">Amarillo · En avance</option><option value="green">Verde · Listo</option></select></label><label>Kit<select name="kit_status" required><option value="pendiente">Pendiente de retiro</option><option value="retirado">Retirado</option></select></label></div><button class="button-primary" type="submit">Guardar progreso</button></fieldset></form><p class="feedback" data-progress-feedback role="status" aria-live="polite"></p><div class="admin-videos" data-admin-videos></div></section>
<section class="notes-section"><h3>Notas internas</h3><ol data-notes></ol><form data-note-form><fieldset disabled><label>Añadir nota<textarea name="body" rows="3" maxlength="2000" required></textarea></label><button class="button-primary" type="submit">Guardar nota</button></fieldset></form></section>
</dialog></main></div>`);
}
