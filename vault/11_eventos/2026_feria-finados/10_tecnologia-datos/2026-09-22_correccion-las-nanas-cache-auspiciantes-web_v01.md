---
titulo: "Corrección de Las Ñañas y renovación de auspiciantes web"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-09-22
fuente: "Solicitud de Alex y SVG oficial reenviado el 22 de septiembre de 2026"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, dignidades, auspiciantes]
---

# Corrección de Las Ñañas y renovación de auspiciantes web

Relacionado: [[2026-09-22_eleccion-dignidades-actualizacion-auspiciantes-web_v01|Elección de dignidades 2026 y auspiciantes web actualizados]].

## Alcance

Alex reportó tres problemas en la sección de elección de dignidades de `/finados/`: la foto de Las Ñañas debía mostrarse sobre fondo blanco y sin invadir las letras del arte, la virgulilla de “Señorita” interfería con el texto superior y los auspiciantes seguían viéndose desactualizados. Reenvió el SVG maestro de auspiciantes para volver a tomarlo como fuente.

## Implementación

- El arte de Las Ñañas conserva la plantilla oficial y el recorte transparente oficial de las cuatro integrantes que ya estaba incluido en los activos Finados. La fotografía se recompuso dentro del marco blanco, sin alterar rostros y sin cubrir el bloque inferior del nombre.
- El título “Señorita Colada Morada” recibió un margen adaptable respecto del antetítulo “Elige la próxima dignidad”, evitando que la virgulilla de la `Ñ` lo invada en escritorio y móvil.
- El SVG reenviado por Alex coincide byte por byte con el activo vigente: 321.306 bytes y SHA-256 `347d08ee2d56c9dfedb8d904ae55b03a737e1802a309983a5d5f38ebc34ca054`. Como el maestro ya era correcto, se renovó su versión de caché a `20260922-sponsors-4` para obligar a los navegadores y al CDN a solicitarlo de nuevo en Finados y SHOWS.
- Los activos de dignidades se renovaron a `20260922-dignities-2`. El WebP corregido de Las Ñañas tiene SHA-256 `fb0f6b39e9b4d5a41c758e47555b9b33fcf4adfb0ec8c1fc739974cb3eea50a7`.

## Validación previa

- `npm run check` completo en WSL/Linux: 166 pruebas Node, 21 suites PHP y 10 pruebas de integración; build de 152 archivos, 40 HTML y 1.343 referencias válidas.
- QA visual real con Edge en 1440 × 1000 y 390 × 844: imagen 1080 × 1350 cargada, fondo blanco visible, nombre despejado, separación positiva de 23,19 px en escritorio y 16 px en móvil, y ningún desbordamiento horizontal.
- No se modificaron backend, base de datos, migraciones, DNS, formularios, registros de personas, Google Sheets ni la página histórica de Dignidades 2025.

## Publicación

- Commit `4f4077a` (`Corregir arte de Las Ñañas y renovar auspiciantes`) integrado por fast-forward y publicado en `origin/main`.
- Prevuelo remoto aprobado. Despliegue frontend estándar completado con copia de seguridad recuperable, preservación de la configuración privada de Google Sheets y transferencia sin borrar archivos exclusivos. No se desplegó backend ni se ejecutaron migraciones.
- Verificación independiente por HTTPS: `/finados/` y `/finados/shows/` respondieron HTTP 200 con las versiones nuevas; el WebP de Las Ñañas, el SVG de auspiciantes y la hoja CSS respondieron HTTP 200 y coincidieron byte por byte con `dist` mediante SHA-256.
- Resultado: Git y producción actualizados. Sin cambios en base de datos, formularios, DNS, backend ni datos personales.
