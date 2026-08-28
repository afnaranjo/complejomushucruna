---
titulo: "Bitácora 2026-08-27 · Réplica aislada de Notion Finados 2026"
responsable: "marketing, comunidad, datos y tecnología"
estado: cerrado
ultima_actualizacion: 2026-08-27
fuente: interna
confidencialidad: interno
tags:
  - bitacora
  - feria-finados-2026
  - notion
  - cronopost
  - qa
---

# 2026-08-27 · Réplica aislada de Notion

## Objetivo del día

Replicar el centro de mando de producción, cronopost y publicación en una página nueva del espacio autorizado, sin abrir contenido ni modificar las páginas que ya existían.

## Avances verificables

- Se confirmó la página nueva `APLICADOR NUEVO · FINADOS 2026` y que estaba vacía antes de la primera escritura.
- Se creó una landing interna con flujo producción → aprobación → programación → publicación → medición.
- Se construyeron siete fuentes propias, 26 vistas directas curadas y 11 vistas enlazadas.
- Se comparó la navegación final con la referencia visual. Las siete fuentes ya eran bases de página completa; `Cronopost y Producción` se completó con icono `🎨`, `All tasks`, `My tasks` y `99 · QA · Pruebas`, sin crear contenedores adicionales.
- Se configuraron relaciones bidireccionales, dependencias, Kanban, Gantt, calendarios, timeline, alertas, gates, versiones, reprogramación, métricas y rendimiento.
- Se mantuvo una fila por entregable de producción y una fila independiente por salida, red, fecha y hora.
- Se incorporaron siete pruebas sintéticas separadas de los registros operativos.
- Se documentó la [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/02_contenido/2026-08-27_replicacion-aislada-notion-cronopost-finados-2026_v01|implementación aislada y sus controles]].

## Incidencias y resolución

- Notion rechazó una primera fórmula con varios argumentos lógicos. La ejecución se detuvo sin reintentar y las fórmulas se reescribieron con operadores tipados.
- Notion rechazó un rollup de fase sobre otro rollup. `Fase` en `Publicaciones` se convirtió en una selección directa con las siete etapas normalizadas.
- Las propiedades calculadas quedaron divididas en operaciones secuenciales y reanudables.
- El reconciliador acepta solo una coincidencia exacta dentro de la raíz o fuente propia; ante ambigüedad aborta sin escribir.
- La primera comprobación posterior a la corrección visual quedó en estado no verificado porque la API devolvió decodificado el identificador de `Responsable`. El diagnóstico sanitizado confirmó que el filtro era correcto; se normalizó la comparación y no se repitieron mutaciones.

## Validación

- Aplicador: sintaxis correcta y 5/5 pruebas offline aprobadas antes de la escritura.
- Revisión independiente: `GO` antes de aplicar y después de cada ajuste contractual.
- Verificación final de solo lectura: 7 fuentes de página completa, 35 vistas directas totales, 26 vistas operativas originales conservadas, 11 enlazadas, 7 registros QA y 0 registros operativos.
- `Cronopost y Producción`: 12 vistas en el orden exacto `All tasks`, `My tasks`, `00`–`08`, `99 · QA · Pruebas`; `All tasks` sin filtro, `My tasks` con registros operativos del usuario actual y QA con registros de prueba.
- Integridad: 0 filas y 0 propiedades modificadas; las 9 vistas operativas de Cronopost, las 18 bases hijas y las 11 vistas enlazadas conservaron identidad y configuración.
- Estados calculados confirmados: `Programada`, `Lista para programar` y `Publicada`.
- Alertas y puntualidad confirmadas; fecha de prueba conservó offset `-05:00`.
- Credenciales y temporales retirados al cerrar; ninguna credencial quedó en Git o en el vault.

## Protección de información

- No se abrió contenido, renombró, movió, archivó ni eliminó ninguna página preexistente del nuevo espacio.
- No se cargaron nombres del cartel, contratos, contactos, precios no autorizados o información bajo embargo.
- No se publicó, programó, pautó, vendió ni desplegó contenido externo.

## Próximos pasos

- [ ] Probar permisos mínimos con las cuentas definitivas — Dirección/marketing/community/datos/tecnología — 2026-08-28.
- [ ] Validar `America/Guayaquil` desde dos cuentas — Community/datos/tecnología — 2026-08-28.
- [ ] Confirmar responsables, suplentes, revisores y aprobadores — Dirección/Edwin/coordinaciones — 2026-08-28.
- [ ] Poblar el cronopost solo desde la fuente controlada autorizada — Marketing/programación/dueños del dato — después de cerrar los gates.

## Enlaces relacionados

- [[../../_inicio|Centro de mando]]
- [[../../_memoria-del-proyecto|Memoria del proyecto]]
- [[../../_pendientes|Pendientes]]
- [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/02_contenido/2026-08-27_diseno-sistema-notion-cronopost-finados-2026_v01|Diseño del sistema Notion]]
- [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/02_contenido/2026-08-27_implementacion-notion-cronopost-finados-2026_v01|Implementación inicial]]
