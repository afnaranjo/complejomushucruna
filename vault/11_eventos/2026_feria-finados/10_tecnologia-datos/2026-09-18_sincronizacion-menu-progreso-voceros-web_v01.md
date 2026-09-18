---
titulo: "Sincronización y publicación de menú y progreso de Voceros"
responsable: "tecnología"
estado: cerrado
ultima_actualizacion: 2026-09-18
fuente: "solicitud expresa de Alex, revisión de main y verificaciones locales"
confidencialidad: interno
---

# Sincronización y publicación de menú y progreso de Voceros

## Fuente y alcance

Por solicitud expresa de Alex, se hizo pull fast-forward en la única copia de `afnaranjo/complejomushucruna`: `3956616` → `0a566a9`. Se incorporaron cinco commits: hover estable del submenú, verificación alternativa por los espejos, autoguardado del progreso administrativo, aceptación de espacios de video enviados como objetos JSON y documentación de esa corrección.

Mientras se validaba, `main` recibió dos commits adicionales. Se preservó todo el trabajo revisado en otro stash y se hizo un segundo pull fast-forward: `0a566a9` → `ee02951`. Se incorporó el bloqueo de videos hasta la fecha habilitada en Ecuador y la protección de enlaces ya enviados, con sus pruebas. Son siete commits incorporados en total; no se sobrescribe trabajo concurrente. La revisión y la integración de los cambios locales se realizan mediante una rama corta antes de volver por avance rápido a `main`.

Las tres notas locales previas se preservaron en un stash específico y se restauraron mediante parches, conservando todas sus líneas añadidas junto con las instrucciones entrantes. El respaldo permanece recuperable. Se revisaron los cambios antes de incluir la documentación válida en el push autorizado; no se incorporan configuraciones privadas ni archivos de `outputs/`.

Los cambios entrantes no alteran migraciones ni el esquema. Se conserva la restricción anterior: no ejecutar migraciones ni escrituras de registros en la base de producción. Tampoco se modifican los JSON privados de orígenes, legal o Google Sheets; el manifiesto de propiedad del endpoint sigue siendo un artefacto administrado del instalador.

## Caché y pruebas

Los commits modificaron `site.js`, `finados.js`, `navigation.css`, `admin.js` y `vocero-portal.js`, pero sus vistas conservaban las versiones anteriores. Se renuevan únicamente las referencias de esos cinco recursos a `20260918-navigation-progress-1`, manteniendo la versión del CSS general de Finados, CSS del portal y script de validación sin cambios.

La regresión de empaquetado falló primero al exigir la nueva caché de administración. La prueba extendida recorre todos los HTML publicados y exige la nueva versión para cada referencia a los cinco recursos, además de conservar la comprobación de las dependencias ESM y el módulo multi-origen. Las expectativas de las pruebas existentes se actualizan al nuevo identificador, sin retirar controles.

La primera validación sobre `0a566a9` pasó con exit code 0: 145 pruebas Node, 20 suites PHP y 10 pruebas de integración; build de 130 archivos, 32 HTML y 1066 referencias válidas. Tras incorporar `ee02951`, el check completo sobre la versión final volvió a pasar con esos mismos totales y exit code 0. No se omiten pruebas ni se debilita la validación. Las pruebas del backend usan exclusivamente datos sintéticos locales.

Resultado de publicación: completado y verificado. El commit técnico `6838d4bc2548910191505ab65a161e8df6e6ac63` se integró por avance rápido desde `codex/publicacion-main-20260918`, después de revisión y check completo, y se publicó mediante push normal a `origin/main`.

## Procedimiento de publicación autorizado

1. Exigir `main` limpia, commit revisado y coincidencia con el remoto; ejecutar `npm run check` completo.
2. Publicar primero el backend usando el flujo estándar con prevuelo, respaldos, inventario rastreado, hashes, lint, activación recuperable y health. Interceptar la etapa de migraciones: no enviar su programa al servidor; ejecutar únicamente consultas SELECT en una transacción de solo lectura y exigir los esquemas ya instalados.
3. Comparar las huellas de configuración, columnas/constraints e historial antes/después; conservar los demás JSON privados.
4. Ejecutar el prevuelo completo del frontend, crear un respaldo privado con SHA-256 verificado y usar el publisher estándar sin reescribir legal/Sheets ni borrar archivos exclusivos.
5. Verificar CORS/health desde ambos dominios contra ambas APIs y comprobar por HTTPS la igualdad de los recursos y páginas con el build y sus versiones de caché. No enviar formularios ni crear cuentas de personas reales para verificar.

## Resultado verificado de producción

- Backend publicado primero desde `6838d4b`, release `20260918-menu-progress-003cfde6`. Prevuelo, respaldos de archivos/snapshot MySQL, integridad SHA-256 del inventario, lint, activación recuperable, instalación administrada y health completados. La etapa de migraciones emitió `MIGRATIONS_NOT_EXECUTED_READONLY_SCHEMA_CONFIRMED`; su programa no se envió al servidor.
- Frontend publicado después desde el mismo commit. El prevuelo estándar repitió el check completo y verificó Git, SSH, PHP y el backend activo. Respaldo privado `20260918-menu-progress-d3dcdcc1-frontend`, con SHA-256 comprobado antes de transferir; publisher estándar sin reescribir legal/Sheets ni borrar archivos exclusivos.
- Comparaciones antes/después confirmaron iguales el JSON privado del backend, columnas/constraints, historial de migraciones y otros JSON privados ajenos. Solo se permite el manifiesto de propiedad del endpoint como artefacto administrado. No se ejecutaron DDL, DML, altas, retiros, importaciones ni formularios de personas en producción.
- Diez comprobaciones CORS/health pasaron antes del frontend y se repitieron después: ambas APIs responden GET `/api/health` 200 y OPTIONS 204 con ambos dominios permitidos, reflejo exacto del origen, credenciales, `Vary: Origin` y cabeceras/métodos correctos; un origen no permitido obtiene 403 sin autorización CORS.
- Cincuenta y dos comprobaciones HTTPS finales sin fallos: ocho recursos y dieciocho páginas por cada dominio. Todos respondieron 200 con SHA-256 idéntico al build; MIME JavaScript/CSS/HTML correcto y referencias renovadas de los cinco recursos cambiados. Incluye portada, Finados, SHOWS, Dignidades, Voceros, stands, medios, Invitaciones, páginas institucionales, administración y vistas del portal/validación.
- Notas locales anteriores y entrantes conservadas y revisadas; metadatos de fecha actualizados explícitamente, sin pérdidas de contenido ni marcadores de conflicto. Stashes propios permanecen como respaldo recuperable. No se modificaron DNS, credenciales, Google Sheets o proyectos ajenos. No queda bloqueo de publicación.

## Relacionados

- [[README|Tecnología y datos]]
- [[2026-09-18_despliegue-multi-origen-sin-migraciones-web_v01|Publicación multi-origen anterior]]
