---
titulo: "Bitácora de configuración de campaña de entradas por WhatsApp"
responsable: "Alex Naranjo / pauta digital"
estado: en-revision
ultima_actualizacion: 2026-09-19
fuente: "revisión de Ads Manager, Graph API v26.0 y documentación oficial de Meta, 2026-09-19"
confidencialidad: interno
tags: [feria-finados-2026, bitacora, meta-ads, whatsapp]
---

# Bitácora de configuración de campaña de entradas

Alex pidió renombrar la campaña recién lanzada y trabajar con dos conjuntos —uno para el público `Reguetón` y otro de compradores probables—. Después precisó que su CRM externo ya envía eventos a Meta y que esta tarea se limita a configurar bien la campaña. La [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/03_pauta/2026-09-19_prevalidacion-campana-entradas-whatsapp_v01|ficha de revisión y configuración]] documenta la línea base, los cambios y el seguimiento.

- Antes del cambio: campaña activa con un conjunto de USD 5/día para todo Ecuador, destino WhatsApp y optimización a conversaciones iniciadas. Se usaba una publicación existente.
- Por Graph API se renombró la campaña, se asignó al conjunto original la audiencia personalizada `Reguetón` en Ambato + 60 km y se redujo su presupuesto a USD 2,50/día. Se creó un segundo conjunto con interactuantes de la página de Finados (365 días), igual radio y USD 2,50/día. El anuncio nuevo reutiliza el creativo original. Se activó solo después de validar la suma de USD 5/día y el estado de ambos anuncios.
- Los dos conjuntos cierran el 1 de noviembre a las 23:59 Ecuador. Las lecturas finales devolvieron campaña, conjuntos y anuncios activos, sin incidencias visibles ni respuestas `429`/`5xx`.
- El conjunto original conserva ventana de atribución de 7 días; el nuevo tiene 1 día porque Meta no permite modificar la ventana del anterior tras crearlo. Los informes deberán normalizar la ventana y conciliar conversaciones con ventas.
- Ads Manager tenía dos borradores globales. Abrir el editor produjo una indicación de tercero sin cambios deliberados. No se publicaron ni descartaron esos borradores; no usar `Revisar y publicar` en lote.
- El repositorio no captura `ctwa_clid` ni envía CAPI; Alex confirma que lo gestiona su CRM externo. No se inspeccionó ni modificó el CRM, no se enviaron eventos y no se guardaron credenciales en Git. No se publicaron páginas orgánicas ni se desplegó sitio.
- Pendientes: vigilancia de entrega/ventas y revisión individual de borradores antes de operar la interfaz. No se aumentó el presupuesto nominal diario total.

Relacionado: [[../../_memoria-del-proyecto|Memoria]] y [[../../_pendientes|Pendientes]].
