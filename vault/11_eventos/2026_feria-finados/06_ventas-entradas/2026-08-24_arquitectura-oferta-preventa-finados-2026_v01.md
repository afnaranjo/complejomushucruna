---
titulo: "Arquitectura de oferta y preventa Feria de Finados 2026"
responsable: "ventas, entradas y finanzas"
estado: en-revision
ultima_actualizacion: 2026-08-27
fuente: "decisiones de Alex Naranjo, estrategia competitiva y adenda V09"
confidencialidad: restringido
tags: [feria-finados-2026, entradas, preventa, oferta]
---

# Arquitectura de oferta y preventa

## Hechos y pendientes

### Confirmado por Alex para planificación

- Entrada general de adulto: **USD 3**.
- El acceso al megaescenario tendrá un costo adicional.

### Por confirmar

- si USD 3 corresponde a cada día y si permite reingreso;
- precio de niños, edades, cortesías y personas con condiciones especiales;
- qué zonas/actividades incluye la entrada general;
- parqueadero, atracciones y otros cobros;
- precio, aforo y programación del megaescenario por noche;
- si el combo nocturno incluye automáticamente los USD 3 de entrada general;
- comisiones, impuestos, devolución, transferencia y canales de venta.

Hasta resolverlos, el precio puede usarse para modelar, pero no se publica.

## Productos propuestos

| Producto | Precio | Función | Regla de transparencia |
|---|---:|---|---|
| Entrada general adulto por día | USD 3 | acceso base a la feria | enumerar exactamente qué incluye y qué no |
| Acceso adicional megaescenario por noche | por confirmar | espectáculo nocturno | mostrar artista, horario, aforo, condiciones y total |
| Combo noche | USD 3 + precio de megaescenario, salvo otra aprobación | una sola compra para entrada + concierto | el comprador ve un total único antes de pagar |
| Pase general 5 días | referencia bruta USD 15; precio por aprobar | asegurar repetición | cualquier descuento debe respetar margen y capacidad |
| Pase de varias noches | por diseñar | elevar compromiso e ingreso por comprador | no vender antes de confirmar programación y aforo |

No usar `desde USD 3` para promocionar el megaescenario si la persona necesita pagar otro valor para ingresar al concierto.

## Mecánicas V09 para modelar

Estas mecánicas fueron incorporadas a la [[../05_marketing-comunicacion/01_estrategia/2026-08-27_adenda-guia-creativa-operativa-es-tradicion-finados-2026_v09|adenda V09]] como diseño; todavía no autorizan venta ni publicación.

| Mecánica | Producto | Regla principal | Gate |
|---|---|---|---|
| `Primer Día en Compañía` | 2x1 limitado del Día 1 | una compra genera dos accesos del producto/jornada definidos; cupo real y control antifraude | margen, SKU, cupo, términos, capacidad y conciliación |
| Preventa con entrada general incluida | bundle de acceso general + producto nocturno confirmado | comunicar `incluida`, no `gratis`; mostrar precio total y componentes | contratos, inventario, condiciones, canal seguro y compra de prueba |
| Disponibilidad por localidad | estado de inventario por producto/jornada/localidad | `Agotado` solo cuando inventario vendible = 0; cada corte lleva hora y aprobador | capacidad, ventas, reservas, cortesías, bloqueos y devoluciones conciliados |

Hasta nueva aprobación financiera, el 2x1 y el bundle de preventa son **no acumulables** entre sí ni con otros descuentos. La regla debe coincidir antes del CTA y en pieza, producto, checkout, FAQ, caja y soporte. Si una persona califica para dos beneficios, el sistema aplica y muestra el mayor beneficio monetario cuando sean comparables o permite elegir expresamente antes del pago; Finanzas debe aprobar jerarquía y códigos incompatibles.

Las tarifas preferenciales, exoneraciones y demás derechos establecidos por la normativa vigente no son descuentos promocionales. Deben permanecer disponibles; Legal valida acreditación, alcance y compatibilidad con 2x1, bundle u otra mecánica antes de configurar la venta. No se publica ni cobra una regla que pueda desplazar un derecho aplicable. Referencias oficiales consultadas el 2026-08-27: [Ley Orgánica de las Personas con Discapacidad vigente desde 2025](https://www.asambleanacional.gob.ec/es/leyes-aprobadas?fecha=&leyes-aprobadas=All&title=Ley+org%C3%A1nica+de+las+personas+con+discapacidad) y [síntesis oficial de la Ley Orgánica de las Personas Adultas Mayores](https://www.asambleanacional.gob.ec/sites/default/files/ley_adulto_mayor.pdf). La aplicación concreta requiere revisión jurídica.

`Agotado` siempre nombra el alcance: lote, localidad, jornada o evento. No se extrapola un lote agotado al resto del producto. `Disponibilidad limitada` necesita fórmula objetiva, cantidad o porcentaje restante cuando sea seguro y hora de corte. Una pausa operativa se comunica como `venta pausada/cerrada`. Si se liberan reservas o se aprueba nuevo cupo, se anuncia `cupos liberados` o `nuevo bloque habilitado`, conservando el historial.

El [[ledger-cortes-inventario.csv|ledger de cortes de inventario]] es append-only y constituye la evidencia para comunicar disponibilidad. El [[forecast-entradas.csv|forecast]] sirve para planificación y no autoriza estados públicos. Mientras falten filas reales de todos los productos, lotes y localidades, o un corte no tenga `corte_id`, aprobador, validación de Datos y vigencia, Marketing no publica `disponible`, `limitado` ni `agotado`.

## Tesis de preventa

USD 3 es una barrera baja, pero también un compromiso débil. La preventa general puede ayudar a planificar; la preventa que realmente asegura público debe priorizar **combos nocturnos y pases**, donde existe una elección de fecha, capacidad y valor mayor.

Con USD 3 de ingreso bruto serían necesarias al menos 1.334 entradas adultas atribuibles para igualar USD 4.000 de pauta, antes de considerar impuestos, comisiones, costos variables y ventas que habrían ocurrido sin publicidad. Por eso el retorno debe evaluarse con margen y mezcla de productos, no solo con cantidad de entradas generales.

## Ventanas propuestas

| Ventana | Fechas | Producto | Incentivo permitido |
|---|---|---|---|
| Registro prioritario | D-65 a D-52 | sin cobro | aviso de apertura, elección de jornada e itinerario |
| Preventa 1 | D-51 a D-38 | combo/pase confirmado | primer lote con cantidad y precio reales |
| Preventa 2 | D-37 a D-14 | jornadas/productos revelados | segundo lote o precio regular temprano |
| Venta regular | D-13 a D-1 | todos los productos confirmados | prueba, agenda y disponibilidad |
| Venta durante feria | Día 1–Día 5; fechas en fuente controlada | inventario diario | servicio y capacidad en tiempo real |

Las fechas dependen de boletería, oferta, tracking, contratos y seguridad. No se abre un lote sin esas aprobaciones.

## Gates comerciales propuestos

Medir por cada noche, no solo el total del evento:

- D-29: 15% del aforo seguro vendido;
- D-14: 35% vendido;
- D-1: 60% vendido;
- saldo disponible: venta tardía y sitio, sin sobreventa.

Estos porcentajes son metas de trabajo pendientes de aprobación. Si una noche no avanza, primero se diagnostican artista, mensaje, precio, fecha, competencia y fricción; no se aplica descuento automático.

## Incentivos que agregan valor sin ocultar costos

- precio de lote protegido hasta fecha/cantidad real;
- QR y confirmación inmediata;
- carril de ingreso de preventa únicamente si Operaciones lo habilita;
- itinerario personalizado por día/noche;
- recordatorio de movilidad y horario;
- acceso anticipado a información, no a rumores;
- beneficio de pase multijornada aprobado por Finanzas.

No usar escasez ficticia, descuentos permanentes ni regalos condicionados a likes/compartidos.

## Página de producto

Cada producto muestra antes del pago:

1. fecha y horario;
2. zonas incluidas;
3. megaescenario incluido o no;
4. artista/actividad confirmada;
5. precio total y comisión;
6. edad y documento requerido;
7. reingreso, transferencia y restricciones;
8. política de cambio/cancelación/reembolso;
9. movilidad, acceso y ayuda;
10. sello de última actualización.

## Medición

- ID de orden único;
- producto, día, noche, cantidad, valor y moneda;
- lote y precio;
- UTM/aliado/artista;
- nuevo comprador o repetición;
- estado: cobrado, anulado, reembolsado, validado;
- costo de adquisición e ingreso neto;
- asistencia efectiva por producto.

No almacenar datos personales de compradores en Git.

## Navegación

- [[README|Ventas y entradas]]
- [[../05_marketing-comunicacion/01_estrategia/2026-08-24_estrategia-competitiva-preventa-participacion-finados-2026_v01|Estrategia competitiva y preventa]]
- [[../09_finanzas-compras/README|Finanzas y compras]]
- [[../10_tecnologia-datos/README|Tecnología y datos]]
- [[../12_servicio-experiencia/README|Servicio y experiencia]]
- [[../05_marketing-comunicacion/01_estrategia/2026-08-27_adenda-guia-creativa-operativa-es-tradicion-finados-2026_v09|Adenda V09]]
