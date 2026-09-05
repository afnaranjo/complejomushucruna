---
titulo: "Revisión de pauta activa y audiencia de clientes para F29 · Finados 2026"
responsable: "Alex Naranjo / responsable de pauta digital"
estado: en-revision
ultima_actualizacion: 2026-09-05
fuente: "consulta y escrituras autorizadas en Meta Marketing API v26.0"
confidencialidad: interno
tags:
  - feria-finados-2026
  - meta-ads
  - pauta
  - audiencias
  - seguridad
---

# Revisión de pauta activa y audiencia de clientes para F29

Detalle canónico en [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/03_pauta/2026-09-05_estado-pauta-activa-y-audiencias-finados-2026_v01|Estado de la pauta activa y audiencias · corte 2026-09-05]]. Antecedente: [[2026-09-02_bitacora_revision-campanas-activas-meta-finados-2026_v01|revisión del 2 de septiembre]].

## Qué pidió Alex

1. Revisar la pauta de la cuenta `ExpoFeria Mushuc Runa`, confirmada por él como la cuenta de Finados 2026.
2. Adecuar la campaña `F29 · Alcance · expositores · 20260905`, ya lanzada, para que llegue solo a empresarios, empresas y comerciantes que quieran ser expositores.
3. Crear una audiencia con sus compradores históricos de stands a partir de cinco listas en Descargas, con la confirmación textual de que son clientes con permiso y de que la información les sirve para conocer la fecha de venta.

## Qué se hizo

- Lectura: cuenta, 34 audiencias existentes, 2 píxeles, 200 campañas (incluidas pausadas y archivadas), conjuntos y anuncios activos, insights 2026 por campaña y por día. Hallazgos: cuatro campañas de Finados 2026 activas desde el 2 de septiembre con USD 93,17 gastados; USD 7.332,59 gastados en la cuenta durante 2026; ninguna audiencia similar; audiencias de sitio web vacías porque el píxel no está en `complejomushucruna.com`.
- Escritura autorizada: audiencia `F26 | Clientes stands 2024-2026 | Lista | 20260905` con 1.193 teléfonos únicos cifrados SHA-256 (1.193 recibidos, 0 inválidos); conjunto original de F29 renombrado y resegmentado a comportamientos e intereses empresariales con Advantage desactivado, USD 5/día; nuevo conjunto para la lista de clientes, USD 3/día, con copia del mismo anuncio.
- Verificación posterior de solo lectura: ambos conjuntos activos con la segmentación esperada; ambos anuncios `IN_PROCESS` por revisión de Meta.

## Seguridad y datos

- El token fue entregado por Alex en el chat; se usó solo como variable de entorno, no se escribió en archivos ni en Git. Debe revocarse junto con el expuesto el 2 de septiembre.
- Los teléfonos se procesaron en memoria; ningún archivo con datos en claro se creó y ningún dato personal entró al repositorio. Los identificadores internos de Meta permanecen fuera de Git.
- Consentimiento: Alex declaró que son clientes con permiso. No consta un documento de consentimiento para uso publicitario; queda registrado como pendiente de gobernanza.

## Cierre

- Publicación externa: cinco escrituras autorizadas en Meta (una audiencia, una carga de lista, una edición de conjunto, un conjunto nuevo, un anuncio nuevo). Ninguna otra cuenta, sitio o sistema fue modificado.
- Gasto generado por esta sesión: USD 0 al corte; los dos conjuntos de F29 suman USD 8/día desde su aprobación.
- Próximo paso: el 6 de septiembre comprobar que los anuncios de F29 salieron de revisión y entregan; revisar tamaño emparejado de la audiencia de clientes; decidir ritmo diario de expectativa, píxel en el sitio y audiencia similar.
