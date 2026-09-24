---
titulo: "Variante de franja manifiesto para Finados"
responsable: "tecnología/diseño"
estado: publicado
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

## Publicación

- Commit técnico `88f670c`, integrado y publicado en `origin/main` con autorización de Alex.
- Prevuelo y despliegue frontend completados con respaldo recuperable.
- Verificación HTTPS independiente en `complejomushucruna.com` y `finados.expoferiamushucruna.com`: HTTP 200, caché `20260924-manifesto-1`, franja manifiesto presente y ticker anterior ausente.
- El CSS remoto coincide con el build local por SHA-256 (`41B04A132357F64439ECF20317CC4864B2182B5B81DB00F4891DD463548E782C`), contiene la entrada por capas y el modo de movimiento reducido.
- No se desplegó backend ni se ejecutaron migraciones o cambios de base de datos.

## Relación

- [[2026-09-24_actualizacion-auspiciantes-animacion-telon-web_v01|Actualización de auspiciantes y animación tipo telón]]
- [[README|Tecnología y datos de Finados 2026]]
