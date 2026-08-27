---
titulo: "Réplica aislada del sistema Notion de cronopost Finados 2026"
responsable: "marketing, comunidad, datos y tecnología"
estado: cerrado
ultima_actualizacion: 2026-08-27
fuente: interna
confidencialidad: interno
tags:
  - feria-finados-2026
  - notion
  - cronopost
  - implementacion
  - qa
  - seguridad
---

# Réplica aislada del sistema Notion de cronopost Finados 2026

> [!success] Resultado
> El centro de mando se replicó y verificó dentro de la página nueva y vacía `APLICADOR NUEVO · FINADOS 2026`. No se abrió contenido, renombró, archivó ni modificó ninguna página preexistente del nuevo espacio.

## Alcance autorizado

La intervención se limitó a la página nueva asignada expresamente por Alex. El aplicador recibió su identificador de forma explícita y no utilizó búsqueda durante la construcción o la verificación. Antes de escribir confirmó que la página estaba vacía; en cada reanudación aceptó únicamente bloques, bases, vistas y registros que constaban en su manifiesto temporal como propios.

No se reutilizó ninguna base o página anterior. Tampoco se archivó, movió o eliminó contenido del nuevo espacio.

## Estructura creada

La réplica contiene las siete fuentes conectadas del diseño aprobado:

1. `Campañas y Fases`;
2. `Cronopost y Producción`;
3. `Publicaciones`;
4. `Briefs y Activos`;
5. `Equipo y Responsables`;
6. `Reuniones y Decisiones`;
7. `Bandeja de Ideas`.

El aplicador creó 26 vistas directas curadas y 11 vistas enlazadas para el centro de mando. Notion genera además una tabla inicial automática al crear cada fuente; esas tablas del sistema no se contabilizan entre las 26 vistas curadas.

La arquitectura separa el entregable de producción de cada salida por red. Una tarea puede generar varias publicaciones, cada una con canal, formato, copy, CTA, destino, activo, versión, aprobación, horario, responsable, enlace y métricas propios.

## Ajustes de compatibilidad confirmados

- Las relaciones son bidireccionales y sus extremos recíprocos se nombraron por identificador estable.
- Las propiedades calculadas se crearon una por una, en orden de dependencia, para poder reanudar sin repetir lo ya aceptado.
- Los gates, semáforos, estado operativo, alertas, reprogramación y puntualidad usan fórmulas con tipos homogéneos.
- `Avance operativo` usa el porcentaje de tareas con `Producción terminada`, sin exigir una segunda casilla redundante.
- `Fase` se mantiene como selección directa en `Publicaciones`. Notion rechazó encadenar un rollup sobre otro rollup; la selección directa evita esa dependencia frágil y conserva las siete fases normalizadas.
- Las vistas operativas filtran `Tipo de registro = Operativo`, por lo que los registros sintéticos no contaminan indicadores ni calendarios reales.

## Reanudación segura

La primera ejecución se detuvo ante un error de sintaxis de fórmula y la segunda ante la prohibición de rollups encadenados. En ambos casos:

- no se reintentó automáticamente la escritura rechazada;
- no se duplicaron fuentes, relaciones, vistas o registros;
- el manifiesto temporal conservó los objetos confirmados;
- la reanudación verificó padre, fuente, nombre y pertenencia antes de continuar.

El aplicador también contempla una respuesta perdida después de una creación: reconcilia una única coincidencia dentro de la raíz o fuente propia y aborta si encuentra cero o más de una. Nunca amplía la búsqueda a páginas ajenas.

## QA final de solo lectura

La verificación independiente confirmó:

| Control | Resultado |
|---|---:|
| fuentes propias | 7 |
| vistas directas curadas | 26 |
| vistas enlazadas | 11 |
| registros sintéticos | 7 |
| registros operativos | 0 |
| campaña QA | 1 |
| activo QA | 1 |
| tareas QA | 2 |
| publicaciones QA | 3 |

También se comprobaron los estados calculados `Programada`, `Lista para programar` y `Publicada`, la alerta `Falta programar`, el cierre sintético, la puntualidad y el uso de fecha con offset `-05:00`. Los enlaces de prueba usan dominios reservados `.invalid`; no representan activos ni publicaciones reales.

## Seguridad y límites

- La credencial se introdujo únicamente en una sesión silenciosa y temporal; no se guardó en el repositorio, el vault, el manifiesto ni los scripts.
- No se cargaron nombres del cartel bajo embargo, contratos, contactos, precios no autorizados ni datos personales.
- No se programó ni publicó contenido en redes, no se activó pauta y no se desplegó ningún sitio o aplicación.
- La configuración interna de Notion no sustituye la aprobación de datos, derechos, marca, cultura, operación, seguridad, oferta o destino de conversión.

## Pendientes antes de operar

1. Confirmar las cuentas definitivas y probar permisos mínimos por rol.
2. Validar `America/Guayaquil` y el offset `-05:00` desde dos cuentas reales.
3. Definir responsables, suplentes, revisores y aprobadores definitivos.
4. Decidir las plantillas cotidianas después de probar el flujo con el equipo.
5. Cargar el cronopost real solo desde el calendario controlado y con los gates del dato cerrados.
6. Mantener los siete registros de prueba fuera de las vistas operativas; retirarlos de manera reversible únicamente cuando dirección apruebe el cierre de QA.

## Fuentes técnicas consultadas

- [Create a database — Notion API](https://developers.notion.com/reference/create-database), consulta: 2026-08-27.
- [Working with views — Notion API](https://developers.notion.com/guides/data-apis/working-with-views), consulta: 2026-08-27.
- [Update data source properties — Notion API](https://developers.notion.com/reference/update-data-source-properties), consulta: 2026-08-27.
- [Formula syntax & functions — Notion](https://www.notion.com/help/formula-syntax), consulta: 2026-08-27.

## Conexiones

- [[2026-08-27_diseno-sistema-notion-cronopost-finados-2026_v01|Diseño del sistema Notion]]
- [[2026-08-27_plan-implementacion-notion-cronopost-finados-2026_v01|Plan de implementación]]
- [[2026-08-27_implementacion-notion-cronopost-finados-2026_v01|Implementación inicial]]
- [[../01_estrategia/2026-08-27_adenda-guia-creativa-operativa-es-tradicion-finados-2026_v09|Adenda V09]]
- [[_pendientes|Pendientes ejecutivos]]

[[README|Volver a contenido]]
