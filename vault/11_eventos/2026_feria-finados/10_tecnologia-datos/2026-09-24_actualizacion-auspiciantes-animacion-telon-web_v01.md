---
titulo: "Actualización de auspiciantes y animación tipo telón"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-09-24
fuente: "Solicitud de Alex y SVG oficial recibido el 24 de septiembre de 2026"
confidencialidad: interno
---

# Actualización de auspiciantes y animación tipo telón

## Cambio solicitado

Alex entregó una nueva versión de `logos auspiciantes.svg`, pidió actualizar la franja en las páginas donde se publica y reemplazar su animación anterior por otra propuesta.

## Implementación

- Antes de editar se integró `origin/main` por avance rápido, de `5b5b624` a `9470e32`.
- El SVG oficial mide `2321 × 650`, tiene SHA-256 `14A7B9998FDC310E3F4CA763860CEC4EA8A65AE55A9EA51EEFE55ED4862551FA` y añade las marcas SanFra y Bogati al conjunto vigente.
- Se conservó el SVG maestro en el repositorio y se generó el WebP de publicación de `47.366` bytes, SHA-256 `C5D5A690A6F6EF4723A3F91448FF9499FD628B189FD0D9D10D302F9881A0EF4D`.
- La franja compartida de FINADOS y SHOWS mantiene el ancho completo. La nueva animación es una apertura central tipo telón: aparece una sola vez al entrar en pantalla, sin desplazamiento continuo ni repetición.
- Con `prefers-reduced-motion` el arte aparece completo y sin transición. La caché pasó a `20260924-sponsors-7`.

## Validación y publicación

- La prueba específica aprobó 10/10 casos.
- `npm run check` aprobó 214 pruebas Node, 26 suites PHP y 10 pruebas de integración; el build contiene 203 archivos, 66 HTML y 2.012 referencias.
- La revisión visual local cubrió FINADOS y SHOWS en escritorio y móvil. Durante la inspección se detectó que recortar el nodo observado impedía activar la animación; el recorte se trasladó al arte hijo y se repitió la validación sin desbordamiento horizontal.
- Commit técnico `d611272`, publicado en `origin/main`.
- Prevuelo y despliegue frontend completados con respaldo recuperable. No se ejecutaron migraciones ni se modificó la base de datos.
- Verificación HTTPS independiente: FINADOS y SHOWS respondieron HTTP 200 en `complejomushucruna.com` y `finados.expoferiamushucruna.com`; ambos muestran SanFra y Bogati, sirven `sponsors.css?v=20260924-sponsors-7` y el WebP remoto coincide con el build por SHA-256.
- La publicación del frontend completo también dejó disponible `/finados/mfs/`, que ya estaba en `origin/main`: respondió HTTP 200 en ambos dominios. No se añadió en este cambio funcional.

## Relación

- [[2026-09-23_franja-auspiciantes-ancho-completo-web_v01|Franja de auspiciantes a ancho completo]]
- [[README|Tecnología y datos de Finados 2026]]
