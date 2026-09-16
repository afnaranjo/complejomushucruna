---
titulo: "Auspiciantes y Plaza de la Luna en SHOWS"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-09-16
fuente: "SVG de auspiciantes proporcionado por Alex y afiche FINAL aprobado"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, shows]
---

# Ajuste de auspiciantes y Plaza de la Luna

Relacionado: [[2026-09-16_implementacion_shows-finados-web_v01|Implementación y publicación inicial de SHOWS]] y [[README|Tecnología y datos]].

## Solicitud y alcance

Alex autorizó modificar `/finados/shows/` y publicar en GitHub y producción. Este ajuste sustituye, solo en SHOWS, la banda anterior por la composición completa del nuevo SVG. No modifica la programación, el orden de los artistas, las demás páginas ni los formularios.

- El SVG `AUSPICIANTES PARA WEB.svg` se incorpora sin modificar sus bytes. Conserva cenefa, organizador centrado, fondo, jerarquía y fila de logos. Se añade Textilana al texto alternativo, conforme al nuevo arte.
- Composición vectorial de 2321 × 650, responsive, sin desplazamiento horizontal forzado, ampliable en pestaña nueva con `noopener noreferrer`.
- El logo oficial de Plaza de la Luna se obtiene mediante recorte mecánico del afiche aprobado, sin redibujar ni utilizar IA. Se excluyen fecha y artistas vecinos.
- Hueveando y Las Ñañas se amplían con Anton, tarjetas de contraste Finados y fecha destacada. Se conservan respectivamente `31 octubre` y `01 noviembre`; en celular se apilan.
- CSS y referencias de recursos SHOWS versionados `20260916-shows-2` para invalidar la caché anterior.

## Activos y trazabilidad

- SHA-256 del SVG entregado y copiado: `1464352f77e98cfb7496fa9e8057638ded5c5cd9229e20608e3e857374106aaf` (263.266 bytes). Sin scripts, `foreignObject`, imágenes embebidas ni referencias externas.
- Archivo público: `website/public/assets/finados/shows/auspiciantes-finados-2026.svg`.
- Logo publicado: `website/public/assets/finados/shows/plaza-de-la-luna.webp` (170 × 165, 6.234 bytes, sin pérdida). Recorte nativo `1139, 2615, 170, 165` de `cartel-shows-2481.webp`.
- Exportador reproducible: `website/scripts/prepare-shows-sponsor-update.mjs`. El build normal usa los recursos locales, sin depender de la unidad compartida.

## Validación y publicación

- Nueve pruebas específicas SHOWS en verde: contenido, composición inmutable, seguridad, footer, logo, fechas, tamaño tipográfico, responsive, activos y versionado.
- `npm run check` completo en Linux/PHP: exit code 0, 121 pruebas Node, 18 suites PHP, 10 integración, build de 123 archivos y 31 HTML/1027 referencias válidas. Sin reducir validaciones ni alterar fixtures.
- Revisión visual en escritorio y viewport móvil de 390 × 844: logo legible, titulares de aproximadamente 49 px y 42 px, fechas originales, tarjetas apiladas en móvil y ancho de documento sin desbordamiento. SVG completo en el footer, sin cambiar composición; override de viewport retirado al terminar.
- Publicación completada mediante el procedimiento estándar; resultado verificado al final de esta nota.
- Las tres notas documentales previas permanecen fuera del commit de esta tarea, sin pérdida de cambios ajenos.

## Riesgos y seguimiento

La composición completa mantiene una única fila de auspiciantes, como el diseño entregado; en pantallas pequeñas puede ampliarse en otra pestaña. La resolución del logo es la nativa del afiche: un maestro vectorial independiente permitiría una futura mejora, sin impedir este ajuste solicitado. No se modifican DNS, credenciales, backend ni datos de personas en Sheets.

## Resultado de producción del 2026-09-16

- Implementación y pruebas enviadas a `origin/main` en `b52a5eb` (`Mejorar auspiciantes y shows de Plaza de la Luna`).
- Configuración privada, prevuelo y despliegue estándar aprobados desde `main` limpia y sincronizada. El procedimiento repitió el check completo en ambos modos, creó respaldo recuperable antes de transferir y conservó la credencial existente de Sheets; no eliminó archivos exclusivos del servidor.
- Verificación independiente HTTPS: 19 archivos, todos HTTP 200 y SHA-256 idéntico al build. Incluye SHOWS, cinco páginas principales, tres CSS, el SVG nuevo, logo de Plaza de la Luna, artes y las cuatro fuentes de Finados. Cero diferencias o fallos.
- Navegador de producción recargado: muestra el logo, las dos tarjetas ampliadas y la composición SVG nueva; recursos versionados `20260916-shows-2`.
- Las tres notas locales previas se restauraron con hashes idénticos; únicamente se retiró el stash propio de la publicación después de comprobarlo.
- No hubo nueva release del backend, cambios DNS, envío de datos de personas a Sheets, ni modificaciones del canal de compra. Se mantuvo el procedimiento habitual de configuración legal/controlador gestionado del frontend.
