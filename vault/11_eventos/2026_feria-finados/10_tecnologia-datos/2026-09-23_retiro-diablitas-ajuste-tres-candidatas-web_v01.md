---
titulo: "Retiro de Las Diablitas y ajuste de tres candidatas en la web"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-09-23
fuente: interna
confidencialidad: interno
---

# Retiro de Las Diablitas y ajuste de tres candidatas en la web

## Cambio solicitado

Alex pidió retirar de la elección de dignidades el arte de **Las Diablitas Taz Taz** y adaptar la composición de las tres candidatas restantes.

## Implementación

- Se quitó a Las Diablitas Taz Taz del catálogo que genera la página `/finados/`; el archivo fuente histórico no fue eliminado.
- Señorita Colada Morada queda con Karina Chango, Kramelo Latino y Las Ñañas.
- El texto se actualizó de cuatro a tres nominadas.
- En escritorio las tres tarjetas ocupan una fila de columnas iguales; en tablet pasan a dos columnas y en móvil a una.
- La caché de la sección cambió a `20260923-dignities-5`.

## Validación y publicación

- Prueba específica: 5/5 aprobadas.
- `npm run check`: 204 pruebas Node, 25 suites PHP y 10 pruebas de integración; build de 184 archivos, 62 HTML y 1.934 referencias.
- Revisión local: tres candidatas visibles, sin Las Diablitas y sin desbordes en escritorio o móvil.
- Commit técnico: `0c5ba45` en `origin/main`.
- Prevuelo y despliegue frontend completados con respaldo recuperable. No se desplegó backend ni se ejecutaron migraciones.
- Verificación HTTPS en `complejomushucruna.com` y `finados.expoferiamushucruna.com`: página 200, nueve tarjetas, candidatura retirada, tres columnas en el bloque y 9/9 artes vigentes idénticos al build por SHA-256.

## Relación

- [[2026-09-23_correccion-octubre-artes-dignidades-web_v01|Corrección de OCTUBRE en artes de dignidades]]
- [[README|Tecnología y datos de Finados 2026]]
