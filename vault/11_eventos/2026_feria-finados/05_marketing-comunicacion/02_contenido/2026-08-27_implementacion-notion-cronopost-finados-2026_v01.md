---
titulo: "Implementación del sistema Notion de cronopost Finados 2026"
responsable: "marketing, comunidad y datos"
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
---

# Implementación del sistema Notion de cronopost Finados 2026

> [!info] Alcance histórico
> Esta nota documenta la primera implementación en el espacio autorizado originalmente, incluidas sus diez muestras archivadas. La réplica posterior, creada sin tocar páginas existentes del nuevo espacio, está documentada por separado en [[2026-08-27_replicacion-aislada-notion-cronopost-finados-2026_v01|Réplica aislada del sistema Notion]].

> [!success] Resultado
> El sistema quedó implementado y verificado dentro del único espacio autorizado de Notion, `Finados 2026`. Organiza trabajo interno; no publica automáticamente en redes ni autoriza revelar fechas, artistas, precios, cupos, promociones o información bajo embargo.

## Alcance implementado

Se configuró la landing `FINADOS 2026 · Centro de mando de contenido` y un sistema de siete fuentes conectadas:

1. `Campañas y Fases`;
2. `Cronopost y Producción`;
3. `Publicaciones`;
4. `Briefs y Activos`;
5. `Equipo y Responsables`;
6. `Reuniones y Decisiones`;
7. `Bandeja de Ideas`.

La arquitectura mantiene una fila de producción por entregable y una fila independiente por red, fecha y hora de publicación. Una tarea puede alimentar varias salidas sin confundir “pieza terminada” con “contenido publicado”.

## Vistas operativas

Quedaron verificadas 26 vistas directas y 11 vistas enlazadas en el centro de mando. Incluyen:

- maestro, Kanban, Gantt, calendario de entregas, carga por responsable, bloqueos, tareas listas y cerradas;
- hoy, listo para programar, timeline Community, calendario editorial, Kanban de publicación, pendientes por red, alertas, realizadas y resultados;
- campañas activas por fase y timeline de campaña;
- directorio y rendimiento por responsable, con tareas asignadas, porcentaje de cierre, puntualidad, horas estimadas/reales y publicaciones realizadas.

Las vistas operativas filtran `Tipo de registro = Operativo`. Los registros sintéticos viven únicamente en las vistas `99 · QA · Pruebas` y no entran en los indicadores reales.

## Controles de salida

Una tarea llega a Community únicamente cuando producción, versión, evidencia y gates están completos. Cada publicación conserva:

- red, formato, copy, activo, CTA y destino;
- horario original, horario vigente, reprogramación y motivo;
- versión actual, versión aprobada, aprobación y QA;
- hora real, enlace publicado, fuente y corte de métricas;
- estado operativo, puntualidad y alertas de programación, vencimiento o cierre incompleto.

La fase se normaliza desde la tarea antes de llegar a `Publicaciones`. El avance de campaña y el rendimiento por responsable usan rollups nativos para evitar fórmulas frágiles entre relaciones.

## QA ejecutado

La verificación independiente de solo lectura confirmó:

| Prueba | Resultado |
|---|---|
| tarea completa y lista para Community | `true` |
| tarea lista sin publicación hija | `🔴 Falta crear publicación` |
| publicación Instagram con horario | `Programada` |
| publicación Facebook sin horario | `Lista para programar` + `🟠 Falta programar` |
| cierre sintético | `Publicada` |
| puntualidad del cierre sintético | `true` |
| rollup de producción en Instagram | `1` |

Se conservaron siete registros sintéticos: una campaña, un activo, dos tareas y tres publicaciones. Ninguno representa una publicación externa; el enlace de cierre usa un dominio reservado e inexistente.

La tercera publicación sintética usa `Tipo de registro = Prueba` y el estado `Publicada` únicamente para demostrar el cierre completo, el cálculo de puntualidad y los rollups. No se programó ni publicó contenido real en ningún canal.

Las diez páginas iniciales de muestra se enviaron a la papelera de Notion después del QA. No fueron eliminadas permanentemente y pueden restaurarse.

## Requiere ajuste manual en Notion

Antes de cargar horarios o tareas reales se deben completar dos gates en la interfaz:

1. invitar las cuentas definitivas y probar permisos mínimos por rol con una cuenta de consulta;
2. comprobar desde dos cuentas que la zona horaria interpreta correctamente `America/Guayaquil` y el offset `-05:00`.

También conviene definir las plantillas predeterminadas desde la interfaz cuando el equipo confirme sus formularios de uso cotidiano. Notion no ofrece seguridad por propiedad: los detalles restringidos deben vivir en páginas o bases separadas con acceso mínimo real.

## Pendiente de datos y personas

El sistema no contiene todavía el cronopost real. Para poblarlo faltan:

- versión autorizada del calendario controlado;
- responsables, suplentes, aprobadores y cuentas definitivas;
- capacidad semanal, prioridades y dependencias ratificadas;
- oferta, derechos, embargo, datos, operación, destino seguro y demás gates de cada pieza.

## Seguridad y publicación externa

- La integración se validó por nombre e identificador interno del espacio antes de cada escritura.
- La credencial se mantuvo únicamente en sesiones temporales y no se guardó ni versionó.
- No se cargaron nombres del cartel, contratos, contactos privados ni correspondencias bajo embargo.
- No se publicó, pautó, programó ni desplegó contenido en Meta, TikTok, LinkedIn, YouTube, web, boletería u otro canal.

## Conexiones

- [[2026-08-27_diseno-sistema-notion-cronopost-finados-2026_v01|Diseño aprobado del sistema Notion]]
- [[2026-08-27_plan-implementacion-notion-cronopost-finados-2026_v01|Plan de implementación ejecutado]]
- [[../2026-08-24_equipo-operativo-marketing-finados-2026_v01|Equipo operativo de marketing]]
- [[../01_estrategia/2026-08-27_adenda-guia-creativa-operativa-es-tradicion-finados-2026_v09|Adenda V09]]
- [[../../00_direccion-control/registro-decisiones|Registro de decisiones]]
- [[_pendientes|Pendientes ejecutivos]]

[[README|Volver a contenido]]
