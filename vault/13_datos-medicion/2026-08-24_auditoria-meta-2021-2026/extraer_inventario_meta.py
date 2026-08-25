#!/usr/bin/env python3
"""Inventario histórico de Meta, solo lectura y con límites conservadores.

El token se solicita por entrada oculta, vive únicamente en memoria y nunca se
escribe en archivos. El script no contiene operaciones POST, PATCH ni DELETE.
"""

from __future__ import annotations

import getpass
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


API_BASE = "https://graph.facebook.com/v26.0"
DATE_FROM = "2021-01-01"
DATE_TO = "2026-08-24"
REQUEST_LIMIT = 20
DELAY_SECONDS = 3.0
USAGE_STOP_PERCENT = 10

PAGES = {
    "729780340226059": "Finados Mushuc Runa",
    "105221087662733": "Carnavales Mushuc Runa",
}

AD_ACCOUNTS = {
    "act_2943017486003206": "ExpoFeria Mushuc Runa",
    "act_929471581448214": "Complejo Mushuc Runa",
}

OUTPUT_DIR = Path(__file__).resolve().parent / "datos"
TOKEN_PATTERN = re.compile(r"EAA[A-Za-z0-9_-]{30,}")
USAGE_HEADERS = (
    "x-app-usage",
    "x-page-usage",
    "x-ad-account-usage",
    "x-business-use-case-usage",
    "retry-after",
    "facebook-api-version",
)


class SafeStop(RuntimeError):
    """Detención deliberada por límite, error o condición conservadora."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sanitize_string(value: str) -> str:
    value = TOKEN_PATTERN.sub("[CREDENCIAL-ELIMINADA]", value)
    if "access_token=" in value:
        parsed = urllib.parse.urlsplit(value)
        query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        safe_query = [(key, item) for key, item in query if key != "access_token"]
        value = urllib.parse.urlunsplit(
            (parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode(safe_query), parsed.fragment)
        )
    return value


def sanitize(value: Any) -> Any:
    if isinstance(value, str):
        return sanitize_string(value)
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    if isinstance(value, dict):
        return {
            key: sanitize(item)
            for key, item in value.items()
            if key.lower() not in {"access_token", "token"}
        }
    return value


def save_json(path: Path, value: Any) -> None:
    safe_value = sanitize(value)
    serialized = json.dumps(safe_value, ensure_ascii=False, indent=2, sort_keys=True)
    if TOKEN_PATTERN.search(serialized) or "access_token" in serialized:
        raise SafeStop(f"Control de secretos falló para {path.name}")
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(serialized + "\n", encoding="utf-8")
    temporary.replace(path)


def parse_usage(headers: Any) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for header in USAGE_HEADERS:
        raw_value = headers.get(header)
        if not raw_value:
            continue
        try:
            result[header] = json.loads(raw_value)
        except (TypeError, json.JSONDecodeError):
            result[header] = raw_value
    return result


def usage_percent(value: Any) -> float:
    candidates: list[float] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"call_count", "total_cputime", "total_time"} and isinstance(item, (int, float)):
                candidates.append(float(item))
            else:
                candidates.append(usage_percent(item))
    elif isinstance(value, list):
        candidates.extend(usage_percent(item) for item in value)
    return max(candidates, default=0.0)


@dataclass
class ReadOnlyMetaClient:
    user_token: str
    request_count: int = 0
    stop_requested: bool = False
    stop_reason: str | None = None
    request_log: list[dict[str, Any]] = field(default_factory=list)

    def get(self, path: str, params: dict[str, str], token: str | None = None) -> dict[str, Any]:
        if self.request_count >= REQUEST_LIMIT:
            raise SafeStop(f"Máximo conservador de {REQUEST_LIMIT} solicitudes alcanzado")
        if self.stop_requested:
            raise SafeStop(self.stop_reason or "Detención conservadora solicitada")

        if self.request_count:
            time.sleep(DELAY_SECONDS)

        query = urllib.parse.urlencode(params)
        request = urllib.request.Request(
            f"{API_BASE}/{path}?{query}",
            headers={
                "Authorization": f"Bearer {token or self.user_token}",
                "User-Agent": "MushucRunaHistoricalAudit/1.0",
            },
            method="GET",
        )
        started_at = utc_now()
        self.request_count += 1

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read().decode("utf-8"))
                usage = parse_usage(response.headers)
                status = response.status
        except urllib.error.HTTPError as exc:
            usage = parse_usage(exc.headers)
            status = exc.code
            try:
                payload = json.loads(exc.read().decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                payload = {"error": {"message": "Respuesta HTTP no interpretable"}}
        except urllib.error.URLError as exc:
            raise SafeStop(f"Error de red sin reintento: {exc.reason}") from exc

        log_item = {
            "numero": self.request_count,
            "inicio_utc": started_at,
            "ruta": path,
            "http": status,
            "uso": usage,
        }
        self.request_log.append(log_item)

        if status != 200 or "error" in payload:
            error = payload.get("error", {})
            raise SafeStop(
                "Meta detuvo la consulta: "
                f"HTTP {status}; código {error.get('code')}; {error.get('message')}"
            )

        if "retry-after" in usage:
            self.stop_requested = True
            self.stop_reason = "Meta devolvió Retry-After"
        elif usage_percent(usage) >= USAGE_STOP_PERCENT:
            self.stop_requested = True
            self.stop_reason = (
                f"Encabezado de uso alcanzó el umbral conservador de {USAGE_STOP_PERCENT}%"
            )

        return payload

    def paged(
        self,
        path: str,
        params: dict[str, str],
        token: str | None = None,
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        next_params = dict(params)
        while True:
            payload = self.get(path, next_params, token=token)
            rows.extend(payload.get("data", []))
            if self.stop_requested:
                break
            paging = payload.get("paging", {})
            after = paging.get("cursors", {}).get("after")
            if not paging.get("next") or not after:
                break
            next_params = dict(params)
            next_params["after"] = after
        return rows


def normalize_post(item: dict[str, Any], page_id: str, page_name: str) -> dict[str, Any]:
    reactions = item.pop("reactions", {}).get("summary", {}).get("total_count", 0)
    comments = item.pop("comments", {}).get("summary", {}).get("total_count", 0)
    shares = item.pop("shares", {}).get("count", 0)
    return {
        "page_id": page_id,
        "page_name": page_name,
        **item,
        "reactions_count": reactions,
        "comments_count": comments,
        "shares_count": shares,
        "public_interactions": reactions + comments + shares,
    }


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    user_token = getpass.getpass("Token de Meta (entrada oculta, no se guarda): ").strip()
    if not user_token:
        print("Extracción cancelada: token vacío.")
        return 2

    client = ReadOnlyMetaClient(user_token=user_token)
    pages_metadata: list[dict[str, Any]] = []
    posts: list[dict[str, Any]] = []
    monthly_insights: list[dict[str, Any]] = []
    campaign_insights: list[dict[str, Any]] = []
    campaigns: list[dict[str, Any]] = []
    extraction_status = "completa"
    stop_message: str | None = None

    try:
        page_accounts = client.get(
            "me/accounts",
            {"fields": "id,name,access_token", "limit": "25"},
        ).get("data", [])
        page_tokens = {
            item["id"]: item.get("access_token")
            for item in page_accounts
            if item.get("id") in PAGES and item.get("access_token")
        }
        missing_pages = sorted(set(PAGES) - set(page_tokens))
        if missing_pages:
            raise SafeStop(f"No se obtuvo acceso de página para: {', '.join(missing_pages)}")

        for page_id, expected_name in PAGES.items():
            page_token = page_tokens[page_id]
            page_metadata = client.get(
                page_id,
                {"fields": "id,name,fan_count,followers_count,link,category"},
                token=page_token,
            )
            page_metadata["expected_name"] = expected_name
            pages_metadata.append(page_metadata)
            if client.stop_requested:
                break

            page_posts = client.paged(
                f"{page_id}/posts",
                {
                    "fields": (
                        "id,created_time,updated_time,message,permalink_url,status_type,"
                        "is_published,shares,comments.limit(0).summary(true),"
                        "reactions.limit(0).summary(true)"
                    ),
                    "since": DATE_FROM,
                    "until": DATE_TO,
                    "limit": "100",
                },
                token=page_token,
            )
            posts.extend(
                normalize_post(dict(item), page_id, page_metadata.get("name", expected_name))
                for item in page_posts
            )
            if client.stop_requested:
                break

        if not client.stop_requested:
            time_range = json.dumps({"since": DATE_FROM, "until": DATE_TO}, separators=(",", ":"))
            insight_fields = (
                "account_id,account_name,spend,impressions,reach,clicks,"
                "inline_link_clicks,ctr,cpm,cpc,frequency,actions"
            )
            for account_id, account_name in AD_ACCOUNTS.items():
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
    except SafeStop as exc:
        extraction_status = "parcial-segura"
        stop_message = str(exc)
    finally:
        user_token = ""
        client.user_token = ""

    outputs = {
        "paginas.json": pages_metadata,
        "publicaciones.json": posts,
        "pauta_mensual.json": monthly_insights,
        "pauta_campanas.json": campaign_insights,
        "campanas.json": campaigns,
    }
    for filename, value in outputs.items():
        save_json(OUTPUT_DIR / filename, value)

    metadata = {
        "estado": extraction_status,
        "detencion": stop_message,
        "extraido_utc": utc_now(),
        "api": "Meta Graph API v26.0",
        "desde": DATE_FROM,
        "hasta": DATE_TO,
        "solo_lectura": True,
        "limite_solicitudes": REQUEST_LIMIT,
        "pausa_segundos": DELAY_SECONDS,
        "umbral_uso_porcentaje": USAGE_STOP_PERCENT,
        "solicitudes_realizadas": client.request_count,
        "filas": {
            "paginas": len(pages_metadata),
            "publicaciones": len(posts),
            "pauta_mensual": len(monthly_insights),
            "pauta_campanas": len(campaign_insights),
            "campanas": len(campaigns),
        },
        "registro_solicitudes": client.request_log,
        "privacidad": (
            "No se extrajeron comentarios individuales, nombres de usuarios ni credenciales. "
            "Los tokens se mantuvieron únicamente en memoria."
        ),
    }
    save_json(OUTPUT_DIR / "metadata_extraccion.json", metadata)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0 if extraction_status in {"completa", "parcial-segura"} else 1


if __name__ == "__main__":
    sys.exit(main())
