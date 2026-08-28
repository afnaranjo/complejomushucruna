---
titulo: "Auditoría funcional de vistas de Cronopost y Producción en Notion"
responsable: "marketing, comunidad, datos y tecnología"
estado: en-revision
ultima_actualizacion: 2026-08-28
fuente: "auditoría de solo lectura mediante API oficial de Notion y documentación oficial"
confidencialidad: interno
tags:
  - feria-finados-2026
  - notion
  - cronopost
  - qa
  - diagnostico
---

# Auditoría funcional de vistas de Cronopost y Producción en Notion

> [!important] Diagnóstico
> Las 12 vistas auditadas sí apuntan a la misma fuente `Cronopost y Producción`. El problema no es una desconexión de datos: son tres configuraciones de vista incorrectas o incompletas.

## Alcance y estado observado

La consulta se ejecutó el 2026-08-28 en modo de solo lectura sobre la única fuente compartida identificada como `Cronopost y Producción`. No se modificaron páginas, tareas, responsables, propiedades, filtros o vistas.

Se verificó:

- 12 vistas asociadas a la misma fuente;
- cinco registros operativos visibles: las cuatro tareas de Semana 1 y una fila sin título;
- las dos tareas gráficas con responsable y las dos tareas audiovisuales con responsable;
- el Kanban devuelve los cinco registros operativos, por lo que recibe correctamente los datos de la fuente;
- la vista `My tasks` devuelve cero registros;
- ninguna tarea visible estaba asignada a Alex en el corte de la auditoría. La prueba que Alex reportó no aparecía en esta fuente, por lo que debe comprobarse si se guardó en otra réplica, si no llegó a persistirse o si fue retirada posteriormente. No se infiere una causa sin evidencia adicional.

## Causas verificadas

### 1. `My tasks` no puede resolver `me` desde la integración interna

La vista guarda un filtro rápido `Responsable contiene me`. La conexión usada es una integración interna identificada como bot, no una sesión humana. Notion documenta que, para una integración interna, `me` no representa a ningún usuario y un filtro `contains: "me"` devuelve cero resultados. Esto coincide exactamente con la consulta de la vista.

Además, la vista presenta dos residuos de la muestra inicial:

- no tiene guardado como filtro principal `Tipo de registro = Operativo`;
- agrupa por `Estado histórico (muestra)` en lugar de `Estado de producción`.

Por tanto, la vista existe y referencia la fuente correcta, pero no implementa el comportamiento operativo esperado.

### 2. El Kanban recibe responsables, pero oculta la propiedad

`01 · Kanban de producción` está correctamente conectado, filtra `Tipo de registro = Operativo`, agrupa por `Estado de producción` y devuelve las cinco filas. Sin embargo, su configuración de tarjeta no declara `Responsable` como propiedad visible. El dato está en la tarea, pero la tarjeta no lo muestra.

### 3. `All tasks` conserva un campo histórico

`All tasks` muestra y usa para ordenamiento `Estado histórico (muestra)`. Para operación real debe mostrar `Estado de producción` y ordenar con criterios vigentes, no con el campo de QA histórico.

## Estado del resto de vistas

Las vistas `00`–`08` y `99 · QA · Pruebas` referencian la misma fuente. En el corte auditado:

- Maestro, Kanban, campaña/fase y responsable devolvieron los cinco registros operativos;
- Gantt y calendario devolvieron las cuatro tareas con fechas;
- bloqueadas/vencidas, listas para Community y cerradas devolvieron cero, coherente con el estado actual de las tareas;
- QA devolvió cero porque no había filas con `Tipo de registro = Prueba` visibles en esta fuente.

## Configuración correcta recomendada

### `My tasks`

Debe configurarse desde una cuenta humana en la interfaz de Notion y guardarse para todos:

1. filtro `Tipo de registro = Operativo`;
2. filtro `Responsable contiene Me`;
3. combinación `AND` entre ambos filtros;
4. agrupación por `Estado de producción`;
5. propiedades visibles: `Responsable`, `Fecha límite de entrega`, `Prioridad` y `Tipo de pieza`.

Notion documenta que el valor `Me` creado desde la interfaz es dinámico según la persona conectada. No debe volver a crearse por API con el token de la integración interna. Como alternativa no dinámica, se pueden crear vistas personales con el identificador explícito de cada responsable.

### `01 · Kanban de producción`

Debe conservar el filtro y la agrupación actuales, pero mostrar en cada tarjeta:

- `Responsable`;
- `Fecha límite de entrega`;
- `Prioridad`;
- `Tipo de pieza`.

### `All tasks` y altas nuevas

- reemplazar `Estado histórico (muestra)` por `Estado de producción`;
- ordenar por fecha límite y prioridad;
- definir una plantilla de alta con `Tipo de registro = Operativo` y `Estado de producción = Solicitada`;
- revisar la fila operativa sin título y archivarla de forma reversible solo después de confirmar que no contiene trabajo válido.

## Prueba de aceptación propuesta

1. Alex crea una tarea con título inequívoco, `Tipo de registro = Operativo`, `Estado = Solicitada` y `Responsable = Alex`.
2. Se comprueba que aparece en Maestro, Kanban, Entregas —si tiene fecha— y `My tasks`.
3. Una segunda persona abre la misma vista y verifica que no ve la tarea de Alex salvo que también esté asignada.
4. Esa persona se asigna otra tarea y confirma que su sesión muestra únicamente la suya en `My tasks`.
5. Se comprueba que el Kanban enseña responsable, fecha, prioridad y tipo de pieza sin abrir la tarjeta.

## Fuentes técnicas

- [Working with views — Notion API](https://developers.notion.com/guides/data-apis/working-with-views), consulta: 2026-08-28.
- [Filter database entries — Notion API](https://developers.notion.com/reference/post-database-query-filter), consulta: 2026-08-28.
- [Changelog: `me` relative filter for people properties — Notion API](https://developers.notion.com/page/changelog), consulta: 2026-08-28.
- [Sprint planning: vista dinámica `Me` — Notion Help](https://www.notion.com/help/guides/product-engineering-notion-sprint-planning), consulta: 2026-08-28.

## Conexiones

- [[2026-08-27_replicacion-aislada-notion-cronopost-finados-2026_v01|Réplica aislada del sistema Notion]]
- [[2026-08-27_diseno-sistema-notion-cronopost-finados-2026_v01|Diseño del sistema Notion]]
- [[2026-08-25_calendario-expectativa-es-tradicion-finados-2026_v01|Calendario de expectativa]]
- [[_pendientes|Pendientes ejecutivos]]

[[README|Volver a contenido]]
