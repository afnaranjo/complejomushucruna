---
titulo: "Corrección final de Las Ñañas y disposición de auspiciantes"
responsable: "tecnología/diseño"
estado: listo_para_publicar
ultima_actualizacion: 2026-09-22
fuente: "Cuatro referencias visuales entregadas por Alex el 22 de septiembre de 2026"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, dignidades, auspiciantes]
---

# Corrección final de Las Ñañas y disposición de auspiciantes

Relacionado: [[2026-09-22_correccion-las-nanas-cache-auspiciantes-web_v01|Corrección de Las Ñañas y renovación de auspiciantes web]].

## Alcance

Alex indicó que la reconstrucción anterior de Las Ñañas había perdido parte del estilo, que la fotografía debía ser más grande, que las tipografías del arte debían respetarse y que el tramo central de auspiciantes debía seguir la disposición mostrada en su tercera referencia: `Credi Fácil | Cogarol · John Morris`.

## Implementación

- El arte de Las Ñañas fue sustituido por la composición final completa entregada por Alex en su cuarta referencia. La foto ocupa el marco blanco, y corona, logotipos, rótulos y tipografías quedan integrados en una sola imagen para evitar sustituciones tipográficas del navegador.
- La referencia PNG original mide 705 × 886, pesa 403.908 bytes y tiene SHA-256 `decb1f85ce64287a8b4458fedee57ffdba63bad91ccd83939d8bc0338bedf730`. La representación web es WebP 1080 × 1350, pesa 181.942 bytes y tiene SHA-256 `7eba4ca891fec5c388ea42657355971f6c8b78837bcc0af8d9dd45a8110a5346`.
- La composición visible de auspiciantes se volvió a producir desde el maestro SVG, manteniendo organizador y todos los logos, pero intercambiando el separador y el punto del tramo solicitado: Credi Fácil, separador vertical, Cogarol, punto cian y John Morris. La salida web es WebP 2321 × 650, pesa 66.838 bytes y tiene SHA-256 `13cbb1e0f2435ff8499fc8e549569ae82fa9502565eb64666de22655284a0cd3`.
- Cachés renovadas a `20260922-dignities-3` y `20260922-sponsors-5` en Finados y SHOWS.

## Validación previa

- TDD específico: 15 pruebas aprobadas para orden, activos, hashes, build y referencias versionadas.
- `npm run check` completo: 166 pruebas Node, 21 suites PHP y 10 pruebas de integración; build de 152 archivos, 40 HTML y 1.343 referencias válidas.
- QA visual real con Edge en 1440 × 1000 y 390 × 844: Las Ñañas carga a 1080 × 1350, auspiciantes a 2321 × 650, versiones nuevas presentes y sin desbordamiento horizontal.
- No se modificaron backend, base de datos, migraciones, DNS, formularios, Google Sheets ni datos personales.

## Publicación

Pendiente de integrar en `main`, publicar el frontend y comprobar por HTTPS los archivos finales.
