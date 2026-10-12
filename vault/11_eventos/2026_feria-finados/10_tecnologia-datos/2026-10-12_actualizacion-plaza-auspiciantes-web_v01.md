---
titulo: "Actualización de Plaza de la Luna y auspiciantes"
responsable: "tecnología/diseño"
estado: en_progreso
ultima_actualizacion: 2026-10-12
fuente: "Solicitud de Alex y SVG oficiales recibidos el 12 de octubre de 2026"
confidencialidad: interno
---

# Actualización de Plaza de la Luna y auspiciantes

## Cambio solicitado

Alex pidió sincronizar `main`, reemplazar el logo de Plaza de la Luna en todas sus apariciones visibles, actualizar la composición oficial de auspiciantes y publicar Git y producción.

## Implementación

- El maestro de Plaza de la Luna recibido coincide byte por byte con el ya revisado: `165 × 240`, SHA-256 `43897b8ce05d815d3eff0097d0e8b7704848cc84a5099607d4c4000c98fdced2`. Se confirmó su uso en SHOWS y Mushuc Freestyle y se renovaron sus cachés a `20261012-shows-9` y `20261012-mfs-6`.
- La composición de auspiciantes pasa a `2321 × 650`, añade Cayambe Import S.A. y ENAG Escuela de Cocina, y conserva los demás logos en el orden del arte oficial. El SVG exacto tiene SHA-256 `851c5b8ec94390471523ae9d5d15ceafd23b0c169dc6e147076af7295b9037ea`; el WebP optimizado de 79.128 bytes tiene SHA-256 `d4a5c53a3e50aaae29ba3185141fd13cadf6cbf47d1b90136523236f1325b038`.
- Se actualizaron dimensiones intrínsecas, proporción, texto alternativo, validación del conversor, pruebas de integridad y caché `20261012-sponsors-9`.
- `/finados/` sigue sin cargar la franja; la composición 2026 permanece únicamente en el footer de `/finados/shows/`. La franja histórica de Dignidades 2025 no se modifica.
- El SVG nuevo no contiene scripts, `foreignObject`, manejadores de eventos ni URI JavaScript. Su única referencia embebida es una imagen PNG inerte dentro del presupuesto validado.

## Validación

- TDD: las pruebas específicas fallaron primero frente a los hashes, dimensiones y cachés anteriores y quedaron en verde después de la sustitución.
- `npm run check` aprobado: 266 pruebas Node, 34 suites PHP y 11 pruebas de integración; build de 243 archivos, 81 HTML y 2.805 referencias válidas.
- Git: `caabfdc` enviado a `origin/main` después de integrar sin conflicto el cambio remoto `51d55ae`.

## Publicación

- El despliegue seguro debía ejecutar backend y luego frontend porque el `pull` incorporó el ajuste de Top 20 de Voceros pendiente en `51d55ae`.
- El control completo previo al backend volvió a pasar, pero el probe remoto se detuvo antes de crear respaldo, release o transferencia: las tres claves públicas que presenta ahora el servidor SSH son distintas de las tres identidades conocidas guardadas en Windows y WSL.
- El puerto SSH y cPanel responden; cPanel entrega HTTPS válido, pero no existe una sesión autenticada y el dominio no publica registros SSHFP. No se reemplazó `known_hosts` sin una verificación por canal confiable.
- Producción continúa con `20261007-sponsors-8`, `20260928-shows-7` y `20260924-mfs-4`; el SVG remoto de auspiciantes y el logo remoto de Plaza todavía corresponden a los maestros anteriores.
- No hubo carga parcial, activación, migración ni modificación de base de datos. Para continuar, el proveedor o cPanel debe confirmar la nueva huella SSH; después corresponde actualizar la entrada conocida, desplegar backend → frontend y comprobar versiones y hashes en ambos dominios.

## Relación

- [[2026-10-08_retiro-franja-actualizacion-logo-plaza-luna-web_v01|Retiro de franja y actualización anterior del logo de Plaza de la Luna]]
- [[2026-10-07_actualizacion-auspiciantes-skybiz-ingco-web_v01|Actualización anterior de auspiciantes]]
- [[README|Tecnología y datos de Finados 2026]]
