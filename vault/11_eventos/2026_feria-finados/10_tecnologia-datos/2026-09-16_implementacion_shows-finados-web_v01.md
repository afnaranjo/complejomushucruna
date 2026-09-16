---
titulo: "Implementación de SHOWS Finados 2026"
responsable: "tecnología/diseño"
estado: aprobado
ultima_actualizacion: 2026-09-16
fuente: "afiche FINAL proporcionado por Alex y fuente web existente"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, shows]
---

# SHOWS Finados 2026

Relacionado: [[README|Tecnología y datos]] y [[../../../_memoria-del-proyecto|Memoria del proyecto]].

## Alcance verificado

- Nueva ruta `/finados/shows/`, situada antes de `VENTA DE STANDS` dentro del desplegable de `FINADOS 2026`.
- Identidad de campaña conservada: Anton, Inter, DM Serif Display, lienzo, noche, morado, fucsia, cian, amarillo y chumbi. No se modifica la identidad institucional.
- Header con personas disfrutando de un concierto, creado con la herramienta integrada de generación de imágenes, no con la CLI. Se identifica como imagen conceptual, no como fotografía del evento real.
- Afiche oficial responsive, ampliable en una nueva pestaña, y programación equivalente en HTML legible en celulares. Se conserva la jerarquía original del afiche, no se reordena cronológicamente.
- Atractivos, organizador, horario, shows de Plaza de la Luna y QR preservados. No se inventan precios, enlaces de compra de entradas ni condiciones.
- Los logos originales de auspiciantes quedan en una sola línea dentro del footer. En celular se desplaza solo esa banda horizontalmente, no toda la página.

## Fuente y exportación

Archivo original en el almacenamiento compartido: `Propuesta afiche artistas web - FINAL.svg`, recibido el 2026-09-16; el original no fue modificado.

SHA-256: `630832afe90c4d2ff0386cd704dd17d7b88ee8262e60f03a40bc4df638a66370`.

El SVG contiene una única imagen PNG embebida de 2481 × 3508, sin textos vectoriales. Se exportaron dos viewports nativos contiguos: body `0 0 2481 3300` y auspiciantes `0 3300 2481 208`. Ambos cubren el diseño entero. No se utilizó IA para modificar artistas, letras o logotipos.

Activos finales dentro del proyecto:

- `website/public/assets/finados/shows/ambiente-concierto-1600.webp` (133.206 bytes).
- `website/public/assets/finados/shows/ambiente-concierto-800.webp` (52.640 bytes).
- `website/public/assets/finados/shows/cartel-shows-2481.webp` (4.038.848 bytes, sin pérdida).
- `website/public/assets/finados/shows/cartel-shows-1240.webp` (1.297.286 bytes, sin pérdida).
- `website/public/assets/finados/shows/auspiciantes-finados-2026.webp` (40.326 bytes, sin pérdida).

Exportador reproducible: `website/scripts/prepare-shows-assets.mjs`. Recibe el SVG fuente, la imagen generada y un módulo Sharp disponible; no depende de la unidad compartida durante el build habitual.

## Prompt final del header

Modo utilizado: herramienta integrada `image_gen`, generación original sin imágenes de referencia. Las conversiones WebP son optimización web, no cambios de contenido.

> Use case: photorealistic-natural. Asset type: wide website hero photograph for SHOWS, Finados Mushuc Runa 2026. Primary request: create an original atmospheric image of adults enjoying an outdoor live concert in Ecuador, with a close group of happy Latin American friends in the foreground and a joyful audience behind them. People are cheering, singing and naturally raising their hands toward a stage outside the frame, genuine lively expressions, plausible anatomy. Style: premium candid concert photography with realistic skin texture and natural varied clothes, strong editorial festival energy, not illustration or UI mockup. Composition: panoramic landscape 16:9, medium-wide framing, foreground people concentrated across center and right; left third dark and visually quiet to accommodate HTML headline. Faces large enough to read on mobile, do not cut off heads, no identifiable celebrity or performer. Lighting and palette: nighttime deep plum and violet atmosphere, controlled magenta and turquoise stage light, a little warm amber rim light, soft concert haze; maintain clear face contrast, no heavy lens flares. Constraints: fictional conceptual crowd, no named real event, no logos, no lettering, no captions, no watermark, no fake brand symbols, no confetti covering faces, no alcohol, no glass UI panels. All typography and official branding will be added separately in HTML/CSS.

## QA y estado de publicación

- 49 pruebas enfocadas de frontend, contenido, identidad, activos y recepción en verde; 8 pruebas nuevas de SHOWS incluidas.
- Build: 121 archivos, 31 HTML, 1024 referencias válidas.
- Vista previa HTTP disponible en `/finados/shows/`; revisión visual en escritorio y viewport de 390 × 844. Anton visible, título fuera de la cabecera, artistas sin desbordes y logos con scroll localizado.
- Se conservaron fuera del commit técnico los cambios previos de `AGENTS.md`, memoria y pendientes.
- Al cierre de la creación, la página y sus artes permanecían locales por la limitación histórica de difusión del cartel. En el siguiente mensaje del 2026-09-16, Alex autorizó expresamente `sube a git y producción`, en respuesta a la pregunta sobre el afiche completo y el repositorio público. La autorización cubre la página SHOWS y los recursos entregados; no habilita anuncios adicionales ajenos al afiche.
- Las verificaciones parciales no equivalen a `npm run check` completo: esta computadora carece de PHP y tiene restricciones de symlinks. No se omiten ni debilitan los gates del despliegue.

## Próximo paso

Responsable: tecnología. Autorización recibida el 2026-09-16. Sincronizar los commits técnicos con GitHub, ejecutar el prevuelo completo en un entorno compatible y desplegar con respaldo. Registrar el resultado real; la autorización no sustituye las validaciones del despliegue.
