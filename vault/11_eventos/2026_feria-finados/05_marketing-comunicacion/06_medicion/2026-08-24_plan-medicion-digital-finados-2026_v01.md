---
titulo: "Plan de medición digital Feria de Finados 2026"
responsable: "analítica de marketing"
estado: en-revision
ultima_actualizacion: 2026-08-27
fuente: "plan operativo digital, auditoría histórica Meta 2021-2026 y adenda V09"
confidencialidad: restringido
tags: [feria-finados-2026, medicion, tracking, kpi]
---

# Plan de medición digital Feria de Finados 2026

## Principio

Cada pregunta tiene una fuente de verdad. Meta informa entrega y costo; analítica informa comportamiento; boletería/caja informa venta cobrada; acceso informa asistencia; operación y encuestas informan experiencia. No se obliga a una plataforma a responder todo.

## Contrato mínimo de métricas

| KPI | Definición | Fórmula/fuente | Frecuencia | Dueño |
|---|---|---|---|---|
| gasto_social | inversión pagada en redes, sin medios externos | Meta/facturación | diario | pauta/finanzas |
| alcance | personas únicas estimadas alcanzadas | plataforma | diario | pauta |
| frecuencia | impresiones / alcance | cálculo agregado | diario | pauta |
| CTR_saliente | clics salientes / impresiones | cálculo agregado | diario | pauta |
| costo_visita_util | gasto / visitas que cargan el destino | Meta + analítica | diario | pauta/datos |
| conversacion_calificada | consulta con intención, ciudad/fecha y siguiente paso | registro de atención | diario | comunicación/ventas |
| compra_real | orden cobrada menos anulaciones/reembolsos | boletería/caja | diario | ventas/finanzas |
| CPA_real | gasto atribuible / compras reales conciliadas | cálculo | diario/semanal | datos/finanzas |
| ingreso_neto | cobros menos descuentos y reembolsos | finanzas | diario | finanzas |
| ROAS_conciliado | ingreso neto atribuible / gasto social | cálculo; solo tras conciliación | semanal/cierre | datos/finanzas |
| visita_validada | validación de acceso admitida; una misma persona puede producir una por cada jornada permitida | control de acceso | por jornada | operación |
| satisfaccion | evaluación posvisita con método declarado | encuesta | diario/cierre | experiencia |
| postulacion_valida | artista que cumple bases y documentación mínima | programación | por convocatoria | programación |
| voto_verificado | voto aceptado después de controles de duplicación/fraude | sistema de votación | diario | datos |
| registro_prioritario | persona que consiente recibir apertura/preventa | formulario/CRM | diario | marketing/ventas |
| capacidad_vendida | entradas netas cobradas / aforo vendible por producto/jornada/localidad | boletería + seguridad | diario | ventas/operaciones |
| inventario_vendible | capacidad autorizada menos ventas netas de unidades, reservas, cortesías, bloqueos y contingencia; solo devoluciones que invalidaron la entrada y fueron reintegradas están dentro de ventas netas | boletería + acceso + capacidad maestra | por corte | ventas/datos/operaciones |
| canje_2x1 | accesos válidos del piloto / accesos 2x1 emitidos | boletería + acceso | diario/cierre | ventas/datos |
| bundle_preventa | órdenes netas del paquete e ingreso neto | boletería + finanzas | diario | ventas/finanzas |
| visita_puesto_validada | presencia física única confirmada en puesto/punto aprobado; el QR por sí solo no acredita visita | validación física + código/registro auditable | diario/cierre | expositores/datos |
| grupo_comunitario_activo | grupo autorizado con acción válida y kit vigente | registro de alianzas | semanal | alianzas/comunicación |
| retencion_live_normalizada | minutos vistos totales / (reproducciones iniciadas × duración del live); solo se compara con igual plataforma/definición | plataforma | por live | comunicación/datos |
| accion_post_live | CTA verificable dentro de la ventana aprobada antes de transmitir | analítica/CRM/boletería | por live | comunicación/datos |
| correccion_o_incidente_live | correcciones e incidentes de derechos, embargo, moderación, seguridad o técnica | bitácora de moderación/producción | inmediata/cierre | comunicación/producción |

No se informa ROAS si las ventas no pueden conciliarse. Se informa gasto, demanda y limitación.

## Eventos y embudo

| Orden | Evento interno | Condición | Fuente |
|---:|---|---|---|
| 1 | `landing_view` | destino cargó correctamente | analítica |
| 2 | `agenda_view` | consultó agenda/producto | analítica |
| 3 | `checkout_started` | inició compra | boletería/analítica |
| 4 | `purchase_confirmed` | orden cobrada con ID, valor y moneda | boletería/finanzas |
| 5 | `entry_validated` | entrada usada en acceso | control de acceso |
| A | `message_started` | inició conversación | mensajería |
| B | `qualified_conversation` | cumple criterio aprobado y tiene siguiente paso | atención/CRM |
| C | `artist_application_valid` | postulación cumple bases | programación |
| D | `verified_vote` | voto aceptado por regla antifraude | sistema propio |
| E | `priority_registration` | registro con consentimiento | CRM/formulario |
| F | `day1_2x1_issued` | orden válida genera el beneficio aprobado | boletería |
| G | `day1_2x1_redeemed` | acceso del beneficio validado sin duplicación | acceso/boletería |
| H | `presale_bundle_purchased` | paquete cobrado con componentes e ID conciliados | boletería/finanzas |
| I | `stand_visit_validated` | presencia física única confirmada en puesto/punto y asociada al expositor; abrir QR no basta | validación física + código/registro auditable |
| J | `community_referral_validated` | ingreso o compra válida asociada a comunidad autorizada | acceso/boletería |
| K | `live_started` | transmisión autorizada comienza con ID, plataforma, duración planificada y versión de medición | plataforma/bitácora |
| L | `live_cta_action` | acción verificable vinculada al CTA dentro de la ventana aprobada | analítica/CRM/boletería |
| M | `live_correction` | corrección registrada con causa, contenido y tiempo de resolución | bitácora de moderación |
| N | `live_incident` | incidente activa escalamiento, pausa o corte | bitácora de moderación/producción |

Son nombres internos; se mapean a la plataforma únicamente después de validar compatibilidad. Navegador y servidor deben deduplicar con el mismo identificador cuando ambos envíen un evento.

Antes de cada live se versionan plataforma, duración, denominador, umbral de cualificación, ventana de atribución, CTA, responsable y SLA de corrección. Si la plataforma no entrega espectadores únicos o minutos comparables, se reporta la métrica disponible con su limitación y no se reconstruye un valor exacto.

## UTM

```text
utm_source=meta|radio_<medio>|tv_<medio>|prensa_<medio>|influencer_<nombre>
utm_medium=paid_social|organic_social|radio|tv|press|creator
utm_campaign=finados_2026_<fase>
utm_content=<concepto>_<formato>_<version>
utm_term=<audiencia_o_ubicacion>
```

No se colocan datos personales en UTMs.

Para finalistas se añade un identificador no sensible en `utm_content` o un parámetro interno aprobado; cada artista recibe enlace propio y se concilian visitas, votos, registros y compras.

## Compra de prueba

Antes de pauta de conversión:

1. abrir el anuncio o URL de prueba con UTM;
2. cargar destino y revisar persistencia;
3. iniciar y completar una compra controlada;
4. comprobar ID, valor, moneda y no duplicación;
5. verificar presencia en analítica, Meta y boletería/caja;
6. documentar diferencias y zona horaria;
7. anular/reembolsar por el procedimiento autorizado, sin borrar registros.

## Tablero y cortes

### Diario

Gasto, entrega, destino, consultas, ventas, inventario, incidentes y cambios.

### Semanal

Resultado por fase, concepto, audiencia y destino; conciliación de fuentes; decisión de escalar, iterar o detener; previsión de presupuesto restante.

### En vivo

Dos cortes diarios con ventas/accesos, ocupación, preguntas, movilidad, incidentes y sentimiento. La comunicación pública usa únicamente datos confirmados por el centro de control.

### Cierre

- preliminar: Día 5 + 1;
- conciliado: 30 días después del cierre, o fecha aprobada por Finanzas;
- incluye gasto, ventas, asistencia, experiencia, conceptos ganadores, fallas y recomendaciones.

## Alertas

- destino caído o redirección ajena: pausar tráfico inmediatamente;
- compra duplicada o valor/moneda incorrectos: detener optimización a compra;
- diferencia creciente entre plataforma y boletería: investigar antes de escalar;
- incapacidad de responder mensajes: reducir o pausar campañas a conversación;
- inventario agotado: excluir producto y corregir todas las piezas;
- diferencia entre estado público e inventario vendible: retirar disponibilidad/agotado y conciliar antes de republicar;
- discrepancia pública: activar el protocolo de corrección.

## Navegación

- [[README|Índice de medición de la feria]]
- [[../03_pauta/2026-08-24_plan-pauta-social-usd4000-finados-2026_v01|Plan de pauta social]]
- [[../../10_tecnologia-datos/diccionario-datos|Diccionario de datos de la feria]]
- [[../../06_ventas-entradas/README|Ventas y entradas]]
- [[../../15_cierre-aprendizajes/README|Cierre y aprendizajes]]
- [[../01_estrategia/2026-08-27_adenda-guia-creativa-operativa-es-tradicion-finados-2026_v09|Adenda V09]]
