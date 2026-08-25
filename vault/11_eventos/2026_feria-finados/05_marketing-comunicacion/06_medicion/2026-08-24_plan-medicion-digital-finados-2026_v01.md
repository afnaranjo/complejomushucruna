---
titulo: "Plan de medición digital Feria de Finados 2026"
responsable: "analítica de marketing"
estado: en-revision
ultima_actualizacion: 2026-08-24
fuente: "plan operativo digital y auditoría histórica Meta 2021-2026"
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
| visitante_validado | persona con entrada validada en acceso | control de acceso | por jornada | operación |
| satisfaccion | evaluación posvisita con método declarado | encuesta | diario/cierre | experiencia |

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

Son nombres internos; se mapean a la plataforma únicamente después de validar compatibilidad. Navegador y servidor deben deduplicar con el mismo identificador cuando ambos envíen un evento.

## UTM

```text
utm_source=meta|radio_<medio>|tv_<medio>|prensa_<medio>|influencer_<nombre>
utm_medium=paid_social|organic_social|radio|tv|press|creator
utm_campaign=finados_2026_<fase>
utm_content=<concepto>_<formato>_<version>
utm_term=<audiencia_o_ubicacion>
```

No se colocan datos personales en UTMs.

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

- preliminar: 3 de noviembre;
- conciliado: 2 de diciembre;
- incluye gasto, ventas, asistencia, experiencia, conceptos ganadores, fallas y recomendaciones.

## Alertas

- destino caído o redirección ajena: pausar tráfico inmediatamente;
- compra duplicada o valor/moneda incorrectos: detener optimización a compra;
- diferencia creciente entre plataforma y boletería: investigar antes de escalar;
- incapacidad de responder mensajes: reducir o pausar campañas a conversación;
- inventario agotado: excluir producto y corregir todas las piezas;
- discrepancia pública: activar el protocolo de corrección.

## Navegación

- [[README|Índice de medición de la feria]]
- [[../03_pauta/2026-08-24_plan-pauta-social-usd4000-finados-2026_v01|Plan de pauta social]]
- [[../../10_tecnologia-datos/diccionario-datos|Diccionario de datos de la feria]]
- [[../../06_ventas-entradas/README|Ventas y entradas]]
- [[../../15_cierre-aprendizajes/README|Cierre y aprendizajes]]
