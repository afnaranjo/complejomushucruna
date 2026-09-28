---
titulo: "Actualización de afiche, Plaza de la Luna y Encuentro"
responsable: "tecnología/diseño"
estado: listo-para-publicar
ultima_actualizacion: 2026-09-28
fuente: "Solicitud de Alex y SVG oficiales recibidos el 28 de septiembre de 2026"
confidencialidad: interno
---

# Actualización de afiche, Plaza de la Luna y Encuentro

## Cambio solicitado

Alex pidió actualizar `/finados/shows/` con el nuevo afiche oficial y el nuevo logo de Plaza de la Luna, cambiar la fecha de Hueveando al 3 de noviembre y corregir la tarjeta Encuentro de `/finados/`, cuyo símbolo invadía el texto en móvil.

## Activos recibidos

- `afiche-artistas-final.svg`: `3509 × 4961`, 15.881.736 bytes, SHA-256 `0D6F2DB14B78581C7C1AD65A78259F3C78CFA13C884FC7F4BEE555006AD51191`.
- `logo-plaza-de-la-luna.svg`: `1300 × 1183`, 13.014 bytes, SHA-256 `996D97F6F3B944B4603BA5507FFF1080F8129E80A9335415193ECA3B01538CD9`.
- Ambos SVG fueron inspeccionados antes de incorporarlos: no contienen scripts, `foreignObject`, manejadores de eventos ni URI `javascript:`. El afiche conserva una imagen PNG incrustada por el diseño original.

## Implementación

- Se integró `origin/main` por avance rápido antes de crear la rama `codex/shows-afiche-plaza-fecha`.
- El afiche se publica directamente como SVG y ocupa el ancho completo del viewport. El encabezado y el pie descriptivo conservan el ancho editorial para no perder lectura.
- El logo SVG nuevo reemplaza la referencia al WebP anterior en Plaza de la Luna. Los archivos históricos no se eliminan.
- Hueveando cambia a `03 noviembre`, con fecha semántica `2026-11-03`.
- La tarjeta Encuentro mantiene el SVG original, pero lo presenta en cian, más pequeño, con menor opacidad y detrás del contenido. El bloque de texto tiene una capa propia para evitar nuevos solapamientos.
- Versiones de caché: `shows.css` y los SVG nuevos usan `20260928-shows-4`; la portada usa `finados.css?v=20260928-axis-2`.

## Validación

- Prueba específica `finados-shows.test.mjs`: 12/12 aprobadas.
- Pruebas relacionadas de build, distribución, tema y dignidades: 39/39 aprobadas.
- Build local: 232 archivos; `check-dist` sin rutas rotas.
- Revisión visual local de SHOWS en escritorio y 390 px: afiche completo sin deformación ni desbordamiento, logo nuevo legible y fecha `03 noviembre` visible.
- Revisión de `/finados/` en 390 px: Encuentro conserva título y párrafo completos; el símbolo cian queda a la derecha y no invade las letras. Consola sin errores ni advertencias.
- Las dos aserciones administrativas que dependían del salto LF ahora aceptan también CRLF. El `npm run check` completo aprobó 258 pruebas Node, 32 suites PHP y 11 integraciones; el build conserva 232 archivos y 2.793 referencias válidas.

## Estado de publicación

Alex autorizó publicar este cambio junto con el retiro posterior de Kike Jav. Queda validado y listo para el despliegue frontend.

## Relación

- [[2026-09-16_implementacion_shows-finados-web_v01|Implementación de SHOWS]]
- [[README|Tecnología y datos de Finados 2026]]
