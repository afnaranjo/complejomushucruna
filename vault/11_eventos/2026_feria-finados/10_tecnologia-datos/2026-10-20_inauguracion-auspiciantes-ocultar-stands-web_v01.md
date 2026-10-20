---
titulo: "Inauguración oficial, auspiciantes y retiro de venta de stands en Finados"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-10-20
fuente: "Solicitud expresa de Alex y SVG oficial recibido el 20 de octubre de 2026"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, inauguracion, auspiciantes]
---

# Inauguración oficial, auspiciantes y retiro de venta de stands en Finados

Relacionado: [[2026-09-17_cabeceras-contador-apertura-finados-web_v01]], [[2026-10-12_actualizacion-plaza-auspiciantes-web_v01]] y [[_memoria-del-proyecto]].

## Alcance aprobado

- La cabecera compartida deja de decir «Bienvenidos a Finados Mushuc Runa 2026» y anuncia «Inauguración Oficial de Finados Mushuc Runa».
- El contador termina el viernes 30 de octubre de 2026 a las 12:00 de `America/Guayaquil`, instante absoluto `2026-10-30T12:00:00-05:00` (`2026-10-30T17:00:00Z`).
- La promoción de venta de stands se retira del body de `/finados/`. La página específica y su acceso de navegación se conservan.
- La composición visible de auspiciantes 2026 en el footer de SHOWS se reemplaza por el SVG oficial recibido. La portada Finados continúa sin franja y Dignidades 2025 conserva su arte histórico.

## Implementación y seguridad

- Activos del contador con caché `20261020-official-opening-1` y auspiciantes con caché `20261020-sponsors-10`.
- SVG oficial `2321 × 650`, 535.153 bytes, SHA-256 `c94d88753f46258cebaf40e7cc1b55da646024ce2dd7b25cbb1c36c80a6b0215`; WebP optimizado de 84.760 bytes, SHA-256 `fd2a9e0f68a8cf36c75c53ff902f539a038b31f970cbfa47fc858b875c6d1b3b`.
- El SVG no contiene scripts, `foreignObject`, manejadores de eventos, URI JavaScript ni referencias externas. Conserva una imagen PNG inerte embebida dentro del presupuesto validado.
- El texto alternativo incorpora Ron Flor de Caña, Aguardiente Antioqueño y MashiWasi en el orden del arte nuevo.
- No hay cambios de backend, migraciones, base de datos, formularios ni registros.

## Validación local

- `npm run check` aprobado en Linux: 284 pruebas Node, 34 suites PHP, 11 pruebas de integración; build de 283 archivos, 91 HTML y 3.060 referencias válidas.
- Las pruebas confirman el instante de Ecuador, el cambio accesible del contador, las siete cabeceras compartidas con Voceros excluido, la ausencia de la promoción de stands en el body de Finados y la integridad exacta de los nuevos activos de auspiciantes.

## Publicación

- Commit funcional `f084516` enviado a `origin/main`. Durante el primer intento llegó el commit concurrente `0677303`; el publicador se detuvo antes del respaldo por divergencia, se hizo pull fast-forward y se repitió desde `main` limpia y sincronizada.
- Frontend desplegado desde `0677303` con respaldo recuperable y sin eliminar archivos exclusivos del servidor. No se desplegó backend ni se ejecutaron migraciones o escrituras de datos.
- Verificación HTTPS independiente aprobada en `complejomushucruna.com` y `finados.expoferiamushucruna.com`: landing y SHOWS correctos, promoción de stands ausente, versión de auspiciantes presente y SVG/WebP idénticos por SHA-256 al build.
- Las APIs `finados.complejomushucruna.com` y `api.expoferiamushucruna.com` respondieron HTTP 200 y `ok: true`; cada una devolvió el origen CORS exacto para los dos dominios permitidos.
