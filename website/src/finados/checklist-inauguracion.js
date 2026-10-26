import { resolveRuntimeOrigins } from './runtime-origins.mjs';

const TL=[
 ["10h30","Prueba de sonido, pantalla y streaming"],
 ["11h00","Tarima limpia, señalética puesta, acreditación de prensa abierta"],
 ["11h30","Ingreso de periodistas con QR · go / no go del coordinador",1],
 ["11h45","Llegada y ubicación de autoridades y embajadores"],
 ["12h00","Inicio del acto · bienvenida del MC",1],
 ["12h05","Himno Nacional"],
 ["12h10","Intervenciones de autoridades"],
 ["12h35","Corte de cinta · Finados 2026 inaugurada",1],
 ["12h45","Cierre del acto e invitación a la noche del recuerdo"],
 ["12h45–12h55","Entrevistas con el Abg. Chango (10 min)",1],
 ["13h00","Almuerzo de periodistas"],
 ["14h00","Recorrido de la feria con medios que deseen cubrir"]
];

const GATES=[
 ["Mié 28","Confirmaciones cerradas: autoridades, medios acreditados, embajadores, discursos y lugar del almuerzo"],
 ["Jue 29","Montaje y ensayo: tarima, backing, sonido, pantalla y señalética; ensayo con el MC y los dos videos"],
 ["Vie 10h30","Prueba final de sonido, pantalla, streaming e internet de medios"],
 ["Vie 11h30","Go / no go: cada responsable de área reporta al coordinador general"],
 ["Vie tarde","Cierre: resultados del acto llenados para el informe"]
];

const RISKS=[
 ["Se cae el internet de medios o del streaming","Redes separadas para medios y streaming, con respaldo móvil probado"],
 ["Falla un micrófono","Micrófono de cable listo en la tarima"],
 ["Un video no se reproduce","Copia en USB y en una segunda laptop junto al operador"],
 ["Una autoridad se retrasa o no llega","Tolerancia de espera definida y el MC ajusta el orden de intervenciones"],
 ["El acto se alarga","Tiempo máximo por orador y señal acordada para cerrar"],
 ["Medios fuera de su zona","Seguridad y el punto de contacto los reubican sin interrumpir el acto"],
 ["Un embajador no llega","El reconocimiento se entrega igual y se anuncia en el acto"]
];

const KPIS=[
 ["Hora real de inicio","12h00"],
 ["Duración del acto",""],
 ["Medios acreditados",""],
 ["Medios transmitiendo en vivo",""],
 ["Autoridades presentes",""],
 ["Embajadores presentes","4"],
 ["Notas publicadas por medios",""],
 ["Visualizaciones del live oficial",""]
];

/* flags: c = confirmar, k = crítico */
const S=[
 {id:"prensa",t:"Prensa y medios",c:"var(--fucsia)",wide:1,obj:"Cada medio entra ordenado, trabaja en su zona y se lleva la nota.",note:"Tarima de prensa solo para medios que transmiten en vivo. El resto va a la zona identificada en gradas.",items:[
  ["Registro de medios cerrado y lista de acreditados impresa como respaldo"],
  ["Control de ingreso: cada periodista presenta el QR generado en el registro","k"],
  ["Persona y celular/lector cargado en el ingreso de prensa para validar QR"],
  ["Lista cerrada de medios que transmiten en vivo (únicos en la tarima de prensa)","k"],
  ["Internet dedicado para medios en vivo: red, clave entregada y velocidad probada","k"],
  ["Puntos de corriente y regletas en la tarima de prensa"],
  ["Zona de prensa en gradas delimitada e identificada con señalética","k"],
  ["Espacio de entrevistas armado: backing, luz y micrófono"],
  ["Entrevistas con el Abg. Chango: 10 min al finalizar, persona que ordena los turnos","k"],
  ["Almuerzo de periodistas: lugar definido","ck"],
  ["Almuerzo de periodistas: número de platos y hora","c"],
  ["Recorrido con medios que deseen cubrir la feria: guía, ruta y duración"],
  ["Kit de prensa: boletín enviado por WhatsApp, link del Drive de fotos oficiales, datos clave, programación del día y contactos"],
  ["Punto de contacto con medios y seguridad para que no se desplacen fuera de sus zonas asignadas","k"]
 ]},
 {id:"embajadores",t:"Embajadores de marca",c:"var(--wayna)",wide:1,obj:"Los cuatro embajadores llegan, están ubicados y reciben su reconocimiento.",note:"Estar al tanto de ellos durante todo el acto: llegada, ubicación y acompañamiento.",items:[
  ["Helen Quiñonez"],["Karla Medrano"],["César Legisamo"],["Sebastián Guayasamín"],
  ["Reconocimiento de embajadores a la feria listo","k"]
 ]},
 {id:"programa",t:"Programa del acto",c:"var(--morada)",obj:"Un acto ágil, con guion cerrado y tiempos controlados.",items:[
  ["Guion del maestro de ceremonias aprobado e impreso (2 copias)","k"],
  ["Orden de intervenciones y tiempo máximo por orador","ck"],
  ["Discursos confirmados con cada autoridad","c"],
  ["Número artístico de apertura (si aplica)","c"],
  ["Coordinar modelos y ropa para la pasarela y los barros"],
  ["Video conceptual listo para pasar en la inauguración","k"],
  ["Video collage de saludos listo para pasar en la inauguración","k"]
 ]},
 {id:"protocolo",t:"Protocolo",c:"var(--noche)",obj:"Cada autoridad recibida, ubicada y atendida según precedencia.",items:[
  ["Lista de autoridades e invitados confirmados (actualizar el jueves)","ck"],
  ["Coordinar la llegada del Abg. Chango: hora, ingreso y quién lo recibe","k"],
  ["Orden de precedencia definido","k"],
  ["Sillas reservadas con nombre en primera fila"],
  ["Protocolo recibe y sienta a cada persona en su lugar asignado","k"],
  ["Parqueo reservado para autoridades y prensa"],
  ["Ruta de ingreso y salida de autoridades sin cruzar al público"]
 ]},
 {id:"tarima",t:"Tarima",c:"var(--rojo)",obj:"Escenario seguro, limpio y con la imagen de la feria.",items:[
  ["Estructura revisada y asegurada: capacidad, escaleras y barandas","k"],
  ["Backing de cintas con logo"],
  ["Pantalla para los videos probada, con copia de respaldo en USB"],
  ["Cables recogidos y tarima despejada"],
  ["Señalética: tarima de prensa, gradas de prensa, zona de entrevistas"],
  ["Limpieza final a las 11h00"]
 ]},
 {id:"sonido",t:"Sonido",c:"var(--wayna)",obj:"Audio claro desde la primera palabra, con respaldo.",items:[
  ["Prueba de sonido completa a las 10h30","k"],
  ["2 micrófonos inalámbricos + 1 de cable de respaldo, pilas nuevas","k"],
  ["Playlist de ingreso y de espera aprobada"],
  ["Monitores en la tarima"],
  ["Operador de sonido con copia del guion y entradas marcadas"]
 ]},
 {id:"cobertura",t:"Cobertura",c:"var(--cian)",obj:"El acto queda registrado, transmitido y publicado el mismo día.",items:[
  ["Cobertura de foto y video del acto"],
  ["Streaming del acto en vivo","k"],
  ["Publicaciones del día"]
 ]},
 {id:"logistica",t:"Logística y seguridad",c:"var(--rojo)",obj:"Público, prensa y autoridades seguros y atendidos.",items:[
  ["Seguridad en ingresos, tarima y zona de prensa","k"],
  ["Punto de primeros auxilios activo","k"],
  ["Baños habilitados y limpios"],
  ["Agua para autoridades, prensa y equipo"],
  ["Radios de comunicación entre coordinadores"],
  ["Plan B por lluvia definido","c"]
 ]}
];

/* Las marcas viven en el servidor: todos los que abren el enlace ven y marcan lo mismo.
   Clave = tipo__id (c marca, r responsable, o responsable de área, g hito, k indicador). */
const BOARD = 'inauguracion-2026';
const { apiBase } = resolveRuntimeOrigins();
const URL_BOARD = `${apiBase}/checklist/${BOARD}`;
const HIDE_KEY = 'finados-checklist-ocultar';
let server = {};            // último estado recibido
const pending = {};         // cambios propios que aún no confirma el servidor
let hide = false;
try { hide = localStorage.getItem(HIDE_KEY) === '1'; } catch (e) {}
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const note = document.getElementById('syncNote');
function setNote(text, bad) { note.textContent = text; note.classList.toggle('bad', !!bad); }

function value(key) { return key in pending ? pending[key] : (server[key] ?? ''); }
function kpi(i) { try { const v = JSON.parse(value('k__' + i) || 'null'); if (v && typeof v === 'object') return v; } catch (e) {} return null; }

const timers = {}, chains = {};
function save(key, val, delay = 0) {
  pending[key] = val;
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    const sent = pending[key];
    chains[key] = (chains[key] || Promise.resolve()).then(async () => {
      const response = await fetch(URL_BOARD, { method: 'POST', mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: sent }) });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      server = data.items || {};
      if (pending[key] === sent) delete pending[key];
      setNote('Guardado. Todos los que abren este enlace ven lo mismo.');
      paint();
    }).catch(() => setNote('No se pudo guardar el último cambio. Revisa tu conexión y vuelve a marcarlo.', true));
  }, delay);
}

/* minuto a minuto */
const tl = document.getElementById('tl');
TL.forEach(([h, t, k]) => { const li = document.createElement('li'); if (k) li.className = 'key'; li.innerHTML = `<b>${h}</b><span>${t}</span>`; tl.appendChild(li); });

/* hitos */
const gEl = document.getElementById('gates');
GATES.forEach(([w, t], i) => {
  const li = document.createElement('li'); li.className = 'gate';
  li.innerHTML = `<input type="checkbox" id="gc-g${i}" aria-label="Hito cumplido"><div><div class="when">${w}</div><div class="gtxt">${t}</div></div>`;
  const cb = li.querySelector('input');
  cb.addEventListener('change', () => { save('g__g' + i, cb.checked ? '1' : ''); li.classList.toggle('done', cb.checked); });
  gEl.appendChild(li);
});

/* riesgos */
const rEl = document.getElementById('risks');
RISKS.forEach(([r, a]) => { const li = document.createElement('li'); li.className = 'risk'; li.innerHTML = `<b>${r}</b><span>${a}</span>`; rEl.appendChild(li); });

/* resultados */
const kEl = document.getElementById('kpis');
KPIS.forEach(([n], i) => {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${n}</td><td><input id="km-${i}" type="text" maxlength="120" aria-label="Meta ${n}"></td><td><input id="kr-${i}" type="text" maxlength="120" aria-label="Real ${n}"></td>`;
  const im = tr.querySelector(`#km-${i}`), ir = tr.querySelector(`#kr-${i}`);
  const upd = () => save('k__' + i, JSON.stringify({ m: im.value, r: ir.value }), 700);
  im.addEventListener('input', upd); ir.addEventListener('input', upd);
  kEl.appendChild(tr);
});

/* áreas */
const grid = document.getElementById('grid'), tiles = document.getElementById('tiles');
S.forEach(s => {
  const card = document.createElement('section');
  card.className = 'box card' + (s.wide ? ' wide' : ''); card.style.setProperty('--c', s.c); card.id = 'area-' + s.id; card.dataset.sec = s.id;
  card.innerHTML = `<div class="chead"><h2>${s.t}</h2><span class="cprog"></span><p class="cobj"><strong>Objetivo:</strong> ${s.obj}</p><label class="owner" for="o-${s.id}">Responsable de área<input id="o-${s.id}" type="text" maxlength="120" placeholder="Nombre"></label></div>${s.note ? `<p class="cnote">${s.note}</p>` : ''}<ul class="items"></ul>`;
  const ow = card.querySelector('.owner input');
  ow.addEventListener('input', () => { save('o__' + s.id, ow.value, 700); update(); });
  const ul = card.querySelector('ul');
  s.items.forEach(([txt, f = ''], i) => {
    const id = `${s.id}-${i}`;
    const li = document.createElement('li'); li.className = 'item'; li.dataset.id = id; if (f.includes('k')) li.dataset.k = '1';
    const flags = (f.includes('k') ? '<span class="flag k">Crítico</span>' : '') + (f.includes('c') ? '<span class="flag">Confirmar</span>' : '');
    li.innerHTML = `<input type="checkbox" id="c-${id}"><div class="itxt"><label for="c-${id}">${txt}${flags}</label><input class="resp" id="r-${id}" type="text" maxlength="120" placeholder="Responsable" aria-label="Responsable"></div>`;
    const cb = li.querySelector('input[type=checkbox]'), rp = li.querySelector('.resp');
    cb.addEventListener('change', () => { save('c__' + id, cb.checked ? '1' : ''); update(); });
    rp.addEventListener('input', () => save('r__' + id, rp.value, 700));
    ul.appendChild(li);
  });
  grid.appendChild(card);

  const tile = document.createElement('button'); tile.type = 'button'; tile.className = 'tile'; tile.dataset.sec = s.id;
  tile.innerHTML = `<span class="tn">${s.t}</span><span class="tr"></span><span class="tf"><span class="tp"></span><span class="pill"></span></span>`;
  tile.addEventListener('click', () => card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  tiles.appendChild(tile);
});

/* Lleva el estado a los controles sin pisar lo que alguien está escribiendo. */
function fill(el, val) { if (document.activeElement !== el) el.value = val ?? ''; }
function paint() {
  GATES.forEach((_, i) => { const cb = document.getElementById('gc-g' + i); cb.checked = !!value('g__g' + i); cb.closest('.gate').classList.toggle('done', cb.checked); });
  KPIS.forEach(([, m], i) => { const v = kpi(i) || { m, r: '' }; fill(document.getElementById('km-' + i), v.m); fill(document.getElementById('kr-' + i), v.r); });
  S.forEach(s => {
    fill(document.getElementById('o-' + s.id), value('o__' + s.id));
    s.items.forEach((_, i) => { const id = `${s.id}-${i}`; document.getElementById('c-' + id).checked = !!value('c__' + id); fill(document.getElementById('r-' + id), value('r__' + id)); });
  });
  update();
}

function update() {
  let tot = 0, done = 0; const crit = [];
  S.forEach(s => {
    const card = document.getElementById('area-' + s.id), items = card.querySelectorAll('.item');
    let d = 0, kp = 0;
    items.forEach(li => { const ok = !!value('c__' + li.dataset.id); li.classList.toggle('done', ok); if (ok) d++;
      else if (li.dataset.k) { kp++; crit.push([s.t, li.querySelector('label').childNodes[0].textContent]); } });
    card.querySelector('.cprog').textContent = `${d}/${items.length}`;
    card.classList.toggle('complete', d === items.length);
    tot += items.length; done += d;
    const tile = tiles.querySelector(`[data-sec="${s.id}"]`), pill = tile.querySelector('.pill');
    tile.querySelector('.tp').textContent = `${d}/${items.length}`;
    tile.querySelector('.tr').textContent = value('o__' + s.id) || 'Sin responsable';
    const state = d === items.length ? ['ok', 'Listo'] : kp ? ['crit', kp + ' crítico' + (kp > 1 ? 's' : '')] : ['warn', 'En curso'];
    pill.className = 'pill ' + state[0]; pill.textContent = state[1];
  });
  document.getElementById('ptxt').textContent = `${done} / ${tot} · ${tot ? Math.round(done * 100 / tot) : 0}%`;
  document.getElementById('pbar').style.width = (tot ? done * 100 / tot : 0) + '%';
  const cl = document.getElementById('critList'); cl.innerHTML = '';
  document.getElementById('critCount').textContent = crit.length ? `${crit.length} pendiente${crit.length > 1 ? 's' : ''}` : 'Todo cerrado';
  if (!crit.length) cl.innerHTML = '<li class="empty">Todos los puntos críticos están cerrados.</li>';
  crit.forEach(([a, t]) => { const li = document.createElement('li'); li.innerHTML = `<span class="area">${esc(a)}</span><span>${esc(t)}</span>`; cl.appendChild(li); });
  grid.classList.toggle('hide-done', hide);
  const b = document.getElementById('btnHide'); b.classList.toggle('on', hide); b.textContent = hide ? 'Mostrar todo' : 'Ocultar lo listo';
}
document.getElementById('btnHide').onclick = () => { hide = !hide; try { localStorage.setItem(HIDE_KEY, hide ? '1' : '0'); } catch (e) {} update(); };
const cbox = document.getElementById('confirmBox');
document.getElementById('btnReset').onclick = () => { cbox.hidden = false; };
document.getElementById('noReset').onclick = () => { cbox.hidden = true; };
document.getElementById('yesReset').onclick = () => {
  cbox.hidden = true;
  Object.keys({ ...server, ...pending }).forEach(key => save(key, ''));
  paint();
};

/* Trae el estado compartido; mientras la página está a la vista se pone al día cada 8 s. */
async function load() {
  try {
    const response = await fetch(URL_BOARD, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    server = (await response.json()).items || {};
    setNote('Tablero compartido: todos los que abren este enlace ven y marcan lo mismo.');
    paint();
  } catch (e) { setNote('Sin conexión con el tablero. Las marcas no se están guardando; recarga la página.', true); }
}
paint(); load();
setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });

const target = new Date('2026-10-30T12:00:00-05:00').getTime();
function tick() {
  const ms = target - Date.now(), el = document.getElementById('cd');
  if (ms <= 0) { el.textContent = '¡En marcha!'; return; }
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  el.textContent = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}
tick(); setInterval(tick, 30000);
