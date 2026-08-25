---
titulo: "Auditoría Meta 2021-2026"
responsable: "analista de marketing"
estado: en-revision
ultima_actualizacion: 2026-08-24
fuente: "Meta Graph API y Marketing API; extracción autorizada de solo lectura"
confidencialidad: restringido
---

# Auditoría Meta 2021-2026

Expediente de extracción segura, datos derivados, análisis reproducible e implicaciones estratégicas para Feria de Finados 2026.

## Entregables

- [[2026-08-24_informe-auditoria-meta-2021-2026_v01|Informe canónico]]
- [[2026-08-24_auditoria-meta-2021-2026_v01.ipynb|Notebook reproducible]]
- [Informe ejecutivo HTML](2026-08-24_informe-ejecutivo-meta-2021-2026_v01.html)
- [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/01_estrategia/2026-08-24_estrategia-digital-finados-2026_v01|Estrategia digital provisional 2026]]

## Datos

- `datos/publicaciones.json`: extracción pública original normalizada.
- `datos/paginas.json`: metadatos públicos de las dos páginas.
- `datos/pauta_mensual.json`: 13 meses parciales de pauta de una cuenta.
- `datos/publicaciones_procesadas.csv`: fechas Guayaquil, evento, fase, tema y señales de copy.
- `datos/resumen_eventos_organico.csv`: comparación de eventos.
- `datos/resumen_formatos.csv`, `resumen_fases.csv`, `resumen_temas.csv`: cortes analíticos.
- `datos/ranking_publicaciones.csv`: piezas líderes por evento.
- `datos/pauta_mensual_procesada.csv` y `pauta_eventos_parcial.csv`: pauta derivada.
- `datos/calidad_datos.json`: perfil de cobertura y advertencias.

## Seguridad

Los scripts de extracción usan únicamente `GET`, piden el token de manera interactiva y no lo guardan. La sesión se detuvo al primer límite de aplicación. No se deben volver a ejecutar hasta que la cuota se restablezca y exista una ventana autorizada.

`procesar_analisis.py`, `generar_notebook.py` y `generar_informe.py` trabajan solo con archivos locales y no llaman a Meta.

## Limitaciones

La pauta no incluye el desglose por campaña, la cuenta `Complejo Mushuc Runa`, gasto anterior a agosto de 2023 ni facturación. Las compras/leads son atribuciones de Meta no conciliadas. No se descargaron comentarios individuales ni alcance orgánico por publicación.

## Navegación

- [[../README|Datos y medición]]
- [[../../_memoria-del-proyecto|Memoria del proyecto]]
- [[../../_pendientes|Pendientes]]
