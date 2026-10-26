import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, PRIMARY_API_BASE } from './runtime-origins.mjs';

export const checklistInauguracionVersion = '20261026-checklist-1';

/** Tablero público del coordinador para la inauguración: cualquiera con el enlace ve y marca. */
export function renderChecklistInauguracionPage(page) {
  const connect = apiBasesForCsp(page.adminEnvironment === 'development' ? page.adminApiBase : PRIMARY_API_BASE);
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} | Finados Mushuc Runa 2026</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src ${connect}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="theme-color" content="#391F6F">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}">
<link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="stylesheet" href="/assets/finados/checklist-inauguracion.css?v=${checklistInauguracionVersion}">
<script type="module" src="/assets/finados/checklist-inauguracion.js?v=${checklistInauguracionVersion}"></script>
</head><body>
<div class="cenefa" aria-hidden="true"><span class="cf"></span><span class="cw"></span><span class="cc"></span><span class="cm"></span><span class="cr"></span><span class="cl"></span><span class="cf"></span><span class="cw"></span><span class="cc"></span><span class="cm"></span><span class="cr"></span><span class="cl"></span></div>

<div class="wrap">
  <header>
    <div>
      <div class="eyebrow">Mushuc Runa · Finados 2026 · ¡Legado que nos une!</div>
      <h1>Inauguración <em>Finados 2026</em></h1>
      <p class="sub">Tablero del coordinador general</p>
      <div class="meta">
        <span class="chip">Viernes 30 oct 2026</span>
        <span class="chip">12h00</span>
        <span class="chip">Plaza del Sol · Complejo Mushuc Runa · Tisaleo</span>
      </div>
    </div>
    <div class="count" aria-live="polite">
      <small>Faltan para la inauguración</small>
      <div class="num" id="cd">--</div>
    </div>
  </header>

  <section class="goal" aria-label="Objetivo del acto">
    <div class="eyebrow">Objetivo del acto</div>
    <p>Abrir oficialmente la feria con autoridades, embajadores y medios en un acto puntual y ordenado, que deje la noticia del día: Finados Mushuc Runa ya inició.</p>
    <ul>
      <li>Inicio a las 12h00 y guion con tiempos controlados</li>
      <li>Cada medio trabaja en su zona y se va con entrevista, boletín y fotos oficiales</li>
      <li>Autoridades y embajadores recibidos, ubicados y reconocidos</li>
      <li>El acto se transmite y se publica el mismo día</li>
    </ul>
  </section>

  <section class="box progress" aria-label="Avance general">
    <div class="ptop">
      <span class="eyebrow">Avance general</span>
      <strong id="ptxt">0 / 0</strong>
    </div>
    <div class="bar"><i id="pbar"></i></div>
    <div class="tools">
      <button id="btnHide" type="button">Ocultar lo listo</button>
      <button id="btnReset" type="button">Reiniciar tablero</button>
      <span class="confirm" id="confirmBox" hidden>¿Borrar marcas, responsables y resultados?
        <button id="yesReset" type="button">Sí, borrar</button>
        <button id="noReset" type="button">Cancelar</button>
      </span>
    </div>
  </section>

  <section class="box" aria-label="Semáforo por área">
    <div class="bhead"><h2>Semáforo por área</h2>
      <div class="tools"><span class="pill ok">Listo</span><span class="pill warn">En curso</span><span class="pill crit">Crítico pendiente</span></div>
    </div>
    <div class="tiles" id="tiles"></div>
  </section>

  <div class="two">
    <section class="box" aria-label="Puntos críticos pendientes">
      <div class="bhead"><h2>Puntos críticos</h2><span class="tag" id="critCount">0 pendientes</span></div>
      <p class="cnote">Si uno de estos falla, el acto se resiente. Se cierran antes del go / no go de las 11h30.</p>
      <ul class="list crit-list" id="critList"></ul>
    </section>
    <section class="box" aria-label="Hitos de control">
      <div class="bhead"><h2>Hitos de control</h2><span class="tag">Propuesto</span></div>
      <ul class="list" id="gates"></ul>
    </section>
  </div>

  <div class="two">
    <section class="box" aria-label="Riesgos y respuesta">
      <div class="bhead"><h2>Riesgos y respuesta</h2></div>
      <ul class="list" id="risks"></ul>
    </section>
    <section class="box" aria-label="Resultados a medir">
      <div class="bhead"><h2>Resultados a medir</h2><span class="tag">Para el informe</span></div>
      <div class="tablewrap">
        <table class="kpi">
          <thead><tr><th>Indicador</th><th>Meta</th><th>Real</th></tr></thead>
          <tbody id="kpis"></tbody>
        </table>
      </div>
    </section>
  </div>

  <section class="box" aria-label="Minuto a minuto">
    <div class="bhead"><h2>Minuto a minuto</h2><span class="tag">Horario propuesto · ajustar</span></div>
    <ol class="tl" id="tl"></ol>
  </section>

  <div class="sect-title"><h2>Check list por área</h2><p>Detalle operativo. Cada área tiene un responsable que reporta al coordinador general.</p></div>
  <div class="grid" id="grid"></div>

  <footer><span class="sync" id="syncNote">Conectando…</span> «Confirmar» = falta cerrar el dato. «Crítico» = entra en los puntos críticos del tablero.</footer>
</div>
<noscript><p>Activa JavaScript para usar el checklist.</p></noscript>
</body></html>`;
}
