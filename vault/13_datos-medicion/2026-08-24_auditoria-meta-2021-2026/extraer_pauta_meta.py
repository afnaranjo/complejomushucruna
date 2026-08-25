#!/usr/bin/env python3
"""Extrae pauta agregada histórica con consultas GET y límites conservadores."""

from __future__ import annotations

import getpass
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
LIBRARY_PATH = BASE_DIR / "extraer_inventario_meta.py"
INSIGHTS_FROM = "2023-08-01"
SPEC = importlib.util.spec_from_file_location("meta_readonly_library", LIBRARY_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("No se pudo cargar la biblioteca de extracción")
META = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = META
SPEC.loader.exec_module(META)

# Este segundo bloque es más pequeño que el inventario orgánico.
META.REQUEST_LIMIT = 12
META.DELAY_SECONDS = 3.0
META.USAGE_STOP_PERCENT = 10


def main() -> int:
    token = getpass.getpass("Token de Meta (entrada oculta, no se guarda): ").strip()
    if not token:
        print("Extracción cancelada: token vacío.")
        return 2

    client = META.ReadOnlyMetaClient(user_token=token)
    monthly_insights: list[dict[str, Any]] = []
    campaign_insights: list[dict[str, Any]] = []
    campaigns: list[dict[str, Any]] = []
    extraction_status = "completa"
    stop_message: str | None = None

    time_range = json.dumps(
        {"since": INSIGHTS_FROM, "until": META.DATE_TO},
        separators=(",", ":"),
    )
    insight_fields = (
        "account_id,account_name,spend,impressions,reach,clicks,"
        "inline_link_clicks,ctr,cpm,cpc,frequency,actions"
    )

    try:
        for account_id, account_name in META.AD_ACCOUNTS.items():
            account_months = client.paged(
                f"{account_id}/insights",
                {
                    "fields": insight_fields,
                    "level": "account",
                    "time_range": time_range,
                    "time_increment": "monthly",
                    "limit": "100",
                },
            )
            for item in account_months:
                item["expected_account_name"] = account_name
            monthly_insights.extend(account_months)
            if client.stop_requested:
                break

            account_campaign_insights = client.paged(
                f"{account_id}/insights",
                {
                    "fields": f"campaign_id,campaign_name,{insight_fields}",
                    "level": "campaign",
                    "time_range": time_range,
                    "time_increment": "all_days",
                    "limit": "100",
                },
            )
            for item in account_campaign_insights:
                item["expected_account_name"] = account_name
            campaign_insights.extend(account_campaign_insights)
            if client.stop_requested:
                break

            account_campaigns = client.paged(
                f"{account_id}/campaigns",
                {
                    "fields": (
                        "id,name,status,effective_status,objective,buying_type,"
                        "created_time,start_time,stop_time,updated_time"
                    ),
                    "limit": "100",
                },
            )
            for item in account_campaigns:
                item["account_id"] = account_id.removeprefix("act_")
                item["expected_account_name"] = account_name
            campaigns.extend(account_campaigns)
            if client.stop_requested:
                break

        if client.stop_requested:
            extraction_status = "parcial-segura"
            stop_message = client.stop_reason
    except META.SafeStop as exc:
        extraction_status = "parcial-segura"
        stop_message = str(exc)
    finally:
        token = ""
        client.user_token = ""

    META.save_json(META.OUTPUT_DIR / "pauta_mensual.json", monthly_insights)
    META.save_json(META.OUTPUT_DIR / "pauta_campanas.json", campaign_insights)
    META.save_json(META.OUTPUT_DIR / "campanas.json", campaigns)
    metadata = {
        "estado": extraction_status,
        "detencion": stop_message,
        "extraido_utc": META.utc_now(),
        "api": "Meta Marketing API v26.0",
        "desde": INSIGHTS_FROM,
        "hasta": META.DATE_TO,
        "solo_lectura": True,
        "limite_solicitudes": META.REQUEST_LIMIT,
        "pausa_segundos": META.DELAY_SECONDS,
        "umbral_uso_porcentaje": META.USAGE_STOP_PERCENT,
        "solicitudes_realizadas": client.request_count,
        "filas": {
            "pauta_mensual": len(monthly_insights),
            "pauta_campanas": len(campaign_insights),
            "campanas": len(campaigns),
        },
        "registro_solicitudes": client.request_log,
        "privacidad": "No se guardaron credenciales ni datos personales.",
        "limitacion_historica": (
            "Meta Ads Insights v26.0 rechazó rangos cuyo inicio supera 37 meses. "
            "El gasto anterior a 2023-08-01 requiere exportes históricos o facturación."
        ),
    }
    META.save_json(META.OUTPUT_DIR / "metadata_extraccion_pauta.json", metadata)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
