---
titulo: "Auspiciantes actualizados en Finados y SHOWS"
responsable: "tecnología/diseño"
estado: aprobado
ultima_actualizacion: 2026-09-17
fuente: "Solicitud de Alex y SVG oficial actualizado recibido el 17 de septiembre de 2026"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, shows, auspiciantes]
---

# Auspiciantes actualizados en Finados y SHOWS

Relacionado: [[2026-09-16_ajuste-auspiciantes-plaza-shows-web_v01|Composición anterior de SHOWS]], [[2026-09-16_implementacion-presentacion-finados-web_v01|Presentación Finados]] y [[README|Tecnología y datos]].

## Autorización y sincronización

Alex solicitó hacer pull, reemplazar los logos de SHOWS por la nueva versión entregada, añadir la misma composición al final de Finados y publicar en GitHub y producción.

La copia única avanzó mediante fast-forward de `253f1e3` a `53342d9`, incorporando 24 commits. Las tres notas locales se preservaron; el conflicto de bitácora se resolvió conservando las dos versiones. Una comprobación verificó todas las líneas añadidas locales y entrantes, sin marcadores ni staging documental ajeno. Solo se retiró el stash propio después de verificar la restauración.

## Implementación

- Un único SVG, sin modificación de sus bytes, conserva fondo, cenefa, organizador, proporciones y fila de logos. Nuevo maestro: 301.230 bytes, `viewBox="0 0 2321 650"`, SHA-256 `d2959d3384bd410b35a4bf80df422d0e83bd56c9adcd9e9a6ff95de73f5537fa`.
- El texto alternativo incorpora Credi Fácil y Óptica Interandina conforme al arte. El maestro incluye un PNG pequeño incrustado e inerte; el exportador exige el digest exacto aprobado, verifica su firma PNG y rechaza código activo, manejadores, entidades y referencias externas. No se elimina ni redibuja contenido del maestro.
- `sponsors.mjs` y `sponsors.css` comparten exactamente el mismo bloque al final de `/finados/` y en el footer de `/finados/shows/`. En Finados se ubica después del contenido principal y antes del footer común, que permanece idéntico al de Acreditación de Medios. Ancho fluido, altura automática y ampliación segura en pestaña nueva.
- Un único archivo público: `website/public/assets/finados/shows/auspiciantes-finados-2026.svg`. Se actualiza el respaldo WebP existente. No se duplican originales en otras carpetas.
- SVG y CSS compartido versionados `20260917-sponsors-1`; CSS SHOWS `20260917-shows-3`. El contenido y el contador de presentación, programación, Plaza de la Luna, navegación, formularios y sitio institucional permanecen sin cambios de alcance.
- La versión anterior conserva trazabilidad en Git y en la nota relacionada; no se sobrescribe su documentación aprobada.

## Validación y publicación

- `npm run check` completo en Linux/PHP: exit code 0; 137 pruebas Node, 20 suites PHP y 10 de integración. Build de 129 archivos, 32 HTML y 1047 referencias válidas.
- Diez pruebas específicas SHOWS, con composición idéntica al maestro, PNG incrustado verificado, orden artístico intacto, render compartido, footer común conservado, responsive y caché nueva. Las seis pruebas de presentación siguen aprobadas.
- El primer check detectó la invariancia del footer común de Acreditación. Se corrigió la ubicación del bloque en Finados, sin cambiar esa prueba ni los formularios; el check completo posterior quedó en verde.
- Pendiente: publicación estándar con respaldo recuperable y verificación HTTPS independiente de ambas páginas y activos. La autorización expresa de publicación ya consta en esta solicitud.

Los tres documentos locales previos permanecen separados del commit técnico. No se prevén cambios de backend, DNS, credenciales ni envío de registros a Sheets.

## Seguimiento

La fila original se conserva también en móvil; puede ampliarse desde el propio arte para leer logos pequeños sin recortar ni alterar la composición aprobada.
