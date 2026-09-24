---
titulo: "Variante de franja manifiesto para Finados"
responsable: "tecnología/diseño"
estado: en_revision
ultima_actualizacion: 2026-09-24
fuente: "Solicitud de Alex del 24 de septiembre de 2026"
confidencialidad: interno
---

# Variante de franja manifiesto para Finados

## Objetivo

Reemplazar la banda de texto en desplazamiento continuo por una pieza con identidad propia, menos parecida a los marquesinas habituales de otros sitios.

## Propuesta implementada en local

- Composición editorial asimétrica con sello `Edición 2026`, titular monumental `Legado que nos une`, mensaje `Memoria que se celebra`, fechas y una trama cromática inspirada en el chumbi de la campaña.
- Fondo construido con capas geométricas y el año `2026` sobredimensionado, sin imágenes adicionales ni dependencias externas.
- Entrada por capas una sola vez al llegar al viewport: panel, titular, sello y trama se ensamblan; se eliminó por completo el ticker infinito.
- Variante horizontal en escritorio y composición vertical propia en móvil, sin desbordamiento lateral.
- `prefers-reduced-motion` conserva el contenido completo sin animaciones prolongadas.
- Caché local de la portada: `20260924-manifesto-1`.

## Validación

- Pruebas específicas de estructura, posición, ausencia del ticker y movimiento reducido: aprobadas.
- `npm run check`: 215 pruebas Node, 26 suites PHP y 10 pruebas de integración; build de 203 archivos, 66 HTML y 2.012 referencias.
- Revisión visual local en escritorio y móvil de 390 px; `scrollWidth` no supera el ancho útil.
- La revisión visual detectó y corrigió falta de respiración vertical del titular en escritorio.

## Estado de publicación

- La variante permanece únicamente en la rama local `codex/franja-manifiesto-finados`.
- No se subió a GitHub ni a producción y no se modificaron backend, migraciones o base de datos.

## Relación

- [[2026-09-24_actualizacion-auspiciantes-animacion-telon-web_v01|Actualización de auspiciantes y animación tipo telón]]
- [[README|Tecnología y datos de Finados 2026]]
