---
titulo: "Actualización de Plaza de la Luna y auspiciantes"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-10-13
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
- El cierre del despliegue añadió dos regresiones de infraestructura y terminó con 268 pruebas Node, 34 suites PHP y 11 pruebas de integración en verde. `cd1fa2f` actualiza el handler del hosting a `ea-php82`; `82f72f5` impide que `tar` sobrescriba permisos de carpetas y retira escritura grupal de los archivos publicados.

## Publicación

- Alex confirmó por el canal de trabajo las tres nuevas identidades SSH. Se respaldaron y renovaron las entradas conocidas de Windows y WSL y se verificó que coincidieran exactamente antes de conectar. El JSON privado ya contenía los dos `allowedOrigins` aprobados, por lo que no se reescribió.
- Se desplegó primero backend y luego frontend, cada uno con respaldo recuperable. El backend incorpora el Top 20 agregado por vocero de `51d55ae`. No se hicieron importaciones ni cambios funcionales de datos; una comprobación posterior de solo lectura confirmó 35 migraciones esperadas, 35 aplicadas y 0 pendientes.
- La migración del hosting había retirado `ea-php81` y asignado ambos dominios a `ea-php82`. El primer control posterior detectó que el `.htaccess` antiguo entregaba PHP público como texto; se contuvo de inmediato, se publicó el handler correcto y se confirmó JSON ejecutable en Acreditación y Voceros. Los PHP versionados no contienen credenciales embebidas. El segundo intento detectó permisos `775` heredados por la extracción; se normalizó únicamente la carpeta afectada y se corrigió el publicador para no sobrescribir permisos de directorios y retirar escritura grupal.
- El despliegue estándar final terminó correctamente. SHOWS usa `20261012-shows-9` y `20261012-sponsors-9`; MFS usa `20261012-mfs-6`. En los dos dominios, los dos SVG de Plaza miden 64.599 bytes y coinciden con SHA-256 `43897b8ce05d815d3eff0097d0e8b7704848cc84a5099607d4c4000c98fdced2`; el SVG de auspiciantes coincide con `851c5b8ec94390471523ae9d5d15ceafd23b0c169dc6e147076af7295b9037ea` y el WebP con `d4a5c53a3e50aaae29ba3185141fd13cadf6cbf47d1b90136523236f1325b038`.
- Las dos APIs de salud respondieron HTTP 200 y `ok: true`. Cada API devolvió `Access-Control-Allow-Origin` exacto tanto para `https://complejomushucruna.com` como para `https://finados.expoferiamushucruna.com`.

## Relación

- [[2026-10-08_retiro-franja-actualizacion-logo-plaza-luna-web_v01|Retiro de franja y actualización anterior del logo de Plaza de la Luna]]
- [[2026-10-07_actualizacion-auspiciantes-skybiz-ingco-web_v01|Actualización anterior de auspiciantes]]
- [[README|Tecnología y datos de Finados 2026]]
