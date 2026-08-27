---
titulo: "Diccionario de datos Feria de Finados 2026"
responsable: "analítica"
estado: borrador
ultima_actualizacion: 2026-08-27
fuente: interna
confidencialidad: restringido
tags: [feria-finados-2026, medicion]
---

# Diccionario de datos

| Métrica/evento | Definición | Unidad | Alcance | Sistema fuente | Responsable | Frecuencia |
|---|---|---|---|---|---|---|
| visita_validada | Una validación de acceso admitida; la misma persona puede producir una por cada jornada permitida | entradas | Feria Finados 2026 | acceso | acceso/datos | por hora y diario |
| venta_neta | Ingreso cobrado menos descuentos y reembolsos | USD | por definir | ventas/finanzas | por asignar | diario |
| lead_expositor | Organización que cumple criterio mínimo | organizaciones | por definir | CRM/control comercial | por asignar | semanal |
| gasto_social | Inversión pagada en redes; excluye producción, influencers y medios tradicionales | USD | Feria Finados 2026 | plataforma/facturación | pauta/finanzas | diario |
| conversacion_calificada | Consulta con intención, datos mínimos aprobados y siguiente paso | conversaciones | Feria Finados 2026 | atención/CRM | comunicación/ventas | diario |
| compra_real | Orden cobrada menos anulaciones y reembolsos, con ID único | órdenes | Feria Finados 2026 | boletería/finanzas | ventas/finanzas | diario |
| roas_conciliado | Ingreso neto atribuible dividido para gasto social | razón | Feria Finados 2026 | boletería + finanzas + pauta | datos/finanzas | semanal/cierre |
| postulacion_valida | Artista o agrupación que entregó requisitos, derechos y datos mínimos dentro del plazo | postulaciones | Camino al Megaescenario | formulario/expediente de programación | programación/datos | diario durante convocatoria |
| voto_verificado | Selección emitida una vez por una persona identificada bajo la regla aprobada, después de excluir duplicados o fraude | votos válidos | Camino al Megaescenario | sistema propio de votación | datos/programación | diario durante votación/cierre |
| registro_prioritario | Persona con consentimiento que solicita aviso de preventa y queda identificada de forma no duplicada | personas | preventa Finados 2026 | formulario/CRM | marketing/ventas/datos | diario |
| capacidad_vendida | Entradas netas cobradas divididas para el cupo vendible del producto, fecha y zona | porcentaje | entrada general, combo o megaescenario | boletería/capacidad aprobada | ventas/datos/finanzas | diario |
| localidad | Zona o categoría comercial/técnica de un producto de entrada, con ID, nombre público, jornada y capacidad autorizada | dimensión | oferta Finados 2026 | catálogo de boletería + plano aprobado | ventas/operaciones/datos | por versión |
| lote_id | Identificador inmutable del bloque de precio o cupo dentro de un producto, jornada y localidad | dimensión | oferta Finados 2026 | catálogo de boletería | ventas/datos | por alta/cambio |
| ventas_brutas_unidades | Unidades cobradas antes de devoluciones o anulaciones | entradas | producto/lote/jornada/localidad | boletería | ventas/datos | por corte |
| devoluciones_unidades | Unidades con devolución o anulación financiera; no implica por sí sola que recuperen capacidad vendible | entradas | producto/lote/jornada/localidad | boletería/finanzas | ventas/datos/finanzas | por corte |
| devoluciones_reintegradas_inventario | Subconjunto de devoluciones cuya entrada quedó invalidada y volvió al inventario según política y control de acceso | entradas | producto/lote/jornada/localidad | boletería + acceso | ventas/datos/operaciones | por corte |
| ventas_netas_unidades | `ventas_brutas_unidades - devoluciones_reintegradas_inventario`; ninguna devolución se resta de nuevo en inventario | entradas | producto/lote/jornada/localidad | boletería | ventas/datos | por corte |
| reserva_vigente | Unidad temporalmente retirada del inventario, con causa, ID y expiración definida | entradas | producto/jornada/localidad | boletería | ventas/datos | por corte |
| hold_expira_en | Fecha/hora con zona `America/Guayaquil` en la que una reserva no cobrada vuelve al inventario, salvo extensión aprobada | fecha/hora | reserva de entrada | boletería | ventas/datos | por transacción |
| bloqueo_inventario | Cupo retirado por producción, seguridad, cortesía o contingencia, con dueño, motivo y vigencia | entradas | producto/jornada/localidad | capacidad maestra | operaciones/ventas/datos | por cambio |
| inventario_vendible | `capacidad_autorizada - ventas_netas_unidades - reservas_vigentes - cortesias - bloqueos - contingencia`, por producto/lote/jornada/localidad | entradas | oferta Finados 2026 | boletería + capacidad maestra | ventas/datos/operaciones | por corte y antes de comunicar |
| estado_disponibilidad | Disponible, disponibilidad limitada o agotado derivado del inventario vendible y un umbral preaprobado | estado | producto/jornada/localidad | inventario conciliado | ventas/datos | por corte |
| corte_inventario | Snapshot append-only con `corte_id`, estado anterior/nuevo, motivo, fuente, aprobador, validación de Datos y vigencia | corte | producto/lote/jornada/localidad | ledger de cortes | ventas/datos | antes de cada publicación/cambio |
| vence_estado | Fecha/hora `America/Guayaquil` después de la cual Marketing retira o revalida el estado publicado | fecha/hora | corte de inventario | ledger de cortes | ventas/datos/marketing | por corte |
| beneficio_2x1_emitido | Orden válida del piloto Día 1 que genera dos accesos bajo el SKU y términos aprobados | órdenes/entradas | Primer Día en Compañía | boletería | ventas/datos/finanzas | diario |
| beneficio_2x1_canjeado | Accesos del 2x1 efectivamente validados, sin duplicación | entradas | Primer Día en Compañía | acceso + boletería | ventas/datos | diario/cierre |
| bundle_preventa_vendido | Orden cobrada del paquete que incluye entrada general y el producto confirmado, menos anulaciones/reembolsos | órdenes/USD | preventa Finados 2026 | boletería/finanzas | ventas/finanzas/datos | diario |
| visitante_unico_estimado | Persona distinta estimada mediante el método aprobado, separada de sus reingresos y visitas en otras jornadas | personas | Feria Finados 2026 | acceso/estimación documentada | datos/acceso | diario/cierre |
| retorno_validado | Visita posterior asociada de forma válida a una visita elegible anterior | retornos | beneficio de retorno Finados 2026 | acceso/caja | ventas/datos | diario |
| referido_validado | Entrada o compra admitida asociada a un código de creador/aliado, sin duplicidad ni anulación | personas u órdenes | programa de referidos | caja/acceso | alianzas/datos/finanzas | diario |
| vista_valida_creador | Visualización aceptada según plataforma y contrato, excluyendo fraude, promoción pagada no autorizada y señales artificiales | vistas | programa de creadores | plataforma/evidencia contractual | alianzas/datos | semanal/cierre |
| pieza_expositor_valida | Video de un expositor que cumple bases, derechos, ventana y controles antifraude | piezas | De emprendedor a influencer | expediente de activación | expositores/alianzas/datos | semanal/cierre |
| visita_puesto_validada | Presencia física única confirmada en el puesto o punto aprobado, deduplicada y asociada al expositor; abrir un QR solo inicia el flujo y no acredita visita | visitas | De emprendedor a influencer | validación física en punto + código/registro auditable | expositores/datos | diario/cierre |
| grupo_comunitario_activo | Grupo con administrador autorizado, adhesión vigente, kit correcto y al menos una acción dentro de frecuencia permitida | grupos | activación de comunidades | registro de alianzas | alianzas/comunicación | semanal |
| espectador_live_cualificado | Espectador único que supera el umbral versionado antes del live o realiza una acción verificable dentro de la ventana aprobada; si la plataforma no expone el dato, no se estima como exacto | personas | Conversaciones ES TRADICIÓN | plataforma + analítica | comunicación/datos | por live |
| retencion_live_normalizada | `minutos_vistos_totales / (reproducciones_iniciadas × duracion_live_minutos)`; comparar solo con igual plataforma y definición | razón 0–1 | Conversaciones ES TRADICIÓN | plataforma | comunicación/datos | por live |
| accion_post_live | CTA verificable por UTM/código dentro de la ventana de atribución aprobada antes de transmitir | acciones | Conversaciones ES TRADICIÓN | analítica/CRM/boletería | comunicación/datos | por live |
| correccion_live | Corrección pública emitida por dato incorrecto o desactualizado, con causa y tiempo de resolución | correcciones | Conversaciones ES TRADICIÓN | bitácora de moderación | comunicación/datos | inmediata/cierre |
| incidente_live | Falla de derechos, embargo, moderación, seguridad o técnica que activa escalamiento o corte | incidentes | Conversaciones ES TRADICIÓN | bitácora de moderación/producción | comunicación/producción | inmediata/cierre |
| satisfaccion_plaza_luna | Evaluación de comprensión, respeto, experiencia y operación de la propuesta cultural aprobada | escala/porcentaje | Plaza de la Luna | encuesta/observación aprobada | cultura/experiencia/datos | por jornada/cierre |
| uso_mapa | Apertura agregada del mapa o de una ficha de ubicación, sin identificar a la persona | eventos | guía móvil informativa | analítica mínima aprobada | tecnología/datos | diario |
| discrepancia_guia | Diferencia confirmada entre mapa/agenda móvil y el recinto o programación operativa | incidentes | guía móvil informativa | servicio/QA | tecnología/operaciones | inmediata |
| flujo_zona | Ingresos o cruces contabilizados en un acceso de zona y franja, sin tratar cada cruce como persona única | cruces | zonas comerciales de Finados 2026 | conteo manual/sensor aprobado | operaciones/datos | por hora |
| venta_expositor_rango | Banda confidencial de venta neta declarada voluntariamente por una muestra de expositores | rango USD | muestra comercial Finados 2026 | encuesta/finanzas del expositor | expositores/datos | diario/cierre |
| expositor_cubre_costos | Expositor de la muestra que declara ventas suficientes para cubrir sus costos directos de participación según definición acordada | porcentaje | muestra comercial Finados 2026 | encuesta confidencial | expositores/datos | cierre |
| satisfaccion_expositor | Evaluación de ubicación, flujo, soporte, ventas y probabilidad de volver | escala/porcentaje | expositores Finados 2026 | encuesta | expositores/experiencia | diario/cierre |

Las definiciones son preliminares hasta que los responsables aprueben alcance y sistemas.

El contrato ampliado está en [[../05_marketing-comunicacion/06_medicion/2026-08-24_plan-medicion-digital-finados-2026_v01|Plan de medición digital]]. Las métricas V09 no se implementan hasta aprobar producto, fuente, responsable, privacidad y evidencia.
