import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260926-admin-sidebar-3';
import './campaign-banner.js?v=20261001-banner-3';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';

export class InvitacionesAdminError extends Error {
  constructor(status) {
    super(({
      0: 'No se pudo conectar. Revisa tu conexión.',
      401: 'Tu sesión terminó. Vuelve a iniciar sesión.',
      403: 'Tu rol no tiene acceso a Invitaciones.',
    })[status] || 'No se pudo cargar la información.');
    this.status = status;
  }
}

/** Solo lectura: la sesión y las listas de Influencers para contar respuestas. */
export function createInvitacionesClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  async function request(path) {
    if (!/^\/(?:auth\/session|influencers\?kind=(?:creador|nuevo))$/.test(path)) throw new Error('Ruta de API no permitida.');
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, { method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
    } catch { throw new InvitacionesAdminError(0); }
    if (!response.ok) throw new InvitacionesAdminError(response.status);
    try { return await response.json(); } catch { throw new InvitacionesAdminError(502); }
  }
  return { session: () => request('/auth/session'), list: kind => request(`/influencers?kind=${kind}`) };
}

/* ---------- Funciones puras (probadas) ---------- */

/** Las pantallas de cada invitación; «?vista=1» las abre con datos de muestra, sin tocar ninguna invitación real. */
export const INVITATIONS = Object.freeze([
  {
    id: 'guaynaa', fallbackTitle: 'Lanzamiento Guaynaa', audiences: ['Creadores', 'Nuevos creadores'], manage: '/admin/influencers/creadores/',
    screens: [
      { key: 'personal', label: 'Invitación personal', note: 'La que recibe cada creador por WhatsApp, con su nombre.', path: '/i/?vista=1' },
      { key: 'abierta', label: 'Invitación abierta', note: 'Un solo enlace: la persona deja sus datos y confirma.', path: '/finados/invitacion/creadores/?vista=1' },
      { key: 'gracias', label: 'Pantalla de gracias', note: 'Lo que ve después de confirmar.', path: '/finados/invitacion/gracias/?vista=1' },
      { key: 'gafete', label: 'Gafete', note: 'Su gafete con QR para la entrada.', path: '/finados/invitacion/gafete/?vista=1' },
      { key: 'verificar', label: 'Validación en la puerta', note: 'Lo que ve el equipo al escanear el gafete.', path: '/finados/invitacion/verificar/?vista=1' },
    ],
  },
]);

/** Fecha de hoy en Ecuador (UTC−5, sin horario de verano). */
export function ecuadorToday(now = new Date()) {
  return new Date(now.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function invitationState(date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ''))) return { key: 'sin-fecha', label: 'Sin fecha' };
  if (date < today) return { key: 'pasada', label: 'Ya pasó' };
  if (date === today) return { key: 'hoy', label: 'Es hoy' };
  return { key: 'proxima', label: 'Próxima' };
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function dateLabel(date, time = '') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  if (!match) return 'Fecha por confirmar';
  const label = `${Number(match[3])} de ${MONTHS[Number(match[2]) - 1]} de ${match[1]}`;
  return /^\d{2}:\d{2}$/.test(String(time ?? '')) ? `${label} · ${time}` : label;
}

/** Suma Creadores y Nuevos creadores para el resumen de la invitación. */
export function combineTotals(creadores = {}, nuevos = {}) {
  const value = (data, key) => Number(data?.totals?.[key] ?? 0);
  return {
    invitados: value(creadores, 'total') + value(nuevos, 'total'),
    si: value(creadores, 'si') + value(nuevos, 'si'),
    no: value(creadores, 'no') + value(nuevos, 'no'),
    pendiente: value(creadores, 'pendiente') + value(nuevos, 'pendiente'),
    abrieron: value(creadores, 'abrieron'),
    porAprobar: value(nuevos, 'por_aprobar'),
  };
}

/* ---------- Pantalla ---------- */

function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'className') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

function renderInvitation(invitation, event, totals, today) {
  const state = invitationState(event?.date, today);
  const title = event?.title || invitation.fallbackTitle;
  const card = element('article', { className: 'ivt-card', 'aria-labelledby': `ivt-${invitation.id}-title` });

  const facts = element('div', { className: 'ivt-card__head' }, [
    element('div', {}, [
      element('p', { className: 'ivt-state', 'data-state': state.key, text: state.label }),
      element('h2', { id: `ivt-${invitation.id}-title`, text: title }),
      element('p', { className: 'ivt-meta', text: [dateLabel(event?.date, event?.time), event?.place].filter(Boolean).join(' · ') }),
      element('p', { className: 'ivt-audience' }, [element('span', { text: 'Enviada a: ' }), ...invitation.audiences.map(name => element('strong', { className: 'ivt-chip', text: name }))]),
    ]),
    element('a', { className: 'button-quiet', href: invitation.manage, text: 'Ver invitados' }),
  ]);
  card.append(facts);

  if (totals) {
    const stats = [['Invitados', totals.invitados], ['Confirmaron', totals.si], ['No asistirán', totals.no], ['Sin respuesta', totals.pendiente], ['Abrieron su enlace', totals.abrieron], ['Por aprobar', totals.porAprobar]];
    card.append(element('dl', { className: 'ivt-stats' }, stats.map(([label, value]) => element('div', {}, [element('dt', { text: label }), element('dd', { text: String(value) })]))));
  }

  const tabs = element('div', { className: 'ivt-tabs', role: 'tablist', 'aria-label': `Pantallas de ${title}` });
  const frame = element('iframe', { className: 'ivt-phone__screen', title: `Vista previa: ${invitation.screens[0].label}`, loading: 'lazy', referrerpolicy: 'no-referrer', tabindex: '-1' });
  const note = element('p', { className: 'ivt-note' });
  const open = element('a', { className: 'button-quiet', target: '_blank', rel: 'noopener', text: 'Abrir en otra pestaña' });
  const select = screen => {
    frame.src = screen.path;
    frame.title = `Vista previa: ${screen.label}`;
    note.textContent = screen.note;
    open.href = screen.path;
    for (const tab of tabs.children) tab.setAttribute('aria-selected', String(tab.dataset.key === screen.key));
  };
  for (const screen of invitation.screens) {
    const tab = element('button', { type: 'button', role: 'tab', 'data-key': screen.key, 'aria-selected': 'false', text: screen.label });
    tab.addEventListener('click', () => select(screen));
    tabs.append(tab);
  }
  card.append(element('div', { className: 'ivt-preview' }, [
    tabs,
    element('div', { className: 'ivt-preview__stage' }, [
      element('div', { className: 'ivt-phone' }, [frame]),
      element('div', { className: 'ivt-preview__side' }, [note, element('p', { className: 'ivt-hint', text: 'La vista previa usa un nombre de muestra («Tu nombre») y no abre ni responde ninguna invitación real.' }), open]),
    ]),
  ]));
  select(invitation.screens[0]);
  return card;
}

export async function initializeInvitaciones() {
  const root = document.querySelector('[data-admin-invitaciones]');
  if (!root) return;
  const feedback = root.querySelector('[data-admin-feedback]');
  const list = root.querySelector('[data-invitations]');
  const configured = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const client = createInvitacionesClient(location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase);
  try {
    const session = await client.session();
    if (!session.authenticated) { location.replace('/admin/'); return; }
    root.querySelector('[data-admin-user]').textContent = `Sesión de ${session.user.full_name ?? session.user.username}`;
    const [creadores, nuevos] = await Promise.all([client.list('creador'), client.list('nuevo').catch(() => null)]);
    const today = ecuadorToday();
    list.replaceChildren(...INVITATIONS.map(invitation => renderInvitation(invitation, creadores?.event, combineTotals(creadores, nuevos ?? {}), today)));
    list.append(element('article', { className: 'ivt-card ivt-card--new' }, [
      element('p', { className: 'ivt-state', 'data-state': 'proxima', text: 'En preparación' }),
      element('h2', { text: 'Nueva invitación' }),
      element('p', { text: 'La próxima invitación aparecerá aquí con su diseño para revisarlo antes de enviarlo. Podrás mandarla a creadores, a medios o a los dos.' }),
    ]));
    feedback.textContent = '';
  } catch (error) {
    feedback.textContent = error.message;
    if (error.status === 401) location.replace('/admin/');
    else root.querySelector('[data-session-retry]').hidden = false;
  } finally {
    list.removeAttribute('aria-busy');
  }
  root.querySelector('[data-session-retry]').addEventListener('click', () => location.reload());
}

if (typeof document !== 'undefined') initializeInvitaciones();
