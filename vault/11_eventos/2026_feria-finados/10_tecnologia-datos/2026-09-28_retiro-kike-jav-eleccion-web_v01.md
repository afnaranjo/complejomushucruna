---
titulo: "Retiro de Kike Jav de la elección web"
responsable: "tecnología/diseño"
estado: listo-para-publicar
ultima_actualizacion: 2026-09-28
fuente: "Solicitud de Alex del 28 de septiembre de 2026"
confidencialidad: interno
---

# Retiro de Kike Jav de la elección web

## Solicitud

Alex pidió retirar de `/finados/` el arte de Kike Jav, candidato a Rey Pan, y publicar el resultado en Git y producción.

## Implementación

- Se eliminó únicamente la entrada `kike-jav` de la lista que genera la elección.
- Rey Pan conserva, en orden: Golpe a Golpe, Guaynaa, Hueveando, Waldokinc y William Luna.
- La introducción se actualizó a «Cinco nominados. Una corona.» y la numeración visible queda continua del 01 al 05.
- Señorita Colada Morada permanece sin cambios con Karina Chango, Kramelo Latino y Las Ñañas.
- El archivo histórico de Kike Jav no se eliminó; deja de estar referenciado y visible en la web.

## Validación

- TDD: la prueba enfocada falló primero con la lista anterior y después aprobó 6/6 controles con ocho candidaturas vigentes y sin `Kike Jav` ni `kike-jav` en el HTML.
- `npm run check` completo en verde: 258 pruebas Node, 32 suites PHP y 11 integraciones.
- Build: 232 archivos, 81 HTML y 2.793 referencias válidas.
- QA visual local en escritorio y 390 px: cinco tarjetas de Rey Pan, tres de Señorita Colada Morada, numeración continua, sin desbordamiento horizontal y sin el arte retirado.
- La compatibilidad CRLF de dos pruebas administrativas se corrigió sin cambiar la aplicación.

## Alcance de publicación

- Frontend solamente.
- No se modifican backend, migraciones, base de datos, Google Sheets ni formularios.
- La publicación incluye también la actualización ya validada de SHOWS y Encuentro autorizada en el mismo turno.

## Relación

- [[2026-09-28_actualizacion-afiche-plaza-encuentro-web_v01|Actualización de SHOWS y Encuentro]]
- [[README|Tecnología y datos de Finados 2026]]
