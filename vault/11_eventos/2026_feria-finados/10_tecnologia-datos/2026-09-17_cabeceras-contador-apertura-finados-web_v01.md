---
titulo: "Cabeceras y contador de apertura de Finados Mushuc Runa 2026"
responsable: "tecnología/diseño"
estado: aprobado
ultima_actualizacion: 2026-09-17
fuente: "Solicitud expresa de Alex del 17 de septiembre de 2026"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, apertura, contador]
---

# Cabeceras y contador de apertura de Finados Mushuc Runa 2026

Relacionado: [[2026-09-16_implementacion-presentacion-finados-web_v01]], [[2026-09-17_actualizacion-auspiciantes-finados-shows-web_v02]] y [[_memoria-del-proyecto]].

## Aprobación y alcance

- Pull solicitado ejecutado en `main`: sin cambios entrantes, punto de partida `ebaa24a`. Las tres notas locales preexistentes se preservan fuera del commit de la tarea.
- Fecha expresamente indicada por Alex: viernes 30 de octubre de 2026, 10:30, `America/Guayaquil`. Instante absoluto `2026-10-30T10:30:00-05:00`, equivalente a `2026-10-30T15:30:00Z`.
- La portada de Finados y la promoción del home del Complejo dicen «Bienvenidos a Finados Mushuc Runa 2026» desde ahora. La antigua promoción de stands queda en el body, conservando textos, compra, fecha histórica y fotografías.
- Cabecera compacta con la apertura en SHOWS, acceso a stands, acreditación de medios, Dignidades 2025 e Invitaciones. Se conservan el cartel, los artistas, las condiciones, los formularios, sus fechas específicas y la identidad de cada página. Los datos históricos de la edición 2025 no se cambian por los de 2026.
- Voceros queda completamente excluido: landing, documentos legales, acceso, portal, recuperación, verificación y recursos. No hay nueva release de backend ni cambios de registros, consentimientos o Google Sheets.
- La identidad institucional, navegación y contenido institucional del Complejo permanecen independientes. El footer común y los auspiciantes oficiales de 2026 conservan su composición y versión `20260917-sponsors-2`.

## Implementación

- Componente compartido `opening-header.mjs`, variantes principal y compacta, tipografías locales Anton/Inter con nombres exclusivos y CSS nativo aislado. No se modifica el CSS global de campaña usado por Voceros.
- Activos del contador versionados `20260917-fair-start-1`. Se conservan los nombres técnicos `presentation.js/css` para no duplicar recursos; el contenido del contador ahora corresponde al inicio de la feria, no a su presentación del 17 de septiembre.
- Actualización cada segundo desde el instante absoluto, recuperación al volver a una pestaña suspendida, sin valores negativos; al cumplirse la hora se mantiene la bienvenida y se detiene el intervalo. Fallback legible con la fecha real antes de ejecutar JavaScript y anuncios accesibles sin anunciar segundos constantemente.
- Un solo H1 por página y cuatro unidades: días, horas, minutos y segundos. El mapa mantiene la URL oficial y apertura segura en otra pestaña.
- El export HTML de Invitaciones sustituye su documento al desempaquetarse. La integración traslada exclusivamente la cabecera y sus activos al documento final; el bundle RSVP codificado se conserva íntegro, con empresa, endpoint y popup originales.
- Sin automatizaciones externas ni acciones sobre participantes. Los cambios están preparados en el sitio estático para que el contador funcione también tras recargar o reabrir la página.

## Validación y publicación

- `npm run check` completo aprobado con exit code 0: 140 pruebas Node, 20 suites PHP, 10 pruebas de integración; build de 129 archivos, 32 HTML y 1066 referencias válidas. Se mantienen todas las suites y sus controles.
- El primer intento encontró `/tmp` de Linux lleno (`ENOSPC`, tmpfs de 7,8 GiB). Se trasladaron exclusivamente las tres carpetas temporales creadas por las nuevas pruebas a una ubicación recuperable del disco Linux, liberando 22 MiB para PHP. No se borraron archivos ni se rebajaron controles. El check completo pasó con una carpeta temporal privada en disco; el publisher estándar usará la misma ubicación.
- Comparación SHA-256 antes/después: los 20 HTML y recursos seleccionados de Voceros, incluidos CSS/JS compartidos, permanecen idénticos.
- Revisión de navegador local: portada principal en escritorio y móvil, home institucional, cabecera compacta de SHOWS e Invitaciones tras desempaquetado; el reloj presenta valores reales y los formularios se conservan. No se enviaron registros de prueba a producción.
- Publicación aún pendiente de completar prevuelo, respaldo, transferencia y comparación HTTPS independiente. No debe considerarse publicada hasta registrar esos resultados.
