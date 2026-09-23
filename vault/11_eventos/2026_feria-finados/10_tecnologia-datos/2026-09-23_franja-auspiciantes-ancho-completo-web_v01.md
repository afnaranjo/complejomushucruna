---
titulo: "Franja de auspiciantes a ancho completo en la web"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-09-23
fuente: interna
confidencialidad: interno
---

# Franja de auspiciantes a ancho completo en la web

## Cambio solicitado

Alex pidió que la franja oficial de organizador y auspiciantes cubra todo el ancho de las páginas donde se muestra.

## Implementación

- Se reutilizó el SVG oficial `2321 × 650` ya versionado en el proyecto y su WebP optimizado; la unidad compartida `R:` no estuvo montada durante esta sesión, por lo que no se sustituyó el contenido del arte.
- Se eliminó el límite visual de `88rem` y el padding lateral del contenedor de la franja.
- En SHOWS, la franja salió del padding horizontal del pie, mientras el logotipo y el enlace inferior conservaron sus márgenes originales.
- El cambio compartido se aplica en FINADOS y SHOWS, las dos páginas donde está publicada la composición.
- La caché pasó a `20260923-sponsors-6`.

## Validación y publicación

- Prueba específica: 10/10 aprobadas.
- `npm run check`: 205 pruebas Node, 25 suites PHP y 10 pruebas de integración; build de 184 archivos, 62 HTML y 1.934 referencias.
- Revisión visual local en FINADOS y SHOWS: franja de borde a borde en escritorio; en móvil ocupa todo el ancho útil sin desbordamiento horizontal.
- Commit técnico: `5f5d174` en `origin/main`.
- Prevuelo y despliegue frontend completados con respaldo recuperable. No se desplegó backend ni se ejecutaron migraciones.
- Verificación HTTPS en `complejomushucruna.com` y `finados.expoferiamushucruna.com`: FINADOS y SHOWS publican la versión nueva, el CSS de ancho completo y el arte con SHA-256 idéntico al build.

## Relación

- [[2026-09-23_retiro-diablitas-ajuste-tres-candidatas-web_v01|Retiro de Las Diablitas y ajuste de tres candidatas]]
- [[README|Tecnología y datos de Finados 2026]]
