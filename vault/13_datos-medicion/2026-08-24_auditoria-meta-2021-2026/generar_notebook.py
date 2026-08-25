#!/usr/bin/env python3
"""Genera un notebook reproducible y preejecutado con biblioteca estándar."""

from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path


BASE = Path(__file__).resolve().parent
OUTPUT = BASE / "2026-08-24_auditoria-meta-2021-2026_v01.ipynb"


def markdown(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": source.splitlines(keepends=True)}


def code(source: str) -> dict:
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": source.splitlines(keepends=True)}


cells = [
    markdown(
        """# Auditoría Meta 2021–2026 · Mushuc Runa

Notebook complementario del informe ejecutivo. Procesa únicamente los archivos locales ya extraídos; **no llama a Meta** y no contiene credenciales.

Alcance: 1.414 publicaciones públicas de dos páginas y 13 meses parciales de pauta de una cuenta. Las interacciones orgánicas son conteos absolutos, no tasas de engagement. Las acciones publicitarias son atribuidas por Meta y no equivalen a ventas conciliadas.
"""
    ),
    code(
        """from pathlib import Path
import csv, json

BASE = Path.cwd()
if not (BASE / "datos").exists():
    candidates = list(Path.cwd().glob("**/2026-08-24_auditoria-meta-2021-2026/datos"))
    if not candidates:
        raise FileNotFoundError("Abre el notebook desde su carpeta o desde la raíz del repositorio")
    BASE = candidates[0].parent
DATA = BASE / "datos"

def read_csv(name):
    with (DATA / name).open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))

def show(rows, columns, limit=None):
    rows = rows[:limit] if limit else rows
    widths = {c: max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in columns}
    print(" | ".join(c.ljust(widths[c]) for c in columns))
    print("-+-".join("-" * widths[c] for c in columns))
    for row in rows:
        print(" | ".join(str(row.get(c, "")).ljust(widths[c]) for c in columns))

organic = read_csv("resumen_eventos_organico.csv")
paid = read_csv("pauta_eventos_parcial.csv")
phases = read_csv("resumen_fases.csv")
formats = read_csv("resumen_formatos.csv")
ranking = read_csv("ranking_publicaciones.csv")
quality = json.loads((DATA / "calidad_datos.json").read_text(encoding="utf-8"))
print(f"Datos cargados desde: {DATA}")
"""
    ),
    markdown("""## 1. Calidad y cobertura

Primero se comprueban unicidad, cobertura por página y limitaciones de pauta. Esta es la barrera contra conclusiones falsas.
"""),
    code(
        """print("Publicaciones:", quality["publicaciones_fuente"])
print("IDs únicos:", quality["ids_unicos"])
print("IDs duplicados:", quality["ids_duplicados"])
print("Mensajes vacíos:", quality["mensajes_vacios"])
print("Publicaciones clasificadas en eventos:", quality["publicaciones_en_eventos_clasificados"])
for page_id, info in quality["cobertura_por_pagina"].items():
    print(f"- {info['pagina'].strip()}: {info['filas']} filas, {info['primera_publicacion_utc']} → {info['ultima_publicacion_utc']}")
print("Pauta:", quality["pauta"]["filas_mensuales"], "meses; cuentas:", quality["pauta"]["cuentas_presentes"])
print("Detención segura:", quality["pauta"]["detencion"])
"""
    ),
    markdown("""## 2. Rendimiento orgánico comparable

La mediana es más útil que el total para comparar una publicación típica, porque unos pocos contenidos concentran gran parte de las interacciones.
"""),
    code(
        """show(organic, [
    "etiqueta", "publicaciones", "publicaciones_por_dia_activo",
    "interacciones_publicas_total", "interacciones_mediana",
    "porcentaje_en_copias_repetidas"
])
"""
    ),
    markdown("""## 3. Pauta parcial por evento

Los montos son **gasto mínimo observado** en la cuenta ExpoFeria. No incluyen la cuenta Complejo, campañas desglosadas ni períodos anteriores a agosto de 2023. El alcance sumado entre meses no está deduplicado.
"""),
    code(
        """show(paid, [
    "etiqueta", "meses_incluidos", "gasto_observado_usd", "impresiones",
    "clics_enlace", "cpc_enlace_usd", "conversaciones_iniciadas_7d",
    "costo_conversacion_usd", "compras_meta_atribuidas"
])
"""
    ),
    markdown("""## 4. Saturación de Finados 2025

La fase en vivo concentró 179 publicaciones en cinco días. La suma de interacciones creció por volumen y por una pieza atípica, mientras la publicación típica quedó en 33 interacciones.
"""),
    code(
        """finados_phases = [row for row in phases if row["evento"] == "finados-2025"]
show(finados_phases, [
    "fase", "publicaciones", "dias_con_publicacion", "publicaciones_por_dia_activo",
    "interacciones_total", "interacciones_mediana"
])
"""
    ),
    markdown("""## 5. Formatos

El video tuvo una mediana superior a la foto en cada edición con una muestra suficiente. Esto respalda una estrategia *video-first*, no una mayor frecuencia de publicación.
"""),
    code(
        """selected = [row for row in formats if row["evento"] in {
    "carnaval-2022", "carnaval-2023", "carnaval-2024", "carnaval-2025", "finados-2025", "carnaval-2026"
} and row["formato"] in {"added_video", "added_photos"}]
show(selected, ["evento", "formato", "publicaciones", "interacciones_mediana", "compartidos_mediana"])
"""
    ),
    markdown("""## 6. Piezas líderes de Finados 2025

El ranking identifica señales creativas, no causalidad. No contiene comentarios individuales ni nombres de usuarios.
"""),
    code(
        """top = [row for row in ranking if row["evento"] == "finados-2025"][:10]
show(top, ["rango", "fecha_guayaquil", "formato", "interacciones_publicas", "comentarios", "compartidos", "mensaje_resumen"])
"""
    ),
    markdown("""## 7. Pruebas de integridad

Estas aserciones permiten detectar duplicados, cifras negativas o cambios involuntarios en los datos derivados.
"""),
    code(
        """assert quality["publicaciones_fuente"] == quality["ids_unicos"]
assert quality["ids_duplicados"] == 0
assert all(float(row["gasto_observado_usd"]) >= 0 for row in paid)
assert all(int(row["publicaciones"]) > 0 for row in organic)
assert {row["evento"] for row in paid} == {"carnaval-2024", "carnaval-2025", "finados-2025", "carnaval-2026"}
print("VALIDACIÓN OK: integridad estructural y controles mínimos superados")
"""
    ),
    markdown(
        """## Conclusión reproducible

Los datos respaldan cinco decisiones: reducir saturación, producir video con propósito, usar música como puerta de entrada sin convertirla en toda la marca, construir confianza operativa y no optimizar a “compra” hasta reconciliar píxel, boletería y facturación. La estrategia completa se documenta en el informe canónico y en la directriz digital 2026.
"""
    ),
]


namespace = {}
execution_count = 0
for cell in cells:
    if cell["cell_type"] != "code":
        continue
    execution_count += 1
    source = "".join(cell["source"])
    compile(source, f"cell-{execution_count}", "exec")
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        exec(source, namespace)
    cell["execution_count"] = execution_count
    output = buffer.getvalue()
    if output:
        cell["outputs"] = [{"name": "stdout", "output_type": "stream", "text": output.splitlines(keepends=True)}]

notebook = {
    "cells": cells,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}
OUTPUT.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"Notebook generado: {OUTPUT}")
