---
titulo: "Arquitectura de oferta y preventa Feria de Finados 2026"
responsable: "ventas, entradas y finanzas"
estado: en-revision
ultima_actualizacion: 2026-08-24
fuente: "decisión de Alex Naranjo y estrategia competitiva"
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

## Tesis de preventa

USD 3 es una barrera baja, pero también un compromiso débil. La preventa general puede ayudar a planificar; la preventa que realmente asegura público debe priorizar **combos nocturnos y pases**, donde existe una elección de fecha, capacidad y valor mayor.

Con USD 3 de ingreso bruto serían necesarias al menos 1.334 entradas adultas atribuibles para igualar USD 4.000 de pauta, antes de considerar impuestos, comisiones, costos variables y ventas que habrían ocurrido sin publicidad. Por eso el retorno debe evaluarse con margen y mezcla de productos, no solo con cantidad de entradas generales.

## Ventanas propuestas

| Ventana | Fechas | Producto | Incentivo permitido |
|---|---|---|---|
| Registro prioritario | 25 ago–7 sep | sin cobro | aviso de apertura, elección de noche e itinerario |
| Preventa 1 | 8–21 sep | combo/pase confirmado | primer lote con cantidad y precio reales |
| Preventa 2 | 22 sep–15 oct | noches reveladas | segundo lote o precio regular temprano |
| Venta regular | 16–28 oct | todos los productos confirmados | prueba, agenda y disponibilidad |
| Venta durante feria | 29 oct–2 nov | inventario diario | servicio y capacidad en tiempo real |

Las fechas dependen de boletería, oferta, tracking, contratos y seguridad. No se abre un lote sin esas aprobaciones.

## Gates comerciales propuestos

Medir por cada noche, no solo el total del evento:

- 30 de septiembre: 15% de aforo seguro vendido;
- 15 de octubre: 35% vendido;
- 28 de octubre: 60% vendido;
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
