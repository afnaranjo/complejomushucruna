---
titulo: "Elección de dignidades 2026 y auspiciantes web actualizados"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-09-22
fuente: "Solicitud de Alex y artes oficiales entregados el 22 de septiembre de 2026"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, dignidades, auspiciantes]
---

# Elección de dignidades 2026 y auspiciantes web actualizados

Relacionado: [[2026-09-17_actualizacion-auspiciantes-finados-shows-web_v02|Segunda actualización de auspiciantes]], [[2026-09-16_implementacion_shows-finados-web_v01|SHOWS Finados 2026]] y [[README|Tecnología y datos]].

## Alcance autorizado

Alex solicitó sincronizar `main`, actualizar el SVG de auspiciantes en todas las páginas donde se muestra la composición 2026, añadir en `/finados/` una sección para elegir las próximas dignidades de Rey Pan y Señorita Colada Morada con los diez artes entregados, y publicar el resultado en Git y producción.

`main` y `origin/main` ya coincidían en `8bc93b5`; no entraron cambios durante el pull. La página histórica Dignidades Finados 2025 conserva intencionalmente su composición 2025: no pertenece a la campaña de auspiciantes 2026 y no fue sobrescrita.

## Implementación

- La composición compartida por `/finados/` y `/finados/shows/` usa el nuevo maestro `AUSPICIANTES PARA WEB.svg` sin modificar sus bytes: 321.306 bytes, `viewBox="0 0 2321 650"`, SHA-256 `347d08ee2d56c9dfedb8d904ae55b03a737e1802a309983a5d5f38ebc34ca054`. Caché renovada a `20260922-sponsors-3`.
- La sección `eleccion-dignidades` se ubica inmediatamente después de la franja lila “Legado que nos une” y antes del bloque “El territorio”. Usa la identidad de Finados: Anton/Inter, morado, fucsia, cian, amarillo, textura diagonal y tarjetas editoriales.
- Rey Pan conserva el orden recibido: Golpe a Golpe, Guaynaa, Hueveando, Kike Jav, Waldokinc y William Luna. Señorita Colada Morada conserva: Karina Chango, Kramelo Latino, Las Diablitas Taz Taz y Las Ñañas.
- Los SVG entregados contienen imágenes raster incrustadas y suman aproximadamente 140 MB. Se generaron diez representaciones WebP visualmente equivalentes de 1080 × 1350, entre 123 y 177 KB, para evitar una carga desproporcionada sin redibujar los artes. El SVG de Las Ñañas traía vacío el marco fotográfico; se completó únicamente ese marco con el arte oficial de Las Ñañas que ya estaba publicado en los activos Finados del proyecto.
- Los CTA invitan a conocer a quienes quieren llevar la corona, votar en los canales oficiales y apoyar al favorito. Los artes se pueden ampliar de forma segura en otra pestaña. La fecha visible `27 de octubre` coincide con la leyenda incorporada en los artes entregados.
- Se agregó una hoja CSS aislada y versionada `20260922-dignities-1`: seis candidaturas en tres columnas, cuatro en una fila de escritorio, dos columnas intermedias y una columna móvil. Respeta foco visible y movimiento reducido.

## Validación previa

- TDD específico: cuatro pruebas nuevas para orden, ubicación, copy/CTA, WebP, presupuesto y responsive; actualización del digest/versionado de auspiciantes.
- `npm run check` completo en WSL/Linux y PHP aprobado: 165 pruebas Node, 21 suites PHP y 10 pruebas de integración; build de 152 archivos, 40 HTML y 1.343 referencias válidas.
- Se corrigió una prueba histórica de Medios para aceptar saltos de línea CRLF y LF. Es un ajuste de portabilidad del test; no modifica el backend, sus recursos ni datos.
- QA visual local en 1440 × 1000 y 390 × 844: diez artes cargados, Anton activa, ancho de documento igual al viewport, sin desbordamiento horizontal; escritorio y móvil revisados.
- No se modificaron backend, base de datos, migraciones, DNS, formularios, Google Sheets, credenciales ni el sitio institucional del Complejo.

## Publicación

- Implementación integrada por fast-forward y publicada en `origin/main` mediante `a650a70` (`Añadir elección de dignidades Finados 2026`). Antes de integrar se repitió `git fetch origin main`; no había divergencia.
- El primer prevuelo WSL se detuvo localmente porque `.env.deploy` conservaba la ruta Windows de la llave. Se usó para la ejecución la copia privada ya instalada en WSL, con permisos `600`, sin mostrar, modificar ni versionar la llave o la configuración. No hubo conexión ni transferencia en ese primer intento.
- Prevuelo estándar posterior aprobado sin cambios remotos. El despliegue repitió toda la validación, creó una copia de seguridad recuperable, conservó la credencial remota de Google Sheets y transfirió la salida estática sin borrar archivos exclusivos. No se desplegó una nueva release del backend ni se ejecutaron migraciones.
- Verificación independiente posterior: `/finados/` y `/finados/shows/` respondieron HTTP 200 y contienen las versiones `20260922-dignities-1` y `20260922-sponsors-3`; CSS, SVG y diez WebP respondieron HTTP 200 y sus SHA-256 coincidieron byte por byte con `dist`. Total: 14 comprobaciones, cero fallos.
- Resultado: Git y producción actualizados. Sin cambios en base de datos, DNS, formularios, registros de personas, backend, Sheets o páginas institucionales del Complejo.
