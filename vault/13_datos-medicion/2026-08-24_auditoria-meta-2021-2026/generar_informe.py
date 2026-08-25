#!/usr/bin/env python3
"""Genera un informe HTML autónomo con SVG estático y datos locales."""

from __future__ import annotations

import csv
import html
from pathlib import Path


BASE = Path(__file__).resolve().parent
DATA = BASE / "datos"
OUT = BASE / "2026-08-24_informe-ejecutivo-meta-2021-2026_v01.html"


def read_csv(name: str) -> list[dict]:
    with (DATA / name).open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


organic = read_csv("resumen_eventos_organico.csv")
paid = read_csv("pauta_eventos_parcial.csv")
formats = read_csv("resumen_formatos.csv")
phases = [row for row in read_csv("resumen_fases.csv") if row["evento"] == "finados-2025"]


def esc(value) -> str:
    return html.escape(str(value), quote=True)


def sourced(value, source: str, cls: str = "") -> str:
    return f'<span class="source {esc(cls)}" tabindex="0" data-source="{esc(source)}">{esc(value)}</span>'


def money(value: float) -> str:
    return f"USD {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def integer(value: float) -> str:
    return f"{int(round(value)):,}".replace(",", ".")


def decimal(value: float, digits: int = 1) -> str:
    return f"{value:,.{digits}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def bar_svg(rows: list[dict], label_key: str, value_key: str, source: str, color: str, formatter, title: str) -> str:
    width = 850
    left = 175
    right = 115
    row_h = 46
    height = 58 + row_h * len(rows)
    values = [float(row[value_key]) for row in rows]
    maximum = max(values) if values else 1
    plot_w = width - left - right
    chunks = [f'<svg class="chart" viewBox="0 0 {width} {height}" role="img" aria-label="{esc(title)}">']
    chunks.append(f"<title>{esc(title)}. Fuente: {esc(source)}</title>")
    for index, row in enumerate(rows):
        y = 36 + index * row_h
        value = float(row[value_key])
        bar_w = max(2, plot_w * value / maximum)
        label = row[label_key]
        display = formatter(value)
        tip = f"{label}: {display}. Fuente: {source}"
        chunks.append(f'<g class="datum" tabindex="0"><title>{esc(tip)}</title>')
        chunks.append(f'<text x="0" y="{y + 15}" class="axis-label">{esc(label)}</text>')
        chunks.append(f'<rect x="{left}" y="{y}" width="{bar_w:.1f}" height="22" rx="4" fill="{color}"/>')
        chunks.append(f'<text x="{left + bar_w + 9:.1f}" y="{y + 16}" class="value-label">{esc(display)}</text></g>')
    chunks.append("</svg>")
    return "".join(chunks)


def paired_svg(events: list[str]) -> str:
    rows = []
    for event in events:
        event_rows = [row for row in formats if row["evento"] == event]
        lookup = {row["formato"]: float(row["interacciones_mediana"]) for row in event_rows}
        label = next(row["etiqueta"] for row in organic if row["evento"] == event)
        rows.append((label, lookup.get("added_video", 0), lookup.get("added_photos", 0)))
    width, left, right, row_h = 850, 175, 100, 62
    height = 75 + row_h * len(rows)
    maximum = max(max(video, photo) for _, video, photo in rows)
    plot_w = width - left - right
    source = "datos/resumen_formatos.csv; mediana de interacciones públicas por pieza"
    chunks = [f'<svg class="chart" viewBox="0 0 {width} {height}" role="img" aria-label="Mediana de video frente a fotografía">']
    chunks.append(f"<title>Comparación de video y fotografía. Fuente: {esc(source)}</title>")
    chunks.append('<rect x="175" y="10" width="14" height="14" rx="3" fill="#d8662f"/><text x="196" y="22" class="legend">Video</text>')
    chunks.append('<rect x="260" y="10" width="14" height="14" rx="3" fill="#2c7a7b"/><text x="281" y="22" class="legend">Foto</text>')
    for index, (label, video, photo) in enumerate(rows):
        y = 48 + index * row_h
        chunks.append(f'<text x="0" y="{y + 24}" class="axis-label">{esc(label)}</text>')
        for offset, value, color, kind in ((0, video, "#d8662f", "video"), (26, photo, "#2c7a7b", "foto")):
            bar_w = max(2, plot_w * value / maximum)
            tip = f"{label}, {kind}: mediana {decimal(value)}. Fuente: {source}"
            chunks.append(f'<g class="datum" tabindex="0"><title>{esc(tip)}</title><rect x="{left}" y="{y + offset}" width="{bar_w:.1f}" height="18" rx="4" fill="{color}"/><text x="{left + bar_w + 8:.1f}" y="{y + offset + 14}" class="value-label">{esc(decimal(value))}</text></g>')
    chunks.append("</svg>")
    return "".join(chunks)


organic_recent = [row for row in organic if row["evento"] in {"carnaval-2022", "carnaval-2023", "carnaval-2024", "carnaval-2025", "finados-2025", "carnaval-2026"}]
spend_rows = [{"label": row["etiqueta"], "value": row["gasto_observado_usd"]} for row in paid]
median_rows = [{"label": row["etiqueta"], "value": row["interacciones_mediana"]} for row in organic_recent]
phase_volume = [{"label": row["fase"], "value": row["publicaciones_por_dia_activo"]} for row in phases]
phase_median = [{"label": row["fase"], "value": row["interacciones_mediana"]} for row in phases]

total_spend = sum(float(row["gasto_observado_usd"]) for row in paid)
total_impressions = sum(float(row["impresiones"]) for row in paid)
total_link_clicks = sum(float(row["clics_enlace"]) for row in paid)
total_messages = sum(float(row["conversaciones_iniciadas_7d"]) for row in paid)

paid_table = []
for row in paid:
    source = "datos/pauta_eventos_parcial.csv; cuenta ExpoFeria, agregado mensual parcial"
    paid_table.append(
        "<tr>"
        f"<th>{esc(row['etiqueta'])}</th>"
        f"<td>{sourced(row['meses_incluidos'].replace('|', ' · '), source)}</td>"
        f"<td>{sourced(money(float(row['gasto_observado_usd'])), source)}</td>"
        f"<td>{sourced(integer(float(row['impresiones'])), source)}</td>"
        f"<td>{sourced(integer(float(row['clics_enlace'])), source)}</td>"
        f"<td>{sourced(money(float(row['cpc_enlace_usd'])), source)}</td>"
        f"<td>{sourced(integer(float(row['conversaciones_iniciadas_7d'])), source)}</td>"
        f"<td>{sourced(money(float(row['costo_conversacion_usd'])), source)}</td>"
        "</tr>"
    )

html_doc = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Auditoría Meta 2021–2026 · Mushuc Runa</title>
<style>
:root{{--bg:#f3f0e8;--paper:#fffdf7;--ink:#17212b;--muted:#5d6870;--line:#d9d4c7;--gold:#c9952f;--orange:#d8662f;--teal:#2c7a7b;--navy:#173f5f;--soft:#ebe6d9;--danger:#9a3d2f;--shadow:0 16px 45px rgba(23,33,43,.10)}}
*{{box-sizing:border-box}} html{{scroll-behavior:smooth}} body{{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}}
.page{{max-width:1180px;margin:auto;padding:28px 24px 80px}} .hero{{background:var(--navy);color:#fff;border-radius:24px;padding:48px;box-shadow:var(--shadow);position:relative;overflow:hidden}} .hero:after{{content:"";position:absolute;right:-70px;top:-90px;width:280px;height:280px;border:42px solid rgba(201,149,47,.32);border-radius:50%}}
.eyebrow{{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:#f1c76f;font-weight:800}} h1{{font-size:clamp(2.2rem,6vw,4.9rem);line-height:.96;letter-spacing:-.055em;max-width:900px;margin:.2em 0}} .lede{{font-size:1.2rem;max-width:800px;color:#dce7ef}}
.meta{{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}} .pill{{border:1px solid rgba(255,255,255,.32);padding:7px 11px;border-radius:999px;font-size:.84rem}}
.alert{{margin:24px 0;background:#fff3cf;border-left:5px solid var(--gold);padding:18px 20px;border-radius:10px;color:#3e3421}} .grid{{display:grid;gap:18px}} .kpis{{grid-template-columns:repeat(4,1fr);margin:24px 0}} .card,.section{{background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:0 8px 24px rgba(23,33,43,.05)}} .card{{padding:20px}} .kpi{{font-size:2rem;font-weight:850;letter-spacing:-.04em;color:var(--navy)}} .label{{font-size:.82rem;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:700}}
.section{{padding:32px;margin-top:22px}} h2{{font-size:clamp(1.55rem,3vw,2.3rem);letter-spacing:-.035em;margin:0 0 10px}} h3{{margin:28px 0 8px}} .sub{{color:var(--muted);max-width:860px}} .two{{grid-template-columns:1fr 1fr}} .finding{{border-top:3px solid var(--gold)}} .finding strong{{display:block;font-size:1.08rem;margin-bottom:7px}} .finding p{{margin:0;color:var(--muted)}}
.chart{{width:100%;height:auto;overflow:visible}} .axis-label{{font:600 13px system-ui;fill:currentColor}} .value-label{{font:750 12px system-ui;fill:currentColor}} .legend{{font:600 12px system-ui;fill:currentColor}} .datum{{outline:none}} .datum:focus rect,.datum:hover rect{{filter:brightness(1.12);stroke:currentColor;stroke-width:1}}
.chart-wrap{{padding:16px 0 0}} table{{width:100%;border-collapse:collapse;font-size:.9rem}} th,td{{text-align:right;padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}} th:first-child,td:first-child{{text-align:left}} thead th{{color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.06em}} .table-scroll{{overflow-x:auto}}
.source{{position:relative;text-decoration:underline dotted;text-underline-offset:3px;cursor:help;outline:none}} .source:after{{content:attr(data-source);position:absolute;z-index:10;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%);width:min(320px,75vw);background:#14212c;color:#fff;padding:9px 11px;border-radius:8px;font-size:.72rem;line-height:1.35;font-weight:500;opacity:0;pointer-events:none;transition:.15s;box-shadow:var(--shadow)}} .source:hover:after,.source:focus:after{{opacity:1}}
.decision{{display:grid;grid-template-columns:48px 1fr;gap:14px;padding:18px 0;border-bottom:1px solid var(--line)}} .decision:last-child{{border:0}} .icon{{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--navy);color:#fff;font-weight:850}} .decision h3{{margin:0 0 4px;font-size:1.05rem}} .decision p{{margin:0;color:var(--muted)}}
.timeline{{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:18px}} .stage{{padding:16px;border-radius:12px;background:var(--soft);border-top:5px solid var(--teal)}} .stage b{{display:block}} .stage span{{font-size:.84rem;color:var(--muted)}}
.caveat{{font-size:.82rem;color:var(--muted)}} footer{{padding:34px 10px;color:var(--muted);font-size:.83rem}} a{{color:var(--teal)}}
@media(max-width:900px){{.kpis,.two{{grid-template-columns:1fr 1fr}}.timeline{{grid-template-columns:1fr 1fr}}.hero{{padding:34px}}}} @media(max-width:600px){{.page{{padding:14px 12px 50px}}.kpis,.two,.timeline{{grid-template-columns:1fr}}.hero{{padding:28px 22px}}.section{{padding:22px}}}}
@media(prefers-color-scheme:dark){{:root{{--bg:#11171c;--paper:#182129;--ink:#edf3f5;--muted:#aebbc2;--line:#34414a;--soft:#222e36;--shadow:none}}.alert{{background:#44391d;color:#fff0bd}}}}
@media print{{body{{background:#fff}}.page{{max-width:none}}.hero,.section,.card{{box-shadow:none;break-inside:avoid}}.source:after{{display:none}}}}
</style>
</head>
<body>
<main class="page">
<header class="hero">
  <div class="eyebrow">Inteligencia de marketing · informe ejecutivo</div>
  <h1>Meta {sourced('2021–2026','Rango solicitado; la cobertura efectiva varía por activo')}</h1>
  <p class="lede">Qué funcionó, qué se degradó y cómo convertir el aprendizaje histórico en una estrategia digital rigurosa para Finados {sourced('2026','Expediente vault/11_eventos/2026_feria-finados')}.</p>
  <div class="meta"><span class="pill">Solo lectura</span><span class="pill">Sin credenciales guardadas</span><span class="pill">Corte {sourced('24 ago 2026','metadata_extraccion.json y metadata_extraccion_pauta.json')}</span></div>
</header>

<div class="alert"><strong>Seguridad Meta:</strong> la extracción se detuvo al primer límite de aplicación. No fue un baneo; el encabezado de uso de la cuenta publicitaria marcó {sourced('0%','datos/metadata_extraccion_pauta.json; x-ad-account-usage')} y no se hicieron más solicitudes.</div>

<section class="grid kpis" aria-label="Indicadores de alcance">
  <article class="card"><div class="label">Publicaciones</div><div class="kpi">{sourced('1.414','datos/calidad_datos.json; publicaciones_fuente')}</div><p>Dos páginas, sin IDs duplicados.</p></article>
  <article class="card"><div class="label">Pauta observada</div><div class="kpi">{sourced(money(total_spend),'datos/pauta_eventos_parcial.csv; solo cuenta ExpoFeria y meses recuperados')}</div><p>Es un mínimo, no el gasto histórico total.</p></article>
  <article class="card"><div class="label">Impresiones</div><div class="kpi">{sourced(decimal(total_impressions/1_000_000,2)+' M','datos/pauta_eventos_parcial.csv; suma de impresiones')}</div><p>{sourced(integer(total_link_clicks),'datos/pauta_eventos_parcial.csv; clics de enlace')} clics de enlace observados.</p></article>
  <article class="card"><div class="label">Conversaciones</div><div class="kpi">{sourced(integer(total_messages),'datos/pauta_eventos_parcial.csv; conversaciones iniciadas con ventana 7d')}</div><p>Atribuidas por Meta, no ventas.</p></article>
</section>

<section class="section">
  <h2>La lectura en una frase</h2>
  <p class="sub">La música consigue atención, el video multiplica el potencial y la utilidad puede ganar; pero el exceso de publicaciones y una medición de compra inconsistente impiden convertir volumen en aprendizaje confiable.</p>
  <div class="grid two">
    <article class="card finding"><strong>Video, con propósito</strong><p>En Finados {sourced('2025','datos/resumen_formatos.csv')}, la mediana de video fue {sourced('58,5','datos/resumen_formatos.csv; added_video')} frente a {sourced('34,5','datos/resumen_formatos.csv; added_photos')} en foto.</p></article>
    <article class="card finding"><strong>Saturación visible</strong><p>Finados {sourced('2025','datos/resumen_fases.csv')} publicó {sourced('179','datos/resumen_fases.csv; fase en-vivo')} piezas durante la feria: {sourced('35,8 por día','datos/resumen_fases.csv; publicaciones_por_dia_activo')}.</p></article>
    <article class="card finding"><strong>Totales muy concentrados</strong><p>La mejor pieza aportó {sourced('25,8%','datos/ranking_publicaciones.csv y resumen_eventos_organico.csv')} del total de Finados; las diez primeras, {sourced('51,7%','cálculo sobre datos/ranking_publicaciones.csv')}.</p></article>
    <article class="card finding"><strong>Tracking no comparable</strong><p>Finados registra {sourced('221','datos/pauta_eventos_parcial.csv; compras_meta_atribuidas')} compras Meta y Carnaval siguiente {sourced('0','datos/pauta_eventos_parcial.csv; compras_meta_atribuidas')}. La discontinuidad exige auditoría, no una conclusión comercial.</p></article>
  </div>
</section>

<section class="section">
  <h2>Pauta recuperada por ventana</h2>
  <p class="sub">Mínimo observado en la cuenta ExpoFeria. Los meses se asignaron por calendario porque el desglose de campañas no alcanzó a descargarse.</p>
  <div class="chart-wrap">{bar_svg(spend_rows,'label','value','datos/pauta_eventos_parcial.csv; gasto observado USD','#c9952f',money,'Gasto observado por ventana de evento')}</div>
  <div class="table-scroll"><table><thead><tr><th>Ventana</th><th>Meses</th><th>Gasto</th><th>Impresiones</th><th>Clics enlace</th><th>CPC enlace</th><th>Conversaciones</th><th>Costo/conv.</th></tr></thead><tbody>{''.join(paid_table)}</tbody></table></div>
  <p class="caveat">No incluye la cuenta Complejo, facturación histórica, campañas desglosadas ni períodos previos a agosto de {sourced('2023','datos/metadata_extraccion_pauta.json; limitacion_historica')}.</p>
</section>

<section class="section">
  <h2>La publicación típica cuenta otra historia</h2>
  <p class="sub">La mediana evita que una pieza viral o un concurso oculten el rendimiento del resto del inventario.</p>
  <div class="chart-wrap">{bar_svg(median_rows,'label','value','datos/resumen_eventos_organico.csv; mediana de interacciones públicas','#173f5f',lambda x: decimal(x,1),'Mediana de interacciones públicas por evento')}</div>
  <p>Finados {sourced('2025','datos/resumen_eventos_organico.csv')} logró el mayor total bruto, {sourced('110.886','datos/resumen_eventos_organico.csv; interacciones_publicas_total')}, pero una mediana de solo {sourced('38','datos/resumen_eventos_organico.csv; interacciones_mediana')}. El volumen no debe confundirse con calidad media.</p>
</section>

<section class="section">
  <h2>El patrón creativo más estable: video</h2>
  <p class="sub">El video supera a la fotografía en todas las ediciones grandes de la muestra. La recomendación es video-first, no publicar más.</p>
  <div class="chart-wrap">{paired_svg(['carnaval-2022','carnaval-2023','carnaval-2024','carnaval-2025','finados-2025','carnaval-2026'])}</div>
  <p class="caveat">Formato de publicación según `status_type` de Graph API. No controla por pauta, seguidores, tema ni calidad de producción.</p>
</section>

<section class="section">
  <h2>Finados {sourced('2025','datos/resumen_fases.csv')}: el costo editorial de saturar</h2>
  <div class="grid two">
    <div><h3>Publicaciones por día activo</h3>{bar_svg(phase_volume,'label','value','datos/resumen_fases.csv; Finados 2025','#d8662f',lambda x: decimal(x,1),'Publicaciones por día activo y fase')}</div>
    <div><h3>Mediana de interacciones</h3>{bar_svg(phase_median,'label','value','datos/resumen_fases.csv; Finados 2025','#2c7a7b',lambda x: decimal(x,1),'Mediana de interacciones por fase')}</div>
  </div>
  <p>Al pasar de consideración a cobertura en vivo, la cadencia subió de {sourced('2,1','datos/resumen_fases.csv; consideracion')} a {sourced('35,8','datos/resumen_fases.csv; en-vivo')} piezas diarias, mientras la mediana cayó de {sourced('86','datos/resumen_fases.csv; consideracion')} a {sourced('33','datos/resumen_fases.csv; en-vivo')}.</p>
</section>

<section class="section">
  <h2>Qué debe conservarse y qué debe cambiar</h2>
  <div class="decision"><div class="icon">✓</div><div><h3>Conservar emoción musical</h3><p>Artistas, canciones y escenas reconocibles son la principal puerta de entrada. Deben conectarse con la experiencia completa y una acción medible.</p></div></div>
  <div class="decision"><div class="icon">✓</div><div><h3>Convertir utilidad en creatividad</h3><p>El video de parqueaderos lideró Finados {sourced('2022','datos/ranking_publicaciones.csv; finados-2022')}: {sourced('1.784','datos/ranking_publicaciones.csv; interacciones_publicas')} interacciones y {sourced('406','datos/ranking_publicaciones.csv; compartidos')} compartidos.</p></div></div>
  <div class="decision"><div class="icon">!</div><div><h3>No escalar engagement incentivado</h3><p>El Pase Dorado generó {sourced('3.265','datos/ranking_publicaciones.csv; comentarios')} comentarios, pero el premio y la mecánica inflaron la señal. No equivale a compra.</p></div></div>
  <div class="decision"><div class="icon">!</div><div><h3>No duplicar páginas</h3><p>Los {sourced('33','datos/publicaciones_procesadas.csv; cruces de Finados en página Carnaval')} cruces aportaron solo {sourced('613','datos/publicaciones_procesadas.csv; suma de interacciones')} interacciones. Carnaval debe ser puente; Finados, destino.</p></div></div>
  <div class="decision"><div class="icon">!</div><div><h3>No declarar éxito con compras Meta</h3><p>Conciliar píxel, Conversion API, UTMs, boletería y caja antes de optimizar o reportar retorno.</p></div></div>
</section>

<section class="section">
  <h2>Arquitectura recomendada para Finados {sourced('2026','vault/11_eventos/2026_feria-finados')}</h2>
  <div class="timeline">
    <div class="stage"><b>D−{sourced('120','estrategia digital provisional')} a D−{sourced('61','estrategia digital provisional')}</b><span>Identidad, memoria y registro.</span></div>
    <div class="stage"><b>D−{sourced('60','estrategia digital provisional')} a D−{sourced('31','estrategia digital provisional')}</b><span>Experiencia, prueba y consideración.</span></div>
    <div class="stage"><b>D−{sourced('30','estrategia digital provisional')} a D−{sourced('8','estrategia digital provisional')}</b><span>Oferta por día y conversión.</span></div>
    <div class="stage"><b>D−{sourced('7','estrategia digital provisional')} a D−{sourced('1','estrategia digital provisional')}</b><span>Urgencia útil y logística.</span></div>
    <div class="stage"><b>D{sourced('0','estrategia digital provisional')} a cierre</b><span>Servicio, prueba social y recap curado.</span></div>
  </div>
  <h3>Principio creativo</h3>
  <p><strong>La música atrae. La experiencia total diferencia. La confianza convierte. La operación cumple.</strong></p>
  <h3>Guardrails</h3>
  <ul>
    <li>Una página principal de Finados y de {sourced('3 a 5','estrategia digital provisional; arquitectura de páginas')} piezas puente en Carnaval.</li>
    <li>De {sourced('4 a 6','estrategia digital provisional; cadencia en vivo')} piezas principales por día de feria como techo editorial inicial; historias para cobertura ligera.</li>
    <li>Un centro de información seguro con agenda, precios, mapa, condiciones y compra.</li>
    <li>Un solo mensaje y un solo CTA por pieza.</li>
    <li>Datos operativos publicados únicamente después de confirmación del frente dueño.</li>
  </ul>
</section>

<section class="section">
  <h2>Decisiones que dirección debe cerrar</h2>
  <ol>
    <li>Meta comercial, aforo y presupuesto.</li>
    <li>Página principal y dominio seguro.</li>
    <li>Oferta, precios, fechas y agenda confirmada.</li>
    <li>Conciliación de compra de prueba.</li>
    <li>Manual de marca y validación cultural.</li>
    <li>Capacidad de atención y protocolo de incidentes.</li>
  </ol>
  <p class="caveat">Sin estos gates, la estrategia permanece en revisión y no autoriza publicación ni pauta.</p>
</section>

<footer>
  Elaborado con datos locales derivados de Meta Graph API y Marketing API. Informe canónico: <code>2026-08-24_informe-auditoria-meta-2021-2026_v01.md</code>. Las visualizaciones son SVG estáticos basados en los mismos CSV del análisis; no dependen de servicios externos.
</footer>
</main>
</body>
</html>
"""

OUT.write_text(html_doc, encoding="utf-8")
print(f"Informe generado: {OUT}")
