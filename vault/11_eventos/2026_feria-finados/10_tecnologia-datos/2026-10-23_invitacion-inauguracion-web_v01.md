---
titulo: "Invitación digital para la inauguración de Finados 2026"
responsable: "tecnología / comunicación"
estado: publicado
ultima_actualizacion: 2026-10-23
fuente: interna
confidencialidad: interno
---

# Invitación digital para la inauguración de Finados 2026

## Origen y criterio visual

La propuesta se encontró entre los materiales locales de Descargas, en la carpeta `Propuesta-invitacion-inauguracion`, y Alex confirmó después la pieza `4_5_91.png` como referencia visual correcta. Esos archivos se usaron solo para estudiar composición, color y jerarquía; no se copiaron nombres personales de muestra ni se versionaron los binarios locales.

La implementación reconstruye la pieza como HTML y CSS adaptable con activos oficiales ya presentes en el sitio: fondo marfil, forma orgánica amarilla, cenefa modular fucsia/amarillo/turquesa/morado, logotipo Finados, sello tipográfico del organizador, bloque `SAVE THE DATE`, tarjetas diagonales, hora central, nombre dinámico y rol en tipografía serifa. El logotipo superior del Complejo se tiñe a morado mediante CSS sin alterar el SVG maestro. La dirección de la referencia decía `km 1/2`; se conservó el dato canónico confirmado del proyecto: Panamericana Sur km 12, vía Ambato–Riobamba.

## Alcance implementado

- Invitación personal independiente del Lanzamiento Guaynaa para `vocero` y `creador`.
- Dos narrativas administrables: `apoyo` y `registro`.
- Confirmación de asistencia, pantalla de gracias, gafete con QR individual y validación en puerta.
- Gestión en `/admin/invitaciones/inauguracion/`: alta en lote, audiencia, variante, edición, WhatsApp, renovación de enlace, retiro, exportación CSV y cinco vistas previas.
- Rutas públicas no indexables: `/ii/` y `/finados/invitacion/inauguracion/`, más `gracias/`, `gafete/` y `verificar/`.
- Migración aditiva `038_influencer_events`: conserva los invitados de Guaynaa en su evento y añade la inauguración en un evento separado. No se ejecutó contra la base de producción.

## Validación

- Desarrollo guiado por pruebas para backend, frontend público y administración.
- Pruebas específicas de Invitaciones e Influencers: 35/35 aprobadas.
- Suite Node: 299/299 aprobadas; suites PHP completas aprobadas.
- Integración corregida para reconocer el alias `/ii/`; suite completa 11/11 aprobada.
- Build: 291 archivos.
- Revisión visual en navegador real a 1440 px y 390 px, sin desbordamiento horizontal.
- Las rutas nuevas son `noindex`, no cargan Meta Pixel ni aviso de cookies y usan un namespace de API independiente.
- La validación pública del QR de Inauguración no expone la red social del invitado; Guaynaa conserva su contrato anterior.

## Estado y pendientes

- Estado: publicado el 2026-10-23 con autorización expresa de Alex.
- Publicación externa: backend primero con respaldo y migración aditiva `038_influencer_events`; frontend después con respaldo y transferencia sin borrado.
- Verificación: invitación, panel y Guaynaa en HTTP 200 en los dominios principal y espejo; ambas APIs saludables, evento `inauguracion` disponible y caché `20261023-invitacion-9` entregada por ambos sitios.
- Datos: no se crearon invitados de prueba ni se borraron o modificaron registros existentes.
- Pendiente: probar una invitación real de cada rol antes del envío masivo y confirmar los mensajes finales de WhatsApp.

## Relaciones

- [[2026-10-20_inauguracion-auspiciantes-ocultar-stands-web_v01|Inauguración oficial, auspiciantes y portada Finados]]
- [[../00_direccion-control/registro-decisiones|Registro de decisiones]]
- [[../../../_memoria-del-proyecto|Memoria del proyecto]]
