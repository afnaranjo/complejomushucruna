---
titulo: "Sincronización y publicación de menú y progreso de Voceros"
responsable: "tecnología"
estado: en-revision
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

Resultado de publicación: pendiente de las comprobaciones remotas. No se declara el despliegue terminado antes de verificarlas.

## Procedimiento de publicación autorizado

1. Exigir `main` limpia, commit revisado y coincidencia con el remoto; ejecutar `npm run check` completo.
2. Publicar primero el backend usando el flujo estándar con prevuelo, respaldos, inventario rastreado, hashes, lint, activación recuperable y health. Interceptar la etapa de migraciones: no enviar su programa al servidor; ejecutar únicamente consultas SELECT en una transacción de solo lectura y exigir los esquemas ya instalados.
3. Comparar las huellas de configuración, columnas/constraints e historial antes/después; conservar los demás JSON privados.
4. Ejecutar el prevuelo completo del frontend, crear un respaldo privado con SHA-256 verificado y usar el publisher estándar sin reescribir legal/Sheets ni borrar archivos exclusivos.
5. Verificar CORS/health desde ambos dominios contra ambas APIs y comprobar por HTTPS la igualdad de los recursos y páginas con el build y sus versiones de caché. No enviar formularios ni crear cuentas de personas reales para verificar.

## Relacionados

- [[README|Tecnología y datos]]
- [[2026-09-18_despliegue-multi-origen-sin-migraciones-web_v01|Publicación multi-origen anterior]]
