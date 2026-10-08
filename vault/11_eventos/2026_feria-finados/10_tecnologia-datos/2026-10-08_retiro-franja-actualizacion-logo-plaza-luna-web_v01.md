---
titulo: "Retiro de franja y actualización del logo de Plaza de la Luna"
responsable: "tecnología/diseño"
estado: aprobado
ultima_actualizacion: 2026-10-08
fuente: "Solicitud de Alex y SVG oficial recibido el 7 de octubre de 2026"
confidencialidad: interno
---

# Retiro de franja y actualización del logo de Plaza de la Luna

## Cambio solicitado

Alex pidió retirar de la portada `/finados/` la franja de auspiciantes situada después del contenido general y reemplazar el logo de Plaza de la Luna en todas sus apariciones visibles con el SVG oficial entregado. Autorizó Git y producción.

## Implementación

- Se ejecutó `git pull --ff-only origin main`; la copia ya estaba actualizada en `80a261e`.
- `/finados/` deja de cargar el componente y el CSS de auspiciantes. La composición oficial se conserva en el footer de `/finados/shows/`; no se retiraron logos de otras páginas.
- El SVG oficial de Plaza de la Luna mide `165 × 240`, pesa `64.599` bytes y tiene SHA-256 `43897b8ce05d815d3eff0097d0e8b7704848cc84a5099607d4c4000c98fdced2`.
- La revisión de seguridad no encontró scripts, `foreignObject`, manejadores de eventos ni URI JavaScript.
- El mismo maestro reemplaza los recursos visibles de SHOWS y Mushuc Freestyle. Las cachés pasan a `20261007-shows-8` y `20261007-mfs-5`, con dimensiones intrínsecas actualizadas.
- La prueba de ciclo de vida amplía de cinco a ocho segundos el tiempo de espera de checkpoints, dentro del límite total de quince segundos, para evitar falsos negativos del build Tailwind en el workspace Windows/WSL.

## Validación previa

- TDD: las pruebas fallaron primero contra la franja y los logos anteriores y quedaron en verde después del cambio.
- `npm run check` aprobado: 266 pruebas Node, 34 suites PHP, 11 pruebas de integración; build de 243 archivos, 81 HTML y 2.805 referencias válidas.
- QA local en escritorio y móvil de 390 px: `/finados/` contiene cero franjas y no carga `sponsors.css`; SHOWS conserva una franja dentro del footer y muestra el SVG nuevo; Mushuc Freestyle muestra el mismo SVG. Sin desbordamiento horizontal ni errores de consola.

## Publicación

- Estado: listo para commit, push y despliegue frontend. No requiere backend, migraciones ni cambios de base de datos.

## Relación

- [[2026-09-28_actualizacion-afiche-plaza-encuentro-web_v01|Actualización anterior del afiche y Plaza de la Luna]]
- [[2026-10-07_actualizacion-auspiciantes-skybiz-ingco-web_v01|Actualización de auspiciantes con Skybiz Travel e INGCO]]
- [[README|Tecnología y datos de Finados 2026]]
