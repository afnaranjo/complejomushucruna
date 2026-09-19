---
titulo: "Prevalidación y configuración de campaña de entradas hacia WhatsApp · 2026-09-19"
responsable: "Alex Naranjo / pauta digital / ventas"
estado: en-revision
ultima_actualizacion: 2026-09-19
fuente: "Ads Manager y Graph API v26.0, 2026-09-19; documentación oficial de Meta consultada el mismo día"
confidencialidad: interno
tags: [feria-finados-2026, meta-ads, whatsapp, medicion]
---

# Prevalidación y configuración de campaña de entradas hacia WhatsApp

Complementa [[2026-09-19_revision-campanas-meta-finados-2026_v01|el corte general de campañas]] y el [[../06_medicion/2026-08-24_plan-medicion-digital-finados-2026_v01|plan de medición]]. Registra la revisión y los cambios de campaña solicitados expresamente por Alex. Los identificadores internos de Meta, el número de WhatsApp, los contactos y las credenciales permanecen fuera de este repositorio público.

## Línea base previa, verificada el 2026-09-19

- La campaña de entradas estaba activa con un solo conjunto/anuncio, USD 5 diarios nominales, todo Ecuador y sin cierre programado. El objetivo de campaña es Tráfico, pero el destino real es WhatsApp y la optimización del conjunto es a conversaciones iniciadas; **no optimiza compras verificadas**.
- El selector de públicos guardados de Ads Manager no mostraba `Reguetón`. Graph API confirmó después que sí existe como **audiencia personalizada de interacción**, categoría distinta del selector inicialmente revisado.
- El anuncio usa la página y el Instagram previstos para Finados y un CTA hacia WhatsApp. En seguimiento aparece seleccionado un píxel web que Meta señala inactivo, sin eventos recientes. Esa selección no demuestra captura de `ctwa_clid`, ni convierte por sí sola un chat en lead o venta.
- Había dos borradores globales antes de la revisión. Al abrir el editor del anuncio sin modificar campos, la interfaz indicó autoguardado y pasó a mostrar tres borradores; la fila del anuncio quedó con `Cambios sin publicar`. La ventana para comparar los borradores no terminó de cargar. **No se publicó, descartó ni modificó deliberadamente ningún campo**. No usar `Revisar y publicar (3)` hasta identificar cada diferencia y su propietario.

## Configuración aplicada y comprobada por API, 2026-09-19

- Se cambió el nombre de la campaña a `Finados 2026 - Entradas 1 noviembre - WhatsApp`. Se preservó el objetivo de campaña y la publicación existente. La lectura final confirmó campaña activa.
- Conjunto original: audiencia personalizada `Reguetón`, Ambato + 60 km, Advantage+ Audience desactivada y presupuesto nominal USD 2,50/día. Su anuncio sigue activo.
- Conjunto nuevo: personas que interactuaron con la página de Finados durante 365 días, Ambato + 60 km, Advantage+ Audience desactivada y presupuesto nominal USD 2,50/día. Se creó inicialmente en pausa; su anuncio reutiliza **el mismo creativo/publicación**, sin copiar ni alterar texto, imagen o CTA. Solo se activó después de verificar que la suma de presupuestos era USD 5/día. La lectura final confirmó ambos anuncios `ACTIVE`, estado efectivo `ACTIVE` y cero incidencias visibles.
- Ambos conjuntos tienen destino WhatsApp y optimización `CONVERSATIONS`; el gasto diario nominal combinado permanece en USD 5. Meta puede distribuir el gasto diario de manera variable conforme a sus reglas, así que el presupuesto diario nominal no es una garantía de un cargo idéntico cada día.
- Ambos tienen cierre automático el **1 de noviembre de 2026 a las 23:59 Ecuador**. Meta guardó el mismo instante como `20:59 -0800` en la zona horaria de la cuenta. No se cambió el CRM, el píxel, la página, el Instagram ni los borradores del editor.
- Se usaron lecturas secuenciales, `validate_only` antes de los cambios de conjunto y lecturas de confirmación. Una validación inicial rechazó la atribución de 7 días al crear el conjunto nuevo y se corrigió a 1 día; otra rechazó un formato UTC para la fecha final y se corrigió a formato con zona explícita. **No hubo `429`, `5xx` ni incidencias de cuenta visibles.** Estas respuestas de validación no crearon ni activaron objetos.
- El conjunto original conserva atribución de clic de **7 días**. Meta rechazó en `validate_only` cambiarla después de su creación; el nuevo tiene **1 día**. No interpretar como superior a un público por diferencias en conversiones atribuidas sin normalizar el informe a una ventana común. Esta limitación no altera el tope de gasto ni el destino WhatsApp.

## Medición WhatsApp/CRM (fuera del alcance de esta adecuación)

- El código de este repositorio no implementa webhook de WhatsApp, captura de `ctwa_clid`, almacenamiento de leads CTWA ni emisor de eventos Meta Conversions API. Las UTM existentes pertenecen al formulario de Voceros, no a esta campaña. **Alex confirmó que su CRM externo ya envía los eventos a Meta**; esta integración no fue inspeccionada aquí y no forma parte del trabajo solicitado de configuración publicitaria.
- Según el [objeto de mensajes del webhook oficial de Meta](https://www.postman.com/meta/whatsapp-business-platform/folder/1dtuocp/messages-object), el mensaje entrante desde Click-to-WhatsApp puede incluir referencia del anuncio, que el usuario puede retirar. Un [ejemplo de Meta archivado](https://github.com/fbsamples/lead-ads-webhook-sample/blob/main/postman/FB%20Conversions%20API%20(Part%201%20-%20online).postman_collection.json#L3462-L3534) ilustra el envío de `ctwa_clid` con `action_source=business_messaging` y `messaging_channel=whatsapp` a un dataset. La [guía de WhatsApp Business](https://whatsappbusiness.com/blog/conversions-api-messaging/) explica el uso de resultados posteriores a la conversación. El ejemplo archivado no sustituye validar requisitos y permisos vigentes del CRM, WABA y dataset reales.
- Una UTM de sitio web no sustituye el `referral`/`ctwa_clid` de un anuncio que abre WhatsApp directamente. No se deben fabricar IDs para conversaciones históricas ni registrar como compra una conversación iniciada. La fuente operativa debe confirmar lead calificado o pago; Meta es destino de atribución, no registro maestro de clientes.

## Seguimiento y límites

1. Revisar tras 24–48 horas alcance, frecuencia, conversaciones de calidad y ventas conciliadas por conjunto. Con USD 2,50/día por público la señal puede ser insuficiente para concluir cuál vende mejor; no ampliar gasto sin decisión de Alex.
2. Comparar la atribución en una ventana de informe homogénea y usar el CRM/ventas como fuente de verdad de compra; conversación iniciada no equivale a boleto pagado.
3. Comparar los tres borradores individualmente antes de cualquier futura publicación desde Ads Manager. Los cambios aquí registrados se hicieron por API y no requieren publicar el lote global de borradores.
4. Verificar que el cierre programado se ejecute. No añadir UTM web a un destino directo de WhatsApp ni tocar la integración externa del CRM como parte de esta campaña.

## Estado de ejecución

**Configuración activa y verificada por Graph API; dos conjuntos y dos anuncios activos; presupuesto diario nominal total conservado en USD 5; sin eventos enviados al píxel/dataset desde este proyecto.** El token se usó solo en memoria para las llamadas autorizadas y no se guardó en Git. La integración externa del CRM se toma como configurada por declaración de Alex y permanece fuera del alcance de esta tarea.

Relacionado: [[../../../../_memoria-del-proyecto|Memoria]] · [[../../../../_pendientes|Pendientes]] · [[README|Pauta]].
