---
titulo: "Plan de implementación Notion cronopost Finados 2026"
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
---

# Plan de implementación Notion cronopost Finados 2026

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Convertir únicamente el espacio autorizado de Notion `Finados 2026` en un sistema operativo de producción y publicación, con relaciones, vistas, panel central, alertas y un caso de prueba que no publique contenido externo.

**Architecture:** Reutilizar las cinco bases iniciales y añadir `Publicaciones` y `Equipo y Responsables`. Mantener una separación estricta entre una tarea de producción y sus publicaciones por red. Construir el centro de mando con vistas enlazadas a ambas fuentes. Aplicar cambios mediante la API oficial, de forma idempotente, secuencial, reversible y limitada al espacio validado.

**Tech Stack:** Notion API `2026-03-11`, JavaScript ESM sin dependencias externas, REST/JSON, Markdown/Obsidian, Git.

**Spec:** [[2026-08-27_diseno-sistema-notion-cronopost-finados-2026_v01|Diseño aprobado del sistema Notion de cronopost y publicación]]

> [!success] Ejecución cerrada
> El plan se ejecutó el 2026-08-27 únicamente dentro de `Finados 2026`. La verificación independiente confirmó siete fuentes, 26 vistas directas, 11 enlazadas, siete registros sintéticos y diez muestras archivadas de forma reversible. Consulta [[2026-08-27_implementacion-notion-cronopost-finados-2026_v01|el acta de implementación]].

## Restricciones globales

- No almacenar, imprimir ni versionar el token de Notion.
- Verificar antes de escribir que el bot pertenece al espacio `Finados 2026`.
- No tocar otro espacio, no publicar en redes y no cargar información bajo embargo.
- Promediar menos de dos solicitudes por segundo y respetar `Retry-After` ante cualquier `429`.
- No borrar páginas: archivar únicamente muestras iniciales inequívocas y conservar inventario de reversión sin identificadores técnicos en Git.
- Enviar toda fecha/hora de prueba con `-05:00`; no cargar el cronopost real todavía.

## Task 1: Construir el aplicador idempotente y el inventario seguro

**Files:**
- Create: `/private/tmp/notion_finados_setup.mjs`
- Create: `/private/tmp/notion_finados_before.json`
- Create: `/private/tmp/notion_finados_after.json`

**Step 1: Implementar el cliente API**

Crear un módulo ESM que lea exclusivamente `process.env.NOTION_TOKEN`, nunca registre cabeceras, aplique una pausa mínima de 650 ms entre llamadas y reintente `429` únicamente después de `Retry-After`.

```js
const NOTION_VERSION = "2026-03-11";
async function notion(method, path, body) {
  // autorización desde process.env, limitador, manejo de 429 y errores sin secretos
}
```

**Step 2: Añadir dos modos**

- `--audit`: solo lectura; inventaría usuario/bot, espacio, páginas, bases, fuentes, propiedades y vistas.
- `--apply`: repite la auditoría, valida el espacio exacto, aplica el esquema y ejecuta la verificación final.

El proceso debe abortar si el nombre del espacio no es exactamente `Finados 2026`, si faltan las cinco fuentes iniciales o si una búsqueda devuelve duplicados ambiguos para una fuente que se va a modificar.

**Step 3: Validar sintaxis local**

Run: `node --check /private/tmp/notion_finados_setup.mjs`

Expected: código 0 y ninguna salida de error.

## Task 2: Auditar el espacio y fijar los objetivos exactos

**Files:**
- Modify: `/private/tmp/notion_finados_setup.mjs`
- Create: `/private/tmp/notion_finados_before.json`

**Step 1: Ejecutar auditoría autenticada sin eco del token**

Run desde una terminal interactiva:

```zsh
read -s "NOTION_TOKEN?Notion token: "; export NOTION_TOKEN
node /private/tmp/notion_finados_setup.mjs --audit
unset NOTION_TOKEN
```

Expected: integración/espace `Finados 2026`, cinco fuentes iniciales únicas y ningún cambio externo.

**Step 2: Resolver el padre del centro de mando**

Usar la página raíz compartida que agrupa las cinco bases. Si no existe un padre común inequívoco, abortar antes de escribir en lugar de crear contenido en otra ubicación.

**Step 3: Clasificar muestras iniciales**

Marcar como archivables solo páginas vacías o de plantilla creadas por el paquete inicial y reconocidas mediante título y contenido. Todo objeto ambiguo permanece intacto y se registra como `no modificado`.

## Task 3: Reutilizar las cinco bases y crear las dos nuevas

**Files:**
- Modify: `/private/tmp/notion_finados_setup.mjs`

**Step 1: Renombrar sin eliminar propiedades existentes**

Aplicar estos cambios exactos:

```text
Projects  -> Campañas y Fases
Tasks     -> Cronopost y Producción
Docs      -> Briefs y Activos
Meetings  -> Reuniones y Decisiones
Notes     -> Bandeja de Ideas
```

Agregar las propiedades descritas en las secciones 4, 5 y 12 de la especificación. Las propiedades iniciales se renombran o reutilizan cuando son equivalentes; no se eliminan hasta superar QA.

**Step 2: Crear las fuentes nuevas bajo el centro de mando**

Crear `Publicaciones` y `Equipo y Responsables` con las propiedades exactas de las secciones 6 y 12 de la especificación. Usar `unique_id` con prefijos `PUB` y, para tareas, `TAR`.

**Step 3: Crear relaciones en orden seguro**

1. Campañas ↔ tareas.
2. Tareas ↔ publicaciones.
3. Tareas/publicaciones ↔ activos.
4. Tareas/publicaciones/campañas ↔ equipo.
5. Ideas → tareas.
6. Tareas autorrelacionadas: padre/subtareas y depende de/bloquea a.

Después de cada relación, consultar de nuevo la fuente y comprobar que ambos extremos existen.

**Step 4: Crear resúmenes y fórmulas después de las relaciones**

Implementar y compilar al guardar:

- `Gates completos`, `Lista para Community`, `Alerta de programación`, `Semáforo` y `Cierre a tiempo` en producción.
- `Producción lista`, `Gates de tarea completos`, `Estado operativo`, `Requiere nueva aprobación`, `Alerta`, desviaciones y `Publicación puntual` en publicaciones.

Si una fórmula no compila, abortar antes de cargar datos; no duplicar manualmente campaña, fase ni estados calculados.

## Task 4: Crear vistas y el centro de mando

**Files:**
- Modify: `/private/tmp/notion_finados_setup.mjs`

**Step 1: Crear vistas maestras y operativas**

En `Cronopost y Producción` crear las nueve vistas `00`–`08` de la sección 9. En `Publicaciones` crear las diez vistas `00`–`09`. Crear además vistas maestras/activas/timeline para campañas y directorio para equipo.

**Step 2: Crear la página principal**

Crear o reutilizar una única página titulada `FINADOS 2026 · Centro de mando de contenido` con:

- instrucción breve del flujo producción → aprobación → programación → publicación → medición;
- advertencia visible de no publicar datos sin gates;
- accesos a las siete bases;
- sección `Community · Qué publicar y cuándo`.

**Step 3: Crear las vistas enlazadas de la landing**

Crear, con filtros funcionales, los diez bloques exactos de la sección 8: Hoy Producción, Hoy Community, Listo para programar, Timeline, Calendario, Pendientes por red, Alertas Producción, Alertas Community, Realizadas y Rendimiento.

No declarar una vista como terminada si la API solo creó el contenedor pero rechazó filtros, orden o agrupación.

## Task 5: Archivar muestras y ejecutar el caso de prueba

**Files:**
- Modify: `/private/tmp/notion_finados_setup.mjs`

**Step 1: Archivar únicamente muestras verificadas**

Usar `in_trash: true` o la operación vigente equivalente solo sobre los objetos clasificados en Task 2. Registrar título y posibilidad de restauración. No eliminar permanentemente nada.

**Step 2: Crear el caso de aceptación**

Crear:

```text
Campaña: PRUEBA — Expectativa
Tarea: PRUEBA — Brief de expectativa ES TRADICIÓN
Publicación hija 1: Instagram
Publicación hija 2: Facebook
Tipo de registro: Prueba en las cuatro filas
```

No asignar responsables inexistentes, no usar artistas, precios, fechas reales ni datos bajo embargo.

Durante la ejecución el caso se amplió, sin datos reales, a siete registros sintéticos: una campaña, un activo, dos tareas y tres publicaciones. La ampliación permitió comprobar también la alerta de tarea sin publicación hija, los rollups y el cierre completo.

**Step 3: Probar la transición completa sin publicar**

1. Con producción incompleta, confirmar `Espera producción`.
2. Completar versión final ficticia y todos los gates como `No aplica` o `Aprobado` con evidencia de prueba.
3. Confirmar que las publicaciones aparecen en `Listo para programar`.
4. Programar una fila con una fecha de prueba ISO `-05:00` y verificar timeline/calendario.
5. Dejar la segunda sin fecha y verificar `Falta programar`.
6. No realizar publicaciones reales. Para validar el cierre, usar una tercera fila `Prueba` con estado `Publicada` y un enlace bajo el dominio reservado `.invalid`.

## Task 6: Auditar, documentar y cerrar

**Files:**
- Create: `vault/11_eventos/2026_feria-finados/05_marketing-comunicacion/02_contenido/2026-08-27_implementacion-notion-cronopost-finados-2026_v01.md`
- Modify: `vault/11_eventos/2026_feria-finados/05_marketing-comunicacion/02_contenido/2026-08-27_diseno-sistema-notion-cronopost-finados-2026_v01.md`
- Modify: `vault/_memoria-del-proyecto.md`
- Modify: `vault/_pendientes.md`
- Modify: `AGENTS.md`

**Step 1: Ejecutar auditoría postimplementación**

Run: `node /private/tmp/notion_finados_setup.mjs --verify`

Expected:

- siete fuentes finales únicas;
- relaciones recíprocas presentes;
- fórmulas válidas;
- vistas obligatorias presentes;
- panel principal único;
- caso de prueba excluido por `Tipo de registro = Prueba`;
- cero publicaciones externas;
- cero objetos modificados fuera del espacio validado.

**Step 2: Comparar antes/después**

Comprobar que cada objeto modificado ya estaba dentro del espacio o fue creado como descendiente del centro de mando, y que las únicas páginas archivadas corresponden a muestras verificadas.

**Step 3: Documentar el resultado real**

La nota de implementación debe distinguir `implementado`, `requiere ajuste manual en Notion` y `pendiente de datos/personas`. No incluir tokens ni identificadores técnicos. Cambiar la especificación a `aprobado` y enlazar el acta de implementación.

**Step 4: Validar el repositorio**

Run:

```zsh
git diff --check
rg -n "(ntn_|secret_|token=|Bearer )" vault AGENTS.md
```

Expected: `git diff --check` limpio y ningún secreto nuevo.

**Step 5: Retirar temporales sensibles**

Eliminar los archivos temporales de `/private/tmp` después de extraer únicamente conclusiones sanitizadas. Confirmar que el token ya no está en el entorno ni en archivos.

**Step 6: Commit y push**

```zsh
git add AGENTS.md vault
git commit -m "Implementar centro de mando Notion Finados 2026"
git push origin main
```

Expected: `main` alineada con `origin/main`; ninguna publicación, despliegue o modificación de Meta.

## Auto-revisión del plan

- Cobertura: incluye las siete bases, las relaciones, fórmulas, vistas, landing, migración reversible, zona horaria y caso de prueba exigidos por la especificación.
- Confidencialidad: ninguna instrucción coloca el token o contenido bajo embargo en el repositorio.
- Consistencia: tareas y publicaciones son entidades separadas; campaña y fase se heredan desde la tarea; `Prueba` se excluye de KPI.
- Reversión: las muestras se archivan, las propiedades iniciales se conservan hasta QA y las escrituras abortan ante ambigüedad.
- Ejecución: Alex autorizó dejar el sistema listo; el plan se ejecutó con `superpowers:executing-plans` y luego se verificó de forma independiente en modo de solo lectura. La tercera publicación sintética simuló un cierre con `Tipo de registro = Prueba` y un dominio reservado; no existió publicación externa.

[[2026-08-27_diseno-sistema-notion-cronopost-finados-2026_v01|Volver al diseño aprobado]]
