---
titulo: "Auditoría de la campaña activa de entradas del 31 de octubre por WhatsApp"
responsable: "Alex Naranjo / pauta digital / ventas"
estado: en-revision
ultima_actualizacion: 2026-09-19
fuente: "Graph API v26.0 de Meta, lecturas y creación controlada en pausa del 2026-09-19"
confidencialidad: interno
tags: [feria-finados-2026, meta-ads, whatsapp, entradas, auditoria]
---

# Campaña de entradas del 31 de octubre · corte operativo

Complementa el [[2026-09-19_plan-campana-entradas-kjarkas-whatsapp_v01|plan previo]]; la configuración real prevalece sobre aquella propuesta. No contiene token, teléfono, identificadores internos ni datos de clientes porque el repositorio es público.

## Verificado en Meta el 19 de septiembre de 2026

| Control | Estado observado |
|---|---|
| Campaña | `Finados 2026 - Entradas 31 octubre - WhatsApp`, activa; objetivo técnico de interacción. |
| Conjuntos | Al inicio, uno activo (`Folklore`) con nombre genérico a USD 2,50 diarios. Al cierre de esta intervención, existe además uno de descubrimiento en pausa a USD 2,50/día nominales si se activara; no genera gasto mientras siga pausado. La campaña no tiene presupuesto diario propio. |
| Público | Audiencia personalizada `Folklore`, personas de 18–65 años en Ambato + 60 km. Es interacción previa con videos y no equivale a compradores comprobados. |
| Destino y entrega | WhatsApp; optimización a conversaciones iniciadas; cobro por impresiones. El conjunto original atribuye clic a siete días y el nuevo, pausado, a un día; los resultados deberán compararse con una ventana homogénea. |
| Anuncio | Uno original activo, todavía con nombre genérico, y una copia nueva en pausa. Ambos reutilizan la [publicación existente de Kjarkas y William Luna del 31 de octubre](https://www.facebook.com/122142325251017479/posts/122144469993017479), con llamada a WhatsApp. No se creó una pieza pública nueva. |
| Finalización | Ninguno de los dos conjuntos devuelve `end_time`; no hay corte automático visible antes ni después del espectáculo. La cuenta usa `America/Los_Angeles`, no `America/Guayaquil`. |
| Incidencias | El anuncio original no devolvió incidencias en `issues_info` y siguió activo. El nuevo quedó en pausa y pendiente de revisión; eso no demuestra boletos vendidos ni elegibilidad en cada ubicación. |

La consulta del creativo devolvió la publicación de Facebook y `WHATSAPP_MESSAGE`, pero no un identificador de actor de Instagram; su entrega o compatibilidad por ubicación permanece **por confirmar**. Una consulta opcional de desglose de resultados respondió con parámetro inválido (`400`), sin evidencia de restricción de cuenta. Las lecturas principales fueron `200`, con uso publicitario reportado en 0 % y sin respuestas `429` o `5xx`. No se insistió con el desglose.

## Brechas y decisión controlada

1. El segundo conjunto de descubrimiento que excluye `Folklore` ya existe **en pausa**, con anuncio en pausa. Activarlo elevaría el gasto sobre los USD 2,50 diarios actuales; el piloto de USD 10/día del plan anterior **nunca se aprobó**. No activar gasto adicional sin un tope diario aprobado y conciliación del remanente de la pauta social.
2. Falta una fecha y hora de corte. Ventas debe confirmar hasta cuándo atiende y vende entradas del 31 de octubre; el show anunciado comienza a las 18:00 de Ecuador. Cualquier hora se convierte desde `America/Guayaquil` a la zona de la cuenta y se verifica por lectura posterior.
3. El conjunto y el anuncio conservan nombres genéricos. Renombrarlos mejora el control sin cambiar público, pieza o presupuesto; comprobar por API antes y después de hacerlo.
4. La pieza no permite inferir precio total, localidades ni disponibilidad del megaescenario. La entrada general adulta de USD 3 no es el precio total del show. Antes de escalar, Ventas debe validar inventario, precio final y capacidad de atención en WhatsApp.
5. El KPI de Meta es conversación iniciada; la fuente de verdad comercial será entrada pagada/caja. El CRM externo ya envía eventos a Meta según Alex, pero no se revisó ni cambió en este corte.

## Límite de intervención

Después de la auditoría se preparó **solo** un segundo conjunto/anuncio en estado `PAUSED` dentro de la campaña existente. Se copió la geografía, edad, destino WhatsApp y pieza del conjunto original; se eliminó `Folklore` como inclusión y se añadió como exclusión. La primera prevalidación rechazó la atribución de siete días, igual que en el antecedente Guaynaa; una única corrección a clic de un día pasó `validate_only`. La prevalidación del anuncio también pasó. Las lecturas finales verificaron exactamente dos conjuntos y dos anuncios: original activo a USD 2,50/día, nuevo pausado, sin aumento del presupuesto activo. El anuncio nuevo mostraba revisión pendiente, no rechazo. No se cambió la campaña, conjunto o anuncio originales; tampoco CRM, publicación, oferta ni borradores globales de Ads Manager. No hubo respuestas `429` o `5xx`. Ninguna activación adicional está autorizada por este registro.

Relacionado: [[../../../../_memoria-del-proyecto|Memoria]] · [[../../../../_pendientes|Pendientes]] · [[README|Pauta]].
