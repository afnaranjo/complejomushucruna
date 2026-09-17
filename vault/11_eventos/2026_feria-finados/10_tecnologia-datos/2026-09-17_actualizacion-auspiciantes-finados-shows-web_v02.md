---
titulo: "Segunda actualización de auspiciantes visibles de Finados 2026"
responsable: "tecnología/diseño"
estado: aprobado
ultima_actualizacion: 2026-09-17
fuente: "Solicitud expresa de Alex y nuevo SVG oficial recibido el 17 de septiembre de 2026"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, shows, auspiciantes]
---

# Segunda actualización de auspiciantes visibles de Finados 2026

Relacionado: [[2026-09-17_actualizacion-auspiciantes-finados-shows-web_v01|Primera versión publicada]] y [[README|Tecnología y datos]].

## Alcance aprobado y fuente verificada

Alex solicitó hacer pull, actualizar los logos en todas las páginas donde aparecen y publicar en Git y producción. El pull sobre la única copia existente informa que `main` ya está actualizada en `417c1c0`; no entraron nuevos commits ni cambiaron las instrucciones.

La búsqueda en las fuentes confirma que los bloques de auspiciantes de 2026 están en `/finados/` y `/finados/shows/`, mediante un único renderer y activo compartidos. Dignidades 2025 conserva los auspiciantes históricos de aquella edición, sin sustituirlos por los de 2026. El afiche de artistas visible excluye la antigua banda de auspiciantes.

El nuevo SVG oficial tiene 321.395 bytes y `viewBox="0 0 2321 650"`. SHA-256: `1f0efb9415cbddd2a9c5535160b183346e2bc66f98498e41f5770cd4e05af2dc`. Incluye Mutualista Ambato entre Óptica Interandina y Pollos al Gusto. Vista previa mecánica del archivo nuevo inspeccionada; cenefa, organizador y once logos conservan su composición original.

## Implementación

- SVG copiado sin modificar sus bytes al activo público canónico; respaldo WebP existente regenerado, sin duplicar el maestro.
- Cache del SVG y CSS compartido renovada a `20260917-sponsors-2` en ambas páginas. Texto alternativo actualizado con Mutualista Ambato en el orden del arte.
- Exportador y prueba de identidad fijados al nuevo digest aprobado. El pequeño PNG incrustado mantiene validación estricta de firma/tamaño/base64; código activo, eventos, entidades y referencias externas siguen rechazados.
- Proporciones, responsive, ampliación en pestaña nueva y footer común preservados. Sin cambios de artistas, presentación, formularios, backend, navegación, fuentes ni identidad institucional.
- Las tres notas locales preexistentes se conservan fuera del commit técnico. La versión v01 permanece publicada como evidencia histórica.

## Validación y publicación

- `npm run check` completo en Linux/PHP aprobado con exit code 0: 137 pruebas Node, 20 suites PHP y 10 pruebas de integración. Build de 129 archivos, 32 HTML y 1047 referencias válidas; diez pruebas específicas de SHOWS aprobadas.
- El SVG público coincide por SHA-256 con el nuevo maestro recibido. WebP de respaldo de 50.138 bytes, dentro del presupuesto original. Dignidades 2025 y sus activos no tienen modificaciones.
- `git diff --check` aprobado. Solo los activos, renderer, exportador, pruebas y esta nota de la tarea entrarán en el commit; las tres notas locales previas permanecen fuera del staging.

Pendiente publicar el commit técnico y completar el procedimiento estándar de producción con respaldo, conservación de Google Sheets y verificación HTTPS independiente. No se considera publicada esta revisión hasta registrar resultados reales.
