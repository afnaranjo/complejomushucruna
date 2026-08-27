---
titulo: "Diseño del sistema Notion de cronopost y publicación Finados 2026"
responsable: "marketing, comunidad y datos"
estado: en-revision
ultima_actualizacion: 2026-08-27
fuente: interna
confidencialidad: interno
tags:
  - feria-finados-2026
  - notion
  - cronopost
  - community-management
  - produccion
  - medicion
---

# Diseño del sistema Notion de cronopost y publicación Finados 2026

> [!important] Estado de este documento
> Alex aprobó la dirección funcional en conversación el 2026-08-27. Esta especificación escrita queda en revisión antes de modificar Notion. No autoriza publicaciones, campañas, revelaciones, ventas ni el uso de información bajo embargo.

## 1. Decisión central

El sistema separará **producir una pieza** de **publicarla en cada red**.

Una tarea de producción puede originar una o varias publicaciones. Cada publicación tendrá su propia red, fecha, hora, copy, responsable, estado, enlace y resultado. Esta separación resuelve un problema habitual: una misma pieza puede salir en Instagram, Facebook, TikTok o LinkedIn en horarios distintos y con adaptaciones diferentes.

```text
Campaña o fase
      │
      ├── Tarea de producción
      │       ├── Publicación en Instagram · fecha/hora propia
      │       ├── Publicación en Facebook · fecha/hora propia
      │       └── Publicación en TikTok · fecha/hora propia
      │
      └── Briefs, activos, responsables y dependencias
```

La fuente operativa seguirá el [[2026-08-24_sistema-contenidos-finados-2026_v01|sistema de contenidos]], la [[../01_estrategia/2026-08-27_adenda-guia-creativa-operativa-es-tradicion-finados-2026_v09|adenda V09]], el [[../2026-08-26_analisis-tareas-historicas-y-sistema-operativo-finados-2026_v01|análisis de 188 tareas históricas]] y el [[../2026-08-24_equipo-operativo-marketing-finados-2026_v01|flujo operativo del equipo]].

## 2. Resultado esperado

El sistema debe permitir que:

1. cualquier requerimiento tenga brief, campaña, prioridad, responsable, dependencias, fecha de producción y fecha límite;
2. diseño y audiovisual vean solo el trabajo que deben producir y su orden;
3. quien produce marque la entrega como lista sin convertirla automáticamente en publicación externa;
4. Community vea inmediatamente qué piezas ya están listas, cuáles debe programar, en qué red y a qué hora;
5. las publicaciones programadas aparezcan en timeline y calendario;
6. las publicaciones realizadas pasen a un historial con hora real, enlace y resultado;
7. dirección vea carga, avance, retrasos, bloqueos y cumplimiento por campaña y responsable;
8. las tareas dependientes aparezcan conectadas en una vista Gantt;
9. los registros de prueba no distorsionen los indicadores;
10. ninguna fecha, artista, precio, cupo, promoción o atractivo se publique sin aprobación del frente dueño del dato.

## 3. Arquitectura de bases

Se reutilizarán las cinco bases iniciales del espacio `Finados 2026`, se archivarán —sin borrar— las páginas de ejemplo y se agregarán dos bases nuevas.

| Base final | Origen | Función principal |
|---|---|---|
| `Campañas y Fases` | renombrar `Projects` | agrupar expectativa, revelación, preventa, conversión, urgencia, evento y cierre |
| `Cronopost y Producción` | renombrar `Tasks` | administrar briefs, piezas, entregables, responsables, fechas, dependencias y aprobación |
| `Publicaciones` | nueva | programar y cerrar cada salida por red, fecha y hora |
| `Briefs y Activos` | renombrar `Docs` | guardar briefs, copies, guiones, archivos o enlaces finales y evidencia de derechos |
| `Equipo y Responsables` | nueva | mantener roles estables, áreas, capacidad y suplencias para reportes |
| `Reuniones y Decisiones` | renombrar `Meetings` | registrar decisiones y aprobaciones que cambian el cronopost |
| `Bandeja de Ideas` | renombrar `Notes` | capturar ideas antes de convertirlas en requerimientos aprobados |

### Relaciones obligatorias

| Origen | Relación | Destino | Cardinalidad |
|---|---|---|---|
| Campaña | contiene | Tareas | 1:N |
| Tarea | genera | Publicaciones | 1:N |
| Tarea | usa | Briefs y activos | N:N |
| Tarea | asigna | Equipo y responsables | N:N |
| Publicación | pertenece a | Tarea | N:1 |
| Publicación | usa | Briefs y activos | N:N |
| Publicación | ejecuta | Community responsable | N:1 |
| Campaña | documenta | Reuniones y decisiones | 1:N |
| Idea | se convierte en | Tarea | 0:1 |
| Tarea | depende de / bloquea | Tarea | N:N autorrelacionada |
| Tarea padre | contiene | Subtareas | 1:N autorrelacionada |

## 4. Modelo de `Campañas y Fases`

| Propiedad | Tipo | Regla |
|---|---|---|
| Nombre | título | nombre breve y reconocible |
| Código | texto | identificador único, sin información bajo embargo |
| Fase | selección | expectativa, revelación, preventa, conversión, urgencia, evento o cierre |
| Estado | estado | borrador, activa, pausada, cerrada o archivada |
| Ventana | fecha con rango | inicio y fin autorizados para planificación |
| Objetivo | texto | resultado esperado |
| Audiencia | texto | segmento principal |
| CTA principal | texto | acción buscada |
| Responsable | persona | dueño operativo invitado a Notion |
| Equipo responsable | relación | respaldo estable para reportes |
| Tareas | relación | entregables asociados |
| Avance operativo | fórmula | tareas operativas cerradas sobre tareas operativas comparables; vacías y pruebas no entran al denominador |
| Riesgo | selección | bajo, medio, alto o crítico |
| Tipo de registro | selección | operativo o prueba |

`Campañas y Fases` no mantendrá una relación directa adicional con `Publicaciones`. La campaña de cada publicación se hereda de su tarea y los conteos se calculan en las vistas del dashboard. Así no puede existir una campaña en la tarea y otra distinta en su publicación.

## 5. Modelo de `Cronopost y Producción`

### Identidad y contexto

| Propiedad | Tipo | Regla |
|---|---|---|
| Tarea | título | verbo + entregable; no usar nombres embargados |
| ID | identificador único (`unique_id`) | correlativo automático de Notion |
| Tipo de registro | selección | `Operativo` o `Prueba`; solo Operativo entra a indicadores |
| Campaña | relación | campaña o fase dueña |
| Fase | resumen (`rollup`) | heredada directamente de Campañas y Fases |
| Tipo de pieza | selección | arte, carrusel, reel, video, live, story, copy, landing, cobertura, reporte u otro |
| Canales destino | multiselección | Facebook, Instagram, TikTok, LinkedIn, YouTube, web/PWA, WhatsApp u otro |
| Solicitante | persona | quien ingresa el requerimiento |
| Coordinador solicitante | relación | registro estable del equipo |

### Brief y evidencia

| Propiedad | Tipo | Regla |
|---|---|---|
| Objetivo | texto | qué debe lograr la pieza |
| Audiencia | texto | para quién se crea |
| Mensaje principal | texto | una promesa o información principal |
| CTA | texto | acción concreta |
| Descripción / instrucciones | texto largo | dirección creativa y operativa completa |
| Especificaciones | texto | medidas, duración, formatos, subtítulos, variantes y peso |
| Referencia | URL | enlace visual o documental |
| Briefs y activos | relación | insumos y evidencia asociados |
| Archivo final | archivos | archivo cargado cuando corresponda |
| Enlace de descarga | URL | fuente oficial o entrega pesada |
| Expediente de derechos | relación | licencia, autorización o consentimiento en Briefs y Activos |
| Nota de derechos | texto | alcance, vigencia y restricción de uso |
| Dueño del dato | relación | frente registrado en Equipo y Responsables |
| Validador del dato | persona | usuario que confirma el dato |

### Responsabilidad, prioridad y tiempo

| Propiedad | Tipo | Regla |
|---|---|---|
| Responsable | persona | ejecutor principal |
| Equipo responsable | relación | área o rol estable |
| Apoyo | personas | colaboradores |
| Revisor | persona | control de calidad |
| Aprobador | persona | autorización final del tipo de pieza |
| Aprobada el | fecha con hora | momento de aprobación de la versión vigente |
| Versión aprobada | texto | código o número de la entrega aprobada |
| Prioridad | selección con color | baja, media, alta o crítica |
| Complejidad | selección | 1, 2, 3, 5 u 8 puntos |
| Producción | fecha con rango | inicio y fin de trabajo |
| Fecha límite de entrega | fecha con hora | compromiso operativo en `America/Guayaquil` |
| Terminada el | fecha con hora | cierre real de producción |
| Horas estimadas | número | capacidad prevista |
| Horas reales | número | esfuerzo informado al cierre |
| Umbral de alerta (h) | número | 48 por defecto desde la plantilla; puede ajustarse por tarea |

### Flujo, dependencias y control

| Propiedad | Tipo | Regla |
|---|---|---|
| Estado de producción | estado | solicitada, brief incompleto, asignada, en producción, en revisión, correcciones, aprobada, lista para Community, cerrada, bloqueada, cancelada o archivada |
| Producción terminada | casilla | el productor la marca solo cuando existe versión final |
| Gate editorial/marca | selección | no aplica, pendiente, aprobado o rechazado |
| Gate de dato | selección | no aplica, pendiente, aprobado o rechazado |
| Gate de embargo | selección | no aplica, pendiente, aprobado o rechazado |
| Gate de derechos | selección | no aplica, pendiente, aprobado o rechazado |
| Gate cultural | selección | no aplica, pendiente, aprobado o rechazado |
| Gate comercial/legal | selección | no aplica, pendiente, aprobado o rechazado |
| Gate operativo/seguridad | selección | no aplica, pendiente, aprobado o rechazado |
| Gate digital/destino | selección | no aplica, pendiente, aprobado o rechazado |
| Evidencia de gates | relación | decisión, brief, autorización o prueba en Briefs y Activos |
| Gates completos | fórmula | verdadera únicamente cuando cada gate está en aprobado o no aplica |
| Lista para Community | fórmula | verdadera solo si producción, versión final, aprobador, evidencia y gates están completos |
| Tarea padre | relación | paquete o entregable principal |
| Subtareas | relación | trabajo desagregado |
| Depende de | relación | tareas que deben terminar primero |
| Bloquea a | relación | relación recíproca para Gantt |
| Motivo de bloqueo | texto | causa y dueño de resolución |
| Publicaciones | relación | salidas por red asociadas |
| Número de publicaciones | resumen | conteo de publicaciones hijas |
| Alerta de programación | fórmula | avisa si la producción está lista y no existe una publicación programable |
| Semáforo | fórmula | verde, ámbar o rojo según estado, entrega y bloqueo |
| Cierre a tiempo | fórmula | compara `Terminada el` con la fecha límite |

`Producción terminada` no significa “publicada”. Solo habilita el traspaso a Community. La publicación externa requiere su propio registro, programación y estado.

### Matriz de gates aplicables

Cada gate se inicia en `Pendiente` o `No aplica`; nunca queda vacío. La plantilla propone los estados, pero el coordinador confirma la matriz de cada tarea.

| Contenido | Gates mínimos además de editorial/marca |
|---|---|
| historia emocional con archivo | derechos, dato y cultural cuando use identidad/símbolos |
| artista, fecha, escenario o pista de revelación | dato, embargo, derechos, comercial/legal y operativo |
| precio, preventa, promoción, cupo o disponibilidad | dato, embargo si aplica, comercial/legal, operativo y digital/destino |
| experiencia cultural o comunitaria | dato, derechos, cultural y operativo/seguridad |
| información de acceso, parqueadero, mapa o servicio | dato, operativo/seguridad y digital/destino |
| cobertura en vivo | derechos, dato, operativo/seguridad y digital/destino |

`Rechazado` bloquea. `Pendiente` no habilita. `No aplica` exige una decisión consciente del coordinador y no es el valor vacío por defecto.

## 6. Modelo de `Publicaciones`

Esta base será el calendario real de Community. Una fila representa **una publicación en una red y una fecha/hora**.

| Propiedad | Tipo | Regla |
|---|---|---|
| Publicación | título | nombre breve: pieza + red + variante |
| ID | identificador único (`unique_id`) | correlativo automático |
| Tipo de registro | selección | operativo o prueba |
| Tarea de origen | relación | una tarea de producción obligatoria |
| Campaña | resumen (`rollup`) | campaña heredada, de solo lectura, desde la tarea |
| Fase | fórmula (Formula 2.0) | atraviesa Tarea de origen → Campaña → Fase sin duplicar una relación editable |
| Red social | selección | una sola red por fila |
| Formato | selección | reel, feed, carrusel, story, live, short, artículo u otro |
| Estado de publicación | estado | borrador, pendiente de producción, programada, publicada, reprogramada, incidencia, cancelada o archivada |
| Estado operativo | fórmula | espera producción, falta red, falta programar, lista para programar, programada, vencida, publicada, incidencia o cancelada |
| Programada originalmente para | fecha con hora | primer horario aprobado; no se sobrescribe |
| Programada para | fecha con hora | fecha y hora en `America/Guayaquil` |
| Reprogramada el | fecha con hora | momento del último cambio de horario |
| Reprogramada por | persona | Community responsable del cambio |
| Motivo de reprogramación | texto | causa verificable del cambio |
| Número de reprogramaciones | número | contador manual o automatizado |
| Publicada el | fecha con hora | momento real de publicación |
| Responsable Community | persona | quien programa o publica |
| Equipo Community | relación | rol estable para reportes |
| Copy final | texto largo | versión aprobada por red |
| CTA | texto | acción escrita para la red |
| Enlace destino | URL | destino final seguro |
| Archivo final | archivos | variante exacta de la red |
| Enlace de descarga | URL | respaldo para archivos pesados |
| Briefs y activos | relación | variante, licencia, brief y fuente exactos |
| Enlace publicado | URL | evidencia verificable |
| Producción lista | resumen (`rollup`) | hereda `Lista para Community` de la tarea |
| Gates de tarea completos | resumen (`rollup`) | hereda el resultado de gates de la tarea |
| Versión actual | número | aumenta cuando cambia copy, activo, CTA o destino |
| Versión aprobada | número | versión confirmada para esa red |
| Aprobación de publicación | selección | pendiente, aprobada o rechazada |
| Aprobada por | persona | aprobador de la variante por red |
| Aprobada el | fecha con hora | momento de aprobación de la variante vigente |
| Requiere nueva aprobación | fórmula | verdadera si la versión actual difiere de la aprobada |
| QA de Community | casilla | copy, formato, enlace, etiquetas y miniatura revisados |
| Alerta | fórmula | falta de fecha, archivo, red, aprobación, URL o publicación vencida |
| Umbral de alerta (h) | número | 24 por defecto desde la plantilla; puede ajustarse por publicación |
| Tolerancia puntual (min) | número | 15 por defecto; dirección puede ajustarla sin perder la desviación |
| Desviación vs. horario vigente | fórmula | diferencia entre `Programada para` y `Publicada el` |
| Desviación vs. horario original | fórmula | diferencia frente al primer horario aprobado |
| Publicación puntual | fórmula | compara la desviación vigente con la tolerancia |
| Código/UTM | texto | identificador de medición aprobado |
| Fuente de métricas | selección | Meta Business Suite, TikTok, LinkedIn, YouTube, analítica web u otra fuente definida |
| Alcance | número | dato posterior de plataforma |
| Reproducciones | número | dato posterior cuando aplique |
| Interacciones | número | suma o dato oficial definido |
| Clics | número | clics atribuibles |
| Resultado principal | número | métrica propia de campaña |
| Corte de métricas | fecha con hora | momento de lectura para comparabilidad |
| Aprendizaje / resultado cualitativo | texto | observación que explica el resultado y siguiente acción |

### Regla de multiplicidad

Si una pieza se publica en tres redes, se crean tres registros. Si se publica dos veces en una misma red, se crean dos registros. Nunca se guarda una lista de varias redes en una sola publicación porque impediría conocer su hora, copy, enlace y resultado individual.

`Campaña` y `Fase` son heredadas y no editables en `Publicaciones`. La tarea es la fuente única. El dashboard consulta directamente esta base para contar publicaciones por campaña y evita depender de un resumen encadenado de varias relaciones.

Las fórmulas que recorren relaciones se crearán después de las relaciones y se validarán al guardar: la API rechaza expresiones que no compilan. Si la fórmula de fase no supera la prueba, no se duplicará silenciosamente el dato; la vista por fase quedará bloqueada hasta adoptar una automatización documentada con control de consistencia.

## 7. Flujo de trabajo completo

### A. Solicitud y producción

1. El solicitante crea una tarea y completa el brief mínimo.
2. El coordinador valida campaña, prioridad, canal, responsable, fechas y dependencias.
3. Diseño o audiovisual produce y adjunta el archivo o enlace final.
4. Coordinador, revisor y aprobadores marcan cada gate como `Aprobado`, `Rechazado` o `No aplica` y vinculan su evidencia.
5. El productor marca `Producción terminada` y registra `Terminada el`.
6. La fórmula `Gates completos` rechaza campos vacíos o pendientes.
7. La fórmula `Lista para Community` se activa únicamente si la versión final y los gates aplicables están completos.

### B. Planificación de publicaciones

1. Las publicaciones hijas se crean durante la planificación, una por red y horario previstos.
2. Mientras la tarea no esté lista, `Estado operativo` calcula `Espera producción`, aunque el estado editable continúe en `Pendiente de producción`.
3. Cuando la tarea queda lista, `Estado operativo` cambia sin intervención a `Falta programar` o `Lista para programar`, y la fila aparece automáticamente en la vista de Community. La vista depende de la fórmula, no de que alguien recuerde mover la tarjeta.
4. Si una tarea lista no tiene publicaciones hijas, aparece en `Alerta · falta crear publicación`.
5. Si existe una publicación sin fecha/hora, aparece en `Alerta · falta programar`.
6. Cuando Community define red, fecha y hora, cambia el estado editable a `Programada` y la publicación aparece en timeline y calendario.
7. Si cambia el horario, Community conserva `Programada originalmente para`, registra quién cambió, cuándo y por qué, y aumenta el contador de reprogramaciones.

### C. Publicación y cierre

1. Antes de publicar, Community confirma archivo, copy, CTA, enlace, aprobación vigente, derechos y destino seguro.
2. La publicación externa se ejecuta solo cuando cuenta con autorización operativa; Notion no publica automáticamente.
3. Community registra `Publicada el` y `Enlace publicado`, y cambia el estado a `Publicada`.
4. La publicación pasa a la vista `Realizadas` y alimenta el tablero de cumplimiento.
5. Datos completa métricas con un corte comparable; un dato sin fecha de corte no se usa para comparar piezas.

### D. Control de cambios después de aprobar

1. La aprobación de la tarea cubre la producción base, pero no sustituye la aprobación de cada adaptación por red.
2. Si se cambia copy, activo, CTA o enlace destino, Community aumenta `Versión actual` y desmarca el QA.
3. Mientras `Versión actual` no coincida con `Versión aprobada`, la fórmula `Requiere nueva aprobación` bloquea la salida.
4. Un cambio de horario se registra como reprogramación. Si el horario revela un dato sensible, también exige gate de dato/embargo vigente.

## 8. Landing y centro de mando de Community

Se creará una página principal llamada `FINADOS 2026 · Centro de mando de contenido` y una sección destacada `Community · Qué publicar y cuándo`.

### Bloques de la landing

| Bloque | Pregunta que responde | Vista / fuente |
|---|---|---|
| `Hoy · Producción` | ¿Qué se entrega hoy? | vista enlazada de Tareas con vencimiento hoy |
| `Hoy · Community` | ¿Qué se publica hoy? | vista enlazada de Publicaciones de hoy |
| `Listo para programar` | ¿Qué ya terminó producción pero no tiene fecha/hora? | Publicaciones filtradas por producción lista y programación vacía |
| `Timeline de publicación` | ¿Qué sale, cuándo y en qué red? | timeline por `Programada para`, agrupado por red |
| `Calendario editorial` | ¿Cómo se distribuye el contenido por día y hora? | calendario de Publicaciones |
| `Pendientes por red` | ¿Qué falta en Facebook, Instagram, TikTok, LinkedIn y demás? | tablero por red y estado |
| `Alertas · Producción` | ¿Qué tarea está vencida, bloqueada o sin gate? | vista enlazada de Tareas con alerta activa |
| `Alertas · Community` | ¿Qué publicación está sin archivo, red, hora, aprobación o cierre? | vista enlazada de Publicaciones con alerta activa |
| `Realizadas` | ¿Qué ya fue publicado y dónde está la evidencia? | tabla de Publicadas con hora y enlace real |
| `Rendimiento` | ¿Cómo avanza cada campaña y responsable? | dashboard de producción, puntualidad y resultados |

Notion no combina dos fuentes en una sola vista. Por eso `Hoy` y `Alertas` se presentan como pares de paneles enlazados dentro de la misma landing: uno de producción y otro de publicación.

### Navegación de primer nivel

- `Crear requerimiento` → nueva tarea con brief guiado.
- `Producción` → Kanban y Gantt del equipo creativo.
- `Community` → landing, timeline, calendario y realizadas.
- `Campañas` → avance por fase.
- `Activos` → briefs, enlaces y finales aprobados.
- `Equipo` → carga y responsables.
- `Decisiones` → cambios aprobados que afectan el cronopost.

## 9. Vistas obligatorias

### Cronopost y Producción

- `00 · Maestro`: tabla completa ordenada por prioridad y fecha límite.
- `01 · Kanban de producción`: agrupado por Estado de producción.
- `02 · Gantt de producción`: rango de Producción con flechas de dependencia.
- `03 · Entregas`: calendario por Fecha límite de entrega.
- `04 · Por campaña y fase`: tabla agrupada.
- `05 · Por responsable`: carga abierta por persona.
- `06 · Bloqueadas y vencidas`: alertas de gestión.
- `07 · Listas para Community`: producción lista y gates completos.
- `08 · Cerradas`: historial operativo.

### Publicaciones

- `00 · Maestro`: tabla completa.
- `01 · Hoy`: programadas para hoy y no canceladas.
- `02 · Listo para programar`: producción lista y fecha/hora vacía.
- `03 · Timeline Community`: por Programada para, agrupado por red.
- `04 · Calendario editorial`: calendario mensual/semanal.
- `05 · Kanban operativo`: por Estado operativo calculado.
- `06 · Pendientes por red`: agrupado por Red social.
- `07 · Alertas`: inconsistencias y vencimientos.
- `08 · Publicadas`: estado Publicada, con hora y enlace.
- `09 · Resultados`: tabla y gráficos por campaña/red/formato.

### Campañas, equipo y dirección

- campañas activas y avance;
- hitos en timeline;
- carga abierta ponderada por prioridad y complejidad;
- cumplimiento por responsable y por área;
- decisiones recientes;
- registros de prueba separados.

## 10. Alertas y semáforos

| Condición | Resultado |
|---|---|
| producción lista sin publicación hija | `🔴 Falta crear publicación` |
| publicación lista sin red | `🔴 Falta red` |
| publicación lista sin fecha/hora | `🟠 Falta programar` |
| fecha próxima y producción no lista | `🟠 Riesgo de producción` |
| fecha vencida y no publicada | `🔴 Publicación vencida` |
| publicada sin enlace o sin hora real | `🟠 Cierre incompleto` |
| tarea bloqueada | `🔴 Bloqueada` |
| entrega dentro de plazo y sin bloqueo | `🟢 En control` |

El umbral de “próxima” vive en una propiedad numérica de cada registro. Las plantillas cargan 24 horas para publicaciones y 48 horas para producción; el coordinador puede cambiarlo en casos justificados. No se dependerá de una constante global que Notion no comparte automáticamente entre bases.

## 11. Indicadores de gestión

### Producción

- tareas operativas asignadas, abiertas, cerradas, bloqueadas y vencidas;
- porcentaje de cierre a tiempo;
- tiempo de ciclo desde asignación hasta producción lista;
- horas estimadas frente a reales;
- carga abierta ponderada por prioridad y complejidad;
- rondas de corrección cuando el equipo decida registrarlas;
- avance por campaña y fase.

### Community y publicación

- publicaciones listas para programar;
- publicaciones programadas, realizadas, reprogramadas e incidentadas;
- cumplimiento de hora programada;
- publicaciones sin evidencia de enlace;
- distribución por red, formato, campaña y fase;
- alcance, reproducciones, interacciones, clics y resultado principal con fecha de corte.

### Regla de lectura responsable

No se calificará a una persona únicamente por cantidad de tareas. El tablero mostrará volumen junto con prioridad, complejidad, bloqueos, puntualidad, horas y calidad de cierre. Cada vista, gráfico y fórmula de KPI tendrá un filtro explícito `Tipo de registro = Operativo`; Notion no ofrece una exclusión global automática.

Como valor inicial, una publicación se considerará puntual si ocurre desde 15 minutos antes hasta 15 minutos después del horario. El tablero conservará la desviación exacta para que dirección pueda cambiar esta tolerancia sin perder datos.

### Definiciones y denominadores

| Indicador | Numerador | Denominador / exclusiones |
|---|---|---|
| cierre de producción a tiempo | tareas operativas cerradas con `Terminada el ≤ Fecha límite` | tareas operativas cerradas con ambas fechas; excluye prueba, cancelada y archivada |
| avance de campaña | tareas operativas cerradas | tareas operativas activas o cerradas; excluye prueba, cancelada y archivada |
| puntualidad de publicación | publicaciones operativas publicadas dentro de la tolerancia vigente | publicaciones operativas publicadas con hora programada y real; excluye prueba y cancelada |
| tasa de reprogramación | publicaciones operativas con una o más reprogramaciones | publicaciones operativas programadas o publicadas; las canceladas se reportan aparte |
| cierre con evidencia | publicaciones operativas publicadas con hora real y enlace | publicaciones operativas con estado Publicada |

Los campos vacíos no se convierten en cero: se excluyen del indicador comparable y aparecen como alerta de calidad. La puntualidad se calcula contra el horario vigente aprobado; la desviación contra el horario original permanece visible para medir reprogramaciones.

## 12. Personas, roles y permisos

Se utilizará un modelo híbrido:

- propiedad `Persona` de Notion para asignación, filtros personales y notificaciones cuando el miembro esté invitado;
- relación con `Equipo y Responsables` para área, función, suplencia, capacidad y reportes estables.

| Rol operativo | Acciones esperadas |
|---|---|
| Dirección / aprobación | ver todo, confirmar gates y decisiones |
| Coordinación / solicitante | crear briefs, priorizar, relacionar campañas y dependencias |
| Líder de recurso | asignar dentro de su equipo y controlar capacidad |
| Diseño / audiovisual | producir, adjuntar evidencia y marcar producción terminada |
| Revisión / aprobación | confirmar calidad, datos, derechos y autorización |
| Community | crear/adaptar publicaciones, programar, ejecutar y cerrar con enlace |
| Datos | definir cortes, validar métricas y mantener dashboard |
| Consulta | lectura sin edición operativa |

Los permisos reales de página y base se configurarán en la interfaz de Notion. La API no debe asumirse como mecanismo de seguridad por campo.

### Embargo y acceso mínimo

- Las bases compartidas de producción y publicación usan códigos, Día 1–Día 5 y ventanas autorizadas mientras exista embargo.
- No se cargan nombres, fechas exactas, países, pistas, precios o activos sensibles hasta que el dueño del dato autorice su circulación para ese grupo.
- Notion no tiene seguridad por propiedad: ocultar una columna en una vista no protege el dato.
- Si dirección decide guardar un detalle restringido dentro de Notion, debe vivir en una página o base separada con acceso mínimo configurado y probado en la interfaz. Su título y las relaciones visibles conservarán códigos neutrales para no filtrar el contenido.
- Antes de cargar datos reales se hará una prueba con una cuenta de consulta para confirmar que no ve la fuente restringida.
- La integración de API conservará acceso únicamente al espacio `Finados 2026`; no se compartirá con otros espacios.

## 13. Plantillas operativas

### Plantilla de tarea

El cuerpo de cada tarea tendrá:

1. objetivo;
2. audiencia;
3. mensaje y CTA;
4. entregables y variantes;
5. referencias;
6. insumos requeridos;
7. especificaciones técnicas;
8. dueño de cada dato;
9. gates de aprobación, derechos y seguridad;
10. definición de terminado;
11. publicaciones hijas previstas;
12. evidencia final y aprendizajes.

### Plantilla de publicación

El cuerpo de cada publicación tendrá:

1. copy final por red;
2. archivo exacto;
3. miniatura o portada;
4. CTA y destino;
5. etiquetas, menciones y créditos;
6. checklist de QA;
7. autorización;
8. hora programada y hora real;
9. enlace publicado;
10. UTM, fuente de métricas y fecha de corte;
11. aprendizaje y siguiente acción.

Las plantillas podrán dejarse como páginas prototipo desde la API. Si Notion no permite fijarlas como plantilla predeterminada mediante API, ese último paso se realizará manualmente en la interfaz y quedará documentado.

## 14. Registro de prueba

Se creará un caso controlado:

- tarea: `PRUEBA — Brief de expectativa ES TRADICIÓN`;
- tipo de registro: `Prueba`;
- campaña: `PRUEBA — Expectativa`;
- canales destino: Instagram y Facebook;
- dos publicaciones hijas, una por red;
- ninguna publicación externa;
- ningún nombre de artista, fecha embargada, precio o dato no autorizado;
- exclusión completa de indicadores.

El responsable y aprobador no se inventarán. Se asignarán únicamente si sus cuentas y funciones quedan confirmadas dentro de Notion.

## 15. Migración segura

1. capturar inventario de bases, propiedades, vistas y páginas existentes;
2. comprobar que la integración sigue limitada al espacio `Finados 2026`;
3. configurar y probar permisos de las bases operativas y de cualquier fuente restringida;
4. renombrar las cinco bases existentes;
5. agregar propiedades sin borrar las originales hasta verificar equivalencias;
6. crear `Publicaciones` y `Equipo y Responsables`;
7. configurar relaciones, resúmenes, fórmulas y vistas;
8. crear la landing y los accesos de primer nivel;
9. archivar páginas de ejemplo; no eliminarlas;
10. cargar el caso de prueba;
11. ejecutar la validación funcional, incluida zona horaria y acceso mínimo;
12. documentar cambios, limitaciones y reversión;
13. cargar datos reales solo después de la aprobación y de los gates de confidencialidad.

## 16. Validación de aceptación

| Prueba | Resultado esperado |
|---|---|
| una tarea crea dos publicaciones, una por red | cada fila conserva red, fecha, hora, copy y enlace propios |
| producción no terminada | las publicaciones no aparecen como listas para programar |
| marcar producción terminada con gates completos | las publicaciones aparecen en `Listo para programar` |
| producción lista sin publicación hija | aparece alerta en la landing |
| publicación lista sin fecha/hora | aparece `Falta programar` |
| asignar fecha/hora | aparece en timeline y calendario |
| calcular campaña y fase desde la tarea | las propiedades derivadas coinciden y no pueden editarse en Publicaciones |
| pasar la hora sin publicar | aparece alerta roja |
| registrar hora real y enlace | se mueve a `Realizadas` y actualiza puntualidad |
| cambiar copy o activo después de aprobar | exige una versión y aprobación nuevas antes de publicar |
| reprogramar una salida | conserva horario original, responsable, fecha y motivo del cambio |
| crear dependencia entre tareas | Gantt muestra el vínculo |
| filtrar por responsable | cada persona ve su carga correcta |
| cerrar un registro de prueba | ningún KPI operativo cambia |
| revisar nombres/fechas embargadas con cuenta de consulta | no existe información sensible en bases compartidas ni en Git, y la fuente restringida no es visible |
| verificar un horario desde dos cuentas | ambas interpretan la fecha con la política `America/Guayaquil` y el reporte conserva el offset `-05:00` |

## 17. Reversión y límites

- No se borrará contenido existente; las muestras se archivarán y podrán restaurarse.
- Antes y después se conservará un inventario de nombres, propiedades y vistas, sin tokens ni identificadores técnicos en el repositorio público.
- Si una relación o fórmula falla, se desactiva la vista afectada y se conserva la base maestra hasta corregirla.
- Notion organizará el trabajo; no sustituye Meta Business Suite ni publica por sí solo.
- Las notificaciones, permisos detallados y plantillas predeterminadas pueden requerir pasos manuales en la interfaz.
- La integración deberá demostrar capacidad de escritura dentro del espacio autorizado mediante el registro de prueba; no se tocará ningún otro espacio.
- La hora oficial será `America/Guayaquil`. Cada cuenta del equipo se revisará en esa zona; la API enviará marcas ISO 8601 con offset `-05:00`, y la prueba verificará su visualización antes de cargar horarios reales.
- No se guardarán tokens, credenciales, contratos, contactos privados, artistas bajo embargo ni correspondencias sensibles en Git.

## 18. Fuentes y conexiones

### Internas

- [[../README|Marketing y comunicación]]
- [[2026-08-24_sistema-contenidos-finados-2026_v01|Sistema de contenidos Finados 2026]]
- [[../01_estrategia/2026-08-27_adenda-guia-creativa-operativa-es-tradicion-finados-2026_v09|Adenda V09]]
- [[../2026-08-26_analisis-tareas-historicas-y-sistema-operativo-finados-2026_v01|Análisis de tareas históricas y sistema operativo 2026]]
- [[../2026-08-24_equipo-operativo-marketing-finados-2026_v01|Equipo operativo de marketing]]
- [[../../00_direccion-control/registro-decisiones|Registro de decisiones]]

### Oficiales de Notion consultadas el 2026-08-27

- [Working with views](https://developers.notion.com/guides/data-apis/working-with-views): vistas table, board, calendar, timeline, gallery, form, chart y dashboard; el timeline admite dependencias.
- [Create a view](https://developers.notion.com/reference/create-view): creación de vistas mediante API.
- [Integration capabilities](https://developers.notion.com/reference/capabilities): alcance de lectura, actualización e inserción de contenido.
- [Working with files and media](https://developers.notion.com/guides/data-apis/working-with-files-and-media): archivos internos, externos y cargas.
- [Data source properties](https://developers.notion.com/reference/property-object): tipos exactos de propiedad, incluidas fecha, fórmula, relación, resumen e identificador único.
- [Update a data source](https://developers.notion.com/reference/update-a-data-source): cambios de esquema y capacidades requeridas.

## 19. Gate previo a implementación

Alex debe revisar esta especificación escrita y confirmar que representa el flujo esperado. Después se redactará el plan de implementación, se ejecutará únicamente dentro de `Finados 2026`, se validará con el caso `PRUEBA` y se documentará el resultado antes de cargar el cronopost real.

[[../README|Volver a marketing y comunicación]]
