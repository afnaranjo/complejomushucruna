---
titulo: "Modelo aprobado de tareas madre y subtareas en Bitrix para Finados 2026"
responsable: "dirección integral de la feria"
estado: aprobado
ultima_actualizacion: 2026-08-31
fuente: interna
confidencialidad: interno
tags:
  - feria-finados-2026
  - bitrix
  - tareas
  - gobernanza
---

# Modelo de tareas madre y subtareas en Bitrix

## Decisión aprobada

Alex indicará en cada caso cuál es la tarea principal que debe funcionar como **tarea madre**. No se crearán automáticamente madres para todos los frentes ni se cargarán lotes completos sin su revisión.

En las cargas futuras autorizadas:

- Andrés Flores será el responsable operativo de la tarea madre en Bitrix;
- la tarea madre consolidará alcance, seguimiento, bloqueos, subtareas y gate de cierre;
- cada subtarea tendrá como responsable a la persona que realmente ejecuta ese entregable;
- Andrés Flores dará seguimiento a las subtareas, pero no sustituirá a sus ejecutores;
- el dueño del dato y el aprobador del frente conservarán su autoridad aunque Andrés Flores figure como responsable de coordinación de la madre;
- Alex Naranjo tendrá visibilidad como observador; los demás observadores se agregarán según el tipo de trabajo y el [[../05_marketing-comunicacion/2026-08-24_equipo-operativo-marketing-finados-2026_v01|flujo operativo confirmado]].

Esta regla rige la preparación futura. No autoriza crear, mover, borrar, reasignar o cerrar tareas existentes.

## Jerarquía

```text
Collab FINADOS 2026
└── [MADRE] Proceso principal indicado por Alex
    ├── Subtarea entregable · responsable real A
    ├── Subtarea entregable · responsable real B
    ├── Subtarea entregable · responsable real C
    └── Evidencias y pasos simples dentro de cada subtarea
```

El Collab ya funciona como contenedor del evento. Los frentes integrales se conservan como clasificación y gobierno; no se crea una supertarea adicional salvo instrucción expresa de Alex.

## Cuándo crear una subtarea

Se crea una subtarea cuando cambia al menos uno de estos elementos:

1. responsable ejecutor;
2. fecha de inicio o vencimiento;
3. aprobador o gate;
4. dependencia con otro entregable;
5. evidencia necesaria para cerrar;
6. resultado verificable.

Un paso permanece como checklist cuando comparte responsable, fecha, aprobador, dependencia y evidencia con la tarea que lo contiene.

## Parentesco frente a dependencia

- **Padre–hija:** indica pertenencia. La subtarea forma parte de la tarea madre.
- **Dependencia Gantt:** indica secuencia o condición temporal entre dos tareas ejecutables.
- Estar debajo de una madre no significa depender temporalmente de todas sus hermanas.
- Las dependencias se crean entre subtareas concretas, no entre tareas madre completas, salvo una excepción aprobada.
- La relación Gantt no sustituye el gate: la condición también se escribe en la descripción, checklist o control de resultado.

## Configuración de la tarea madre

Cada madre debe contener como mínimo:

| Campo | Regla |
|---|---|
| nombre | prefijo `[MADRE]`, código estable y proceso aprobado por Alex |
| responsable Bitrix | Andrés Flores |
| objetivo | resultado integral que debe coordinar |
| alcance | qué incluye y qué queda fuera |
| dueño del dato / aprobador | frente que valida el contenido o resultado |
| subtareas | inventario aprobado antes de cargar |
| gate de cierre | condición y evidencia para considerar completo el proceso |
| observadores | Alex Naranjo y quienes correspondan por frente |
| cierre | manual y controlado; nunca cerrar automáticamente hijos pendientes |

La madre es una unidad de coordinación. No debe duplicar horas, evidencia o ejecución ya registradas en sus subtareas.

## Configuración de cada subtarea

Cada subtarea debe incluir:

- objetivo y entregable específico;
- responsable real de ejecución;
- participante o apoyo cuando corresponda;
- Andrés Flores como seguimiento de la cadena de trabajo;
- aprobador y dueño del dato;
- inicio, vencimiento y prioridad;
- padre canónico;
- dependencias previas y posteriores;
- gate y evidencia obligatoria;
- estado del dato: `verificado`, `por confirmar`, `hipótesis` o `histórico`;
- restricciones de confidencialidad, derechos, seguridad u operación.

## Ejemplo aprobado de estructura

Cuando Alex indique `Venta y gestión de stands` como principal:

```text
[MADRE] F26-04-EXP · Venta y gestión de stands
Responsable: Andrés Flores

├── Validar plano, capacidad e inventario de stands
├── Aprobar categorías, zonificación y política de selección
├── Aprobar tarifas, beneficios, términos y meta de ocupación
├── Preparar kit comercial, FAQ y canal seguro
├── Captar, calificar y dar seguimiento a prospectos
├── Gestionar contratos, reservas, pagos y asignaciones
├── Ejecutar onboarding y levantar requisitos técnicos
├── Integrar expositores confirmados al mapa y a las rutas
├── Operar atención y recuperación de zonas durante la feria
└── Conciliar ocupación, cobros, satisfacción y renovación
```

Cada línea tendrá su ejecutor real. Los prospectos o expositores individuales vivirán en el sistema comercial autorizado; solo se convertirán en subtareas cuando exista un handoff operativo con responsable, fecha o evidencia propios.

## Flujo de carga gradual

1. Alex nombra la tarea madre.
2. Se diseña fuera de Bitrix la lista completa de subtareas, responsables, fechas, gates y dependencias.
3. Alex revisa y aprueba esa estructura.
4. Se inventaría en solo lectura el Collab para evitar duplicados.
5. Se crea únicamente la madre autorizada.
6. Se crean sus subtareas aprobadas y se vinculan al padre.
7. Se agregan checklists y evidencias.
8. Se agregan dependencias después de validar que no formen ciclos.
9. Se verifican responsable, padre, observadores, fechas, estado, etapa Kanban, checklist y dependencias.
10. Se documenta el resultado sin copiar credenciales, enlaces privados ni identificadores internos al repositorio público.

No se borra ni recrea una tarea para corregirla. Cada carga debe usar claves estables, detectar duplicados y detenerse ante ambigüedad.

## Estado al 31 de agosto

- El modelo está aprobado para organizar futuras cargas.
- No se creó ni modificó ninguna tarea en Bitrix como resultado de esta decisión.
- Las cuatro tareas existentes de Semana 1 permanecen intactas.
- Cada tarea madre y sus hijos se revisarán por separado antes de subirlos.

## Referencias

- [[../README|Centro integral de la feria]]
- [[plan-maestro|Plan maestro]]
- [[raci-integral|RACI integral]]
- [[registro-decisiones|Registro de decisiones]]
- [[../03_expositores/README|Frente de expositores]]
- [[../05_marketing-comunicacion/2026-08-26_analisis-tareas-historicas-y-sistema-operativo-finados-2026_v01|Análisis de 188 tareas, 17 paquetes y 73 entregables]]
- [[../../../14_operaciones/bitacora-diaria/2026-08-28_bitacora_correccion-roles-dependencias-bitrix-finados-2026_v01|Corrección de roles y dependencias de Semana 1]]
