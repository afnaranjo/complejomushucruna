#!/usr/bin/env python3
"""Validaciones locales de integridad, enlaces y ausencia de credenciales."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


BASE = Path(__file__).resolve().parent
VAULT = BASE.parents[1]
DATA = BASE / "datos"


def read_csv(name: str) -> list[dict]:
    with (DATA / name).open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def resolve_wikilink(source: Path, target: str) -> bool:
    target = target.split("#", 1)[0]
    if not target:
        return True
    path = (source.parent / target).resolve()
    candidates = [path, path.with_suffix(".md"), path / "README.md"]
    return any(candidate.exists() for candidate in candidates)


raw_posts = json.loads((DATA / "publicaciones.json").read_text(encoding="utf-8"))
quality = json.loads((DATA / "calidad_datos.json").read_text(encoding="utf-8"))
organic = read_csv("resumen_eventos_organico.csv")
paid_monthly = read_csv("pauta_mensual_procesada.csv")
paid_events = read_csv("pauta_eventos_parcial.csv")

assert len(raw_posts) == 1414
assert len({row["id"] for row in raw_posts}) == len(raw_posts)
assert quality["publicaciones_fuente"] == len(raw_posts)
assert quality["ids_duplicados"] == 0
assert len(paid_monthly) == 13
assert {row["evento"] for row in paid_events} == {
    "carnaval-2024",
    "carnaval-2025",
    "finados-2025",
    "carnaval-2026",
}
assert round(sum(float(row["gasto_observado_usd"]) for row in paid_events), 2) == 26532.46
assert next(row for row in organic if row["evento"] == "finados-2025")["publicaciones"] == "430"
assert all(float(row["gasto_observado_usd"]) >= 0 for row in paid_events)

notebook = json.loads((BASE / "2026-08-24_auditoria-meta-2021-2026_v01.ipynb").read_text(encoding="utf-8"))
assert notebook["nbformat"] == 4
for index, cell in enumerate(notebook["cells"]):
    if cell["cell_type"] == "code":
        compile("".join(cell["source"]), f"notebook-cell-{index}", "exec")
        assert cell["execution_count"] is not None

html_report = (BASE / "2026-08-24_informe-ejecutivo-meta-2021-2026_v01.html").read_text(encoding="utf-8")
assert "<svg" in html_report
assert "data-source=" in html_report
assert "<script" not in html_report.lower()
assert not re.search(r"(?:src|href)=[\"']https?://", html_report, re.I)

markdown_files = [
    BASE / "README.md",
    BASE / "2026-08-24_informe-auditoria-meta-2021-2026_v01.md",
    VAULT / "13_datos-medicion/README.md",
    VAULT / "11_eventos/2026_feria-finados/05_marketing-comunicacion/01_estrategia/README.md",
    VAULT / "11_eventos/2026_feria-finados/05_marketing-comunicacion/06_medicion/README.md",
    VAULT / "11_eventos/2026_feria-finados/05_marketing-comunicacion/01_estrategia/2026-08-24_estrategia-digital-finados-2026_v01.md",
]
missing_links = []
for path in markdown_files:
    content = path.read_text(encoding="utf-8")
    assert content.startswith("---\n"), f"Sin frontmatter: {path}"
    for raw_target in re.findall(r"\[\[([^\]]+)\]\]", content):
        target = raw_target.split("|", 1)[0]
        if not resolve_wikilink(path, target):
            missing_links.append((str(path), target))
assert not missing_links, f"Wikilinks sin resolver: {missing_links}"

# Tokens de usuario de Meta suelen iniciar por EA y ser muy largos. Nunca se
# imprime el contenido sospechoso, solo se falla con el nombre del archivo.
suspicious = []
for path in BASE.rglob("*"):
    if not path.is_file() or "__pycache__" in path.parts:
        continue
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    if re.search(r"\bEA[A-Za-z0-9]{80,}\b", content):
        suspicious.append(str(path))
assert not suspicious, f"Posible credencial en: {suspicious}"

print("VALIDACIÓN OK")
print("- 1.414 publicaciones únicas")
print("- 13 meses parciales de pauta y USD 26.532,46 conciliados")
print("- notebook válido y celdas compilables")
print("- HTML autónomo con SVG y fuentes visibles")
print("- wikilinks principales resueltos")
print("- sin tokens Meta detectados")
