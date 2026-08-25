#!/usr/bin/env python3
"""Procesa localmente la extracción de Meta sin realizar llamadas de red.

Las métricas orgánicas son interacciones públicas absolutas; no equivalen a tasa
de engagement porque la extracción no contiene alcance orgánico por publicación.
La pauta es parcial y procede únicamente de la cuenta ExpoFeria Mushuc Runa.
"""

from __future__ import annotations

import csv
import json
import re
import statistics
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


BASE = Path(__file__).resolve().parent
DATA = BASE / "datos"
GUAYAQUIL = ZoneInfo("America/Guayaquil")

PAGE_CARNIVAL = "105221087662733"
PAGE_FINADOS = "729780340226059"

EVENTS = {
    "finados-2021": {
        "label": "Finados 2021",
        "start": date(2021, 10, 30),
        "end": date(2021, 11, 3),
        "window_start": date(2021, 9, 1),
        "window_end": date(2021, 11, 30),
        "pages": {PAGE_CARNIVAL},
        "requires_finados": True,
        "status": "histórico; fechas verificadas en publicaciones",
    },
    "carnaval-2022": {
        "label": "Carnaval 2022",
        "start": date(2022, 2, 25),
        "end": date(2022, 3, 1),
        "window_start": date(2022, 1, 1),
        "window_end": date(2022, 3, 31),
        "pages": {PAGE_CARNIVAL},
        "requires_finados": False,
        "status": "histórico; fechas verificadas en publicaciones",
    },
    "finados-2022": {
        "label": "Finados 2022",
        "start": date(2022, 11, 2),
        "end": date(2022, 11, 6),
        "window_start": date(2022, 9, 1),
        "window_end": date(2022, 11, 30),
        "pages": {PAGE_CARNIVAL},
        "requires_finados": True,
        "status": "histórico; fechas verificadas en publicaciones",
    },
    "carnaval-2023": {
        "label": "Carnaval 2023",
        "start": date(2023, 2, 17),
        "end": date(2023, 2, 21),
        "window_start": date(2023, 1, 1),
        "window_end": date(2023, 3, 31),
        "pages": {PAGE_CARNIVAL},
        "requires_finados": False,
        "status": "histórico; fechas verificadas en publicaciones",
    },
    "carnaval-2024": {
        "label": "Carnaval 2024",
        "start": date(2024, 2, 9),
        "end": date(2024, 2, 13),
        "window_start": date(2023, 12, 1),
        "window_end": date(2024, 3, 31),
        "pages": {PAGE_CARNIVAL},
        "requires_finados": False,
        "status": "histórico planificado; ejecución/resultados por confirmar",
    },
    "carnaval-2025": {
        "label": "Carnaval 2025",
        "start": date(2025, 2, 28),
        "end": date(2025, 3, 4),
        "window_start": date(2024, 12, 1),
        "window_end": date(2025, 3, 31),
        "pages": {PAGE_CARNIVAL},
        "requires_finados": False,
        "status": "histórico; fechas verificadas en publicaciones",
    },
    "finados-2025": {
        "label": "Finados 2025",
        "start": date(2025, 10, 31),
        "end": date(2025, 11, 4),
        "window_start": date(2025, 9, 1),
        "window_end": date(2025, 11, 30),
        "pages": {PAGE_CARNIVAL, PAGE_FINADOS},
        "requires_finados": False,
        "status": "histórico; fechas verificadas en publicaciones",
    },
    "carnaval-2026": {
        "label": "Carnaval 2026",
        "start": date(2026, 2, 13),
        "end": date(2026, 2, 17),
        "window_start": date(2025, 12, 1),
        "window_end": date(2026, 3, 31),
        "pages": {PAGE_CARNIVAL},
        "requires_finados": False,
        "status": "histórico; fechas verificadas en publicaciones",
    },
}

THEMES = {
    "artistas-musica": r"artista|concierto|música|musica|show|orquesta|banda|cantante|rock|cumbia|vallenat|dj|escenario",
    "experiencias-atractivos": r"granja|dinosaur|juego|atracci|canin|caballo|autos|magia|espuma|folklore|folclor|gastronom|artesan|exhibici",
    "expositores-negocios": r"expositor|emprend|stand|negocio|comercio|reactiva|marca|empresa|producto",
    "cultura-identidad": r"cultura|tradici|intercultural|indígen|indigena|ancestral|pachamama|taita|andino|comunidad",
    "precio-entradas": r"entrada|boleto|ticket|passline|compra|adquiere|valor|precio|\$\s*\d|golden|vip",
    "acceso-servicio": r"cómo llegar|como llegar|ubica|parqueadero|horario|hora|seguridad|vigilancia|baño|agua|transporte|ruta",
    "confianza-operacion": r"seguridad|bioseguridad|limpieza|vigilancia|organiza|información|informacion|comunicado|oficial|suspend",
    "comunidad-prueba": r"testimonio|memoria|gracias|familia|visitante|turista|acogida|asistencia|vivimos|recap|galería|galeria",
    "patrocinio-alianzas": r"auspicia|auspiciante|patrocin|convenio|alianza|respaldo|colabora",
    "cobertura-en-vivo": r"en vivo|transmisi|ahora|este momento|primer día|primer dia|segundo día|segundo dia|tercer día|tercer dia|cuarto día|cuarto dia|quinto día|quinto dia",
}

FINADOS_RE = re.compile(r"finados|difuntos|noviembre|cementerio|expo\s*finados", re.I)
URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)
PHONE_RE = re.compile(r"(?<!\d)(?:\+?593[\s-]?)?0?9\d{8}(?!\d)")
PRICE_RE = re.compile(r"(?:\$|usd|dólares?|dolares?)\s*\d|\d+[.,]\d{2}\s*(?:usd|dólares?|dolares?)", re.I)
DATE_RE = re.compile(r"\b(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|enero|febrero|marzo|octubre|noviembre|diciembre|\d{1,2}\s+de\s+\w+)\b", re.I)
CTA_RE = re.compile(r"compra|adquiere|reserva|escríbe|escribe|visita|ven|te esperamos|no te lo pierdas|regístrate|registrate|participa|comparte|comenta", re.I)


def load_json(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").lower()
    value = URL_RE.sub(" ", value)
    value = re.sub(r"[#@]", "", value)
    value = re.sub(r"[^\w\s$.,áéíóúüñ-]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def event_for(page_id: str, day: date, text: str) -> str:
    for key, meta in EVENTS.items():
        if page_id not in meta["pages"] or not (meta["window_start"] <= day <= meta["window_end"]):
            continue
        if meta["requires_finados"] and not FINADOS_RE.search(text):
            continue
        if key == "finados-2025" and page_id == PAGE_CARNIVAL and not FINADOS_RE.search(text):
            continue
        return key
    return "fuera-de-eventos-priorizados"


def phase_for(event: str, day: date) -> str:
    if event not in EVENTS:
        return "no-aplica"
    start = EVENTS[event]["start"]
    end = EVENTS[event]["end"]
    if day < start - timedelta(days=60):
        return "descubrimiento-temprano"
    if day < start - timedelta(days=30):
        return "consideracion"
    if day < start - timedelta(days=7):
        return "conversion"
    if day < start:
        return "urgencia"
    if day <= end:
        return "en-vivo"
    return "postevento"


def themes_for(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text or "").lower()
    found = [name for name, pattern in THEMES.items() if re.search(pattern, normalized, re.I)]
    return found or ["sin-tema-detectado"]


def median(values):
    return round(statistics.median(values), 2) if values else 0


def percentile(values: list[int], fraction: float) -> float:
    if not values:
        return 0
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return round(ordered[lower] * (1 - weight) + ordered[upper] * weight, 2)


def write_csv(name: str, rows: list[dict], fieldnames: list[str] | None = None):
    path = DATA / name
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fieldnames = fieldnames or list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def action_value(row: dict, action_type: str) -> float:
    for action in row.get("actions") or []:
        if action.get("action_type") == action_type:
            return float(action.get("value") or 0)
    return 0.0


def paid_event(day: date) -> str:
    if date(2023, 12, 1) <= day <= date(2024, 3, 31):
        return "carnaval-2024"
    if date(2025, 1, 1) <= day <= date(2025, 3, 31):
        return "carnaval-2025"
    if date(2025, 10, 1) <= day <= date(2025, 11, 30):
        return "finados-2025"
    if date(2025, 12, 1) <= day <= date(2026, 3, 31):
        return "carnaval-2026"
    return "fuera-de-eventos-priorizados"


def process_organic() -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict], list[dict], dict]:
    source = load_json("publicaciones.json")
    processed = []
    for row in source:
        created = datetime.strptime(row["created_time"], "%Y-%m-%dT%H:%M:%S%z").astimezone(GUAYAQUIL)
        day = created.date()
        message = row.get("message") or ""
        normalized = normalize_text(message)
        event = event_for(str(row.get("page_id")), day, normalized)
        themes = themes_for(message)
        processed.append(
            {
                "id": row.get("id"),
                "pagina": row.get("page_name"),
                "page_id": row.get("page_id"),
                "fecha_hora_guayaquil": created.isoformat(),
                "fecha_guayaquil": day.isoformat(),
                "evento": event,
                "fase": phase_for(event, day),
                "formato": row.get("status_type") or "desconocido",
                "interacciones_publicas": int(row.get("public_interactions") or 0),
                "reacciones": int(row.get("reactions_count") or 0),
                "comentarios": int(row.get("comments_count") or 0),
                "compartidos": int(row.get("shares_count") or 0),
                "temas": "|".join(themes),
                "tiene_url": bool(URL_RE.search(message)),
                "tiene_telefono": bool(PHONE_RE.search(message)),
                "tiene_precio": bool(PRICE_RE.search(message)),
                "tiene_fecha": bool(DATE_RE.search(message)),
                "tiene_cta": bool(CTA_RE.search(message)),
                "longitud_texto": len(message),
                "texto_normalizado": normalized,
                "mensaje": message.replace("\r", " ").replace("\n", " "),
                "permalink": row.get("permalink_url") or "",
            }
        )

    relevant = [row for row in processed if row["evento"] in EVENTS]
    by_event = defaultdict(list)
    for row in relevant:
        by_event[row["evento"]].append(row)

    summaries = []
    rankings = []
    format_rows = []
    theme_rows = []
    phase_rows = []
    for event, rows in sorted(by_event.items(), key=lambda item: EVENTS[item[0]]["start"]):
        interactions = [row["interacciones_publicas"] for row in rows]
        duplicate_counts = Counter(row["texto_normalizado"] for row in rows if len(row["texto_normalizado"]) >= 30)
        duplicate_posts = sum(count for count in duplicate_counts.values() if count > 1)
        active_days = len({row["fecha_guayaquil"] for row in rows})
        summaries.append(
            {
                "evento": event,
                "etiqueta": EVENTS[event]["label"],
                "estado_evidencia": EVENTS[event]["status"],
                "fecha_inicio": EVENTS[event]["start"].isoformat(),
                "fecha_fin": EVENTS[event]["end"].isoformat(),
                "publicaciones": len(rows),
                "dias_con_publicacion": active_days,
                "publicaciones_por_dia_activo": round(len(rows) / active_days, 2) if active_days else 0,
                "interacciones_publicas_total": sum(interactions),
                "interacciones_mediana": median(interactions),
                "interacciones_p25": percentile(interactions, 0.25),
                "interacciones_p75": percentile(interactions, 0.75),
                "reacciones_total": sum(row["reacciones"] for row in rows),
                "comentarios_total": sum(row["comentarios"] for row in rows),
                "compartidos_total": sum(row["compartidos"] for row in rows),
                "porcentaje_con_cta": round(100 * sum(row["tiene_cta"] for row in rows) / len(rows), 1),
                "porcentaje_con_precio": round(100 * sum(row["tiene_precio"] for row in rows) / len(rows), 1),
                "porcentaje_con_url": round(100 * sum(row["tiene_url"] for row in rows) / len(rows), 1),
                "publicaciones_en_copias_repetidas": duplicate_posts,
                "porcentaje_en_copias_repetidas": round(100 * duplicate_posts / len(rows), 1),
            }
        )
        for rank, row in enumerate(sorted(rows, key=lambda x: x["interacciones_publicas"], reverse=True)[:20], 1):
            rankings.append(
                {
                    "evento": event,
                    "rango": rank,
                    "id": row["id"],
                    "fecha_guayaquil": row["fecha_guayaquil"],
                    "fase": row["fase"],
                    "formato": row["formato"],
                    "interacciones_publicas": row["interacciones_publicas"],
                    "reacciones": row["reacciones"],
                    "comentarios": row["comentarios"],
                    "compartidos": row["compartidos"],
                    "temas": row["temas"],
                    "mensaje_resumen": row["mensaje"][:300],
                    "permalink": row["permalink"],
                }
            )
        for fmt in sorted({row["formato"] for row in rows}):
            subset = [row for row in rows if row["formato"] == fmt]
            format_rows.append(
                {
                    "evento": event,
                    "formato": fmt,
                    "publicaciones": len(subset),
                    "interacciones_total": sum(row["interacciones_publicas"] for row in subset),
                    "interacciones_mediana": median([row["interacciones_publicas"] for row in subset]),
                    "comentarios_mediana": median([row["comentarios"] for row in subset]),
                    "compartidos_mediana": median([row["compartidos"] for row in subset]),
                }
            )
        for theme in sorted(THEMES):
            subset = [row for row in rows if theme in row["temas"].split("|")]
            if not subset:
                continue
            theme_rows.append(
                {
                    "evento": event,
                    "tema": theme,
                    "publicaciones": len(subset),
                    "interacciones_total": sum(row["interacciones_publicas"] for row in subset),
                    "interacciones_mediana": median([row["interacciones_publicas"] for row in subset]),
                    "comentarios_mediana": median([row["comentarios"] for row in subset]),
                    "compartidos_mediana": median([row["compartidos"] for row in subset]),
                }
            )
        phase_order = ["descubrimiento-temprano", "consideracion", "conversion", "urgencia", "en-vivo", "postevento"]
        for phase in phase_order:
            subset = [row for row in rows if row["fase"] == phase]
            if not subset:
                continue
            days = len({row["fecha_guayaquil"] for row in subset})
            phase_rows.append(
                {
                    "evento": event,
                    "fase": phase,
                    "publicaciones": len(subset),
                    "dias_con_publicacion": days,
                    "publicaciones_por_dia_activo": round(len(subset) / days, 2) if days else 0,
                    "interacciones_total": sum(row["interacciones_publicas"] for row in subset),
                    "interacciones_mediana": median([row["interacciones_publicas"] for row in subset]),
                    "comentarios_mediana": median([row["comentarios"] for row in subset]),
                    "compartidos_mediana": median([row["compartidos"] for row in subset]),
                }
            )

    page_coverage = {}
    for page_id in sorted({str(row.get("page_id")) for row in source}):
        page_rows = [row for row in source if str(row.get("page_id")) == page_id]
        dates = sorted(row["created_time"] for row in page_rows)
        page_coverage[page_id] = {
            "pagina": page_rows[0].get("page_name"),
            "filas": len(page_rows),
            "primera_publicacion_utc": dates[0],
            "ultima_publicacion_utc": dates[-1],
        }

    quality = {
        "publicaciones_fuente": len(source),
        "ids_unicos": len({row.get("id") for row in source}),
        "ids_duplicados": len(source) - len({row.get("id") for row in source}),
        "mensajes_vacios": sum(not (row.get("message") or "").strip() for row in source),
        "publicaciones_en_eventos_clasificados": len(relevant),
        "cobertura_por_pagina": page_coverage,
        "zona_horaria_publicaciones_fuente": "UTC",
        "zona_horaria_analitica": "America/Guayaquil",
        "advertencia": "Interacciones absolutas, sin alcance orgánico por publicación; no calcular tasa de engagement ni atribuir causalidad a la pauta.",
    }
    return processed, summaries, rankings, format_rows, theme_rows, phase_rows, quality


def process_paid() -> tuple[list[dict], list[dict]]:
    source = load_json("pauta_mensual.json")
    monthly = []
    for row in source:
        day = date.fromisoformat(row["date_start"])
        spend = float(row.get("spend") or 0)
        impressions = int(row.get("impressions") or 0)
        clicks = int(row.get("clicks") or 0)
        link_clicks = int(row.get("inline_link_clicks") or 0)
        messages = action_value(row, "onsite_conversion.messaging_conversation_started_7d")
        first_replies = action_value(row, "onsite_conversion.messaging_first_reply")
        leads = action_value(row, "lead")
        purchases = action_value(row, "purchase")
        engagements = action_value(row, "post_engagement")
        video_views = action_value(row, "video_view")
        monthly.append(
            {
                "evento_asignado": paid_event(day),
                "cuenta": row.get("account_name"),
                "mes": row["date_start"][:7],
                "gasto_usd": spend,
                "impresiones": impressions,
                "alcance_mensual": int(row.get("reach") or 0),
                "frecuencia_mensual": float(row.get("frequency") or 0),
                "clics_todos": clicks,
                "clics_enlace": link_clicks,
                "ctr_todos_pct": round(100 * clicks / impressions, 4) if impressions else 0,
                "cpm_usd": round(1000 * spend / impressions, 4) if impressions else 0,
                "cpc_todos_usd": round(spend / clicks, 4) if clicks else None,
                "cpc_enlace_usd": round(spend / link_clicks, 4) if link_clicks else None,
                "conversaciones_iniciadas_7d": messages,
                "primeras_respuestas": first_replies,
                "leads_meta_atribuidos": leads,
                "compras_meta_atribuidas": purchases,
                "interacciones_meta": engagements,
                "reproducciones_video_meta": video_views,
                "porcentaje_interaccion_que_es_video": round(100 * video_views / engagements, 1) if engagements else 0,
            }
        )

    by_event = defaultdict(list)
    for row in monthly:
        if row["evento_asignado"] != "fuera-de-eventos-priorizados":
            by_event[row["evento_asignado"]].append(row)
    summaries = []
    for event, rows in sorted(by_event.items(), key=lambda item: EVENTS[item[0]]["start"]):
        spend = sum(row["gasto_usd"] for row in rows)
        impressions = sum(row["impresiones"] for row in rows)
        clicks = sum(row["clics_todos"] for row in rows)
        link_clicks = sum(row["clics_enlace"] for row in rows)
        messages = sum(row["conversaciones_iniciadas_7d"] for row in rows)
        leads = sum(row["leads_meta_atribuidos"] for row in rows)
        purchases = sum(row["compras_meta_atribuidas"] for row in rows)
        engagements = sum(row["interacciones_meta"] for row in rows)
        video_views = sum(row["reproducciones_video_meta"] for row in rows)
        summaries.append(
            {
                "evento": event,
                "etiqueta": EVENTS[event]["label"],
                "meses_incluidos": "|".join(row["mes"] for row in rows),
                "gasto_observado_usd": round(spend, 2),
                "impresiones": impressions,
                "alcance_mensual_sumado_no_deduplicado": sum(row["alcance_mensual"] for row in rows),
                "clics_todos": clicks,
                "clics_enlace": link_clicks,
                "ctr_todos_pct": round(100 * clicks / impressions, 3) if impressions else 0,
                "cpm_usd": round(1000 * spend / impressions, 3) if impressions else 0,
                "cpc_todos_usd": round(spend / clicks, 3) if clicks else None,
                "cpc_enlace_usd": round(spend / link_clicks, 3) if link_clicks else None,
                "conversaciones_iniciadas_7d": messages,
                "costo_conversacion_usd": round(spend / messages, 2) if messages else None,
                "leads_meta_atribuidos": leads,
                "costo_lead_meta_usd": round(spend / leads, 2) if leads else None,
                "compras_meta_atribuidas": purchases,
                "costo_compra_meta_usd": round(spend / purchases, 2) if purchases else None,
                "interacciones_meta": engagements,
                "reproducciones_video_meta": video_views,
                "porcentaje_interaccion_que_es_video": round(100 * video_views / engagements, 1) if engagements else 0,
                "cobertura": "parcial: solo cuenta ExpoFeria; agregación mensual; atribución/configuración no auditada",
            }
        )
    return monthly, summaries


def main():
    processed, organic, rankings, formats, themes, phases, quality = process_organic()
    paid_monthly, paid_events = process_paid()

    write_csv("publicaciones_procesadas.csv", processed)
    write_csv("resumen_eventos_organico.csv", organic)
    write_csv("ranking_publicaciones.csv", rankings)
    write_csv("resumen_formatos.csv", formats)
    write_csv("resumen_temas.csv", themes)
    write_csv("resumen_fases.csv", phases)
    write_csv("pauta_mensual_procesada.csv", paid_monthly)
    write_csv("pauta_eventos_parcial.csv", paid_events)

    meta_ads = load_json("metadata_extraccion_pauta.json")
    quality["pauta"] = {
        "filas_mensuales": len(paid_monthly),
        "cuentas_presentes": sorted({row["cuenta"] for row in paid_monthly}),
        "primera_fecha": min((row["mes"] for row in paid_monthly), default=None),
        "ultima_fecha": max((row["mes"] for row in paid_monthly), default=None),
        "estado_extraccion": meta_ads.get("estado"),
        "detencion": meta_ads.get("detencion"),
        "limitacion_historica": meta_ads.get("limitacion_historica"),
        "cuenta_complejo_incluida": False,
        "campanas_incluidas": False,
        "advertencia": "No interpretar acciones atribuidas como ventas auditadas; configuración del píxel, ventana y deduplicación no fueron verificadas.",
    }
    (DATA / "calidad_datos.json").write_text(json.dumps(quality, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({"organico": organic, "pauta": paid_events, "calidad": quality}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
