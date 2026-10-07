---
titulo: "Actualización de auspiciantes con Skybiz Travel e INGCO"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-10-07
fuente: "Solicitud de Alex y SVG oficial recibido el 7 de octubre de 2026"
confidencialidad: interno
---

# Actualización de auspiciantes con Skybiz Travel e INGCO

## Cambio solicitado

Alex pidió integrar la nueva versión de `AUSPICIANTES PARA WEB.svg` en todas las páginas donde se publica la franja de auspiciantes y autorizó subir el resultado a Git y producción.

## Implementación

- Se integró `origin/main` por avance rápido hasta `e3bf88b` antes de editar.
- El SVG oficial mide `2320 × 650`, pesa `383.865` bytes y tiene SHA-256 `AC906043C241BA8F78768DD3E4D6EEE864DB538A135EDE9E32AD68F22E44A1AF`.
- La revisión de seguridad no encontró scripts, manejadores de eventos, `foreignObject`, URI JavaScript ni referencias externas. El único recurso embebido es un PNG inerte de 2.949 bytes.
- La composición conserva el organizador y los auspiciantes anteriores e incorpora Skybiz Travel e INGCO al final del orden oficial.
- Se conservó el SVG exacto como maestro público y se generó el WebP responsive de `74.210` bytes, SHA-256 `0BE35EE628BC9889B6C05FDCDB171B0A5AEBEC1433BCD00F62721324FFC63C04`.
- FINADOS y SHOWS comparten el mismo componente accesible. La caché pasa a `20261007-sponsors-8`, las dimensiones declaradas a `2320 × 650` y el texto alternativo incluye las dos marcas nuevas.
- La herramienta de preparación quedó limitada a la franja de auspiciantes y valida el digest, las dimensiones y la seguridad del SVG antes de reemplazar activos.

## Validación y publicación

- TDD: la prueba específica falló primero contra el maestro anterior y quedó en verde con 14/14 casos tras la implementación.
- El primer `npm run check` encontró una regresión previa de `main`: `presentation.css` medía 10.049 bytes y superaba el límite de 10 KB. Se retiraron únicamente dos comentarios, sin cambiar reglas ni diseño, y la segunda ejecución aprobó 266 pruebas Node, 34 suites PHP y 11 pruebas de integración; build de 243 archivos, 81 HTML y 2.808 referencias válidas.
- Revisión visual local en FINADOS y SHOWS: escritorio y viewport móvil de 390 px, una sola franja por página, SVG/WebP `2320 × 650`, texto alternativo completo, sin desbordamiento horizontal y sin errores o advertencias de consola.
- Git: cambio funcional `8647ee7` y mejora diagnóstica del publicador `24028d5`, ambos en `origin/main`.
- Los primeros intentos se detuvieron antes del respaldo y de cualquier transferencia: el `tmpfs` de WSL estaba lleno por temporales de suites anteriores y el publicador ocultaba la causa al priorizar una línea esperada de `stderr`. La ejecución se trasladó a un temporal Linux privado con 948 GB libres. El publicador ahora conserva las colas de `stdout` y `stderr` cuando un comando falla; sus 48 pruebas específicas y el check completo quedaron en verde.
- Despliegue frontend estándar completado con respaldo recuperable, preservación de archivos exclusivos y verificación HTTPS. No se desplegó backend ni se ejecutaron migraciones o cambios de base de datos.
- Verificación independiente en `complejomushucruna.com` y `finados.expoferiamushucruna.com`: `/finados/` y `/finados/shows/` responden 200, contienen una sola franja, caché `20261007-sponsors-8`, dimensiones `2320 × 650`, Skybiz Travel e INGCO. Los SVG y WebP remotos coinciden exactamente con los hashes locales en ambos dominios; las dos rutas de salud de API responden 200.
- QA visual pública en escritorio y comprobación responsive sin desbordamiento; consola sin errores ni advertencias.

## Relación

- [[2026-09-24_actualizacion-auspiciantes-animacion-telon-web_v01|Actualización anterior de auspiciantes y animación tipo telón]]
- [[README|Tecnología y datos de Finados 2026]]
