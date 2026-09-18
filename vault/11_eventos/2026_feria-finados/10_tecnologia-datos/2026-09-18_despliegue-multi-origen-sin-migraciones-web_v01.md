---
titulo: "Publicación multi-origen sin migraciones"
responsable: "tecnología"
estado: aprobado
ultima_actualizacion: 2026-09-18
fuente: "solicitud expresa de Alex y verificaciones SSH/HTTPS"
confidencialidad: interno
---

# Publicación multi-origen sin migraciones

## Alcance y resultado verificado

Se hizo pull fast-forward de `main` en la única copia existente, de `a714b91` a `10527a9b6549fda05d78e5367809afcc5527e072`. Las tres notas locales anteriores quedaron preservadas en un stash específico, sin mezclarlas con los cambios entrantes.

El backend de ese commit fue publicado primero. Solo se sustituyó `allowedOrigin` por `allowedOrigins` en el JSON privado del backend, con estos valores exactos:

- `https://complejomushucruna.com`
- `https://finados.expoferiamushucruna.com`

Todos los demás valores del JSON se compararon íntegros antes de la sustitución. Se preparó una copia candidata privada, validada con el nuevo parser; el cambio de configuración se hizo inmediatamente antes de la activación de la release para evitar una incompatibilidad prolongada con el parser anterior. Configuración y respaldos permanecen fuera del repositorio y de los docroots públicos.

El flujo conservó prevuelo, respaldos de archivos y snapshot MySQL consistente de solo lectura, inventario productivo rastreado, comprobación SHA-256 de la release, lint PHP, activación recuperable, instalador administrado y health web. El programa de migraciones **no se envió ni ejecutó**: se sustituyó esa etapa por consultas en una transacción de solo lectura que exigieron todos los esquemas necesarios ya instalados. No se ejecutaron DDL, DML, importaciones, altas o retiros. Huellas de columnas/constraints e historial de migraciones iguales antes/después; otros JSON privados iguales.

## Verificaciones del backend y corrección aprobada del frontend

`npm run check` completo pasó: 143 pruebas Node, 20 suites PHP y 10 de integración; build de 129 archivos, 32 HTML y 1066 referencias válidas. Las pruebas usan datos sintéticos locales, no la base de producción.

Diez comprobaciones independientes HTTPS pasaron en `finados.complejomushucruna.com` y `api.expoferiamushucruna.com`: por cada API, GET `/api/health` con ambos orígenes (200, contrato `vocero-accounts-v1`), preflight OPTIONS con ambos orígenes (204), reflejo exacto del origen, credenciales, `Vary: Origin`, métodos/cabeceras y rechazo de origen no permitido (403 sin autorización CORS).

Antes de publicar frontend se detectó un defecto de empaquetado: el commit agrega imports de `runtime-origins.mjs` a administración, portal y validación, pero el build no copia ese módulo a `dist/`. El recurso respondía 404 en ambos sitios públicos. Publicar el artefacto sin el módulo impediría inicializar esas aplicaciones aunque las suites anteriores pasasen. Además, los scripts afectados conservaban sus versiones de caché anteriores.

Alex autorizó expresamente «Sí, corrige y publica el frontend». Se añadió al build la copia exacta de `runtime-origins.mjs` y se renovó únicamente la versión de los scripts de administración, portal y validación a `20260918-multi-origin-1`; CSS, formularios, información y lógica de datos intactos.

La nueva prueba de regresión falló primero con «Dependencia pública ausente: assets/finados/runtime-origins.mjs» y pasó después de la corrección. Comprueba la igualdad del módulo publicado con su fuente, recorre los imports ESM relativos de los tres clientes y exige las nuevas versiones en las cinco vistas afectadas. Check completo después de la corrección: exit code 0, 144 pruebas Node, 20 suites PHP, 10 de integración; build de 130 archivos, 32 HTML y 1066 referencias válidas. El prevuelo productivo repitió íntegramente ese check y verificó SSH, PHP y el backend instalado antes de modificar archivos.

La revisión automática rechazó inicialmente un commit/push adicional de documentación; no se ejecutaron esos comandos. Tras la autorización de la corrección, el commit técnico `dd321b8ab3d47da3c1a557093dfdf381598fe452` se publicó mediante push normal a `origin/main`: cinco archivos de implementación/prueba y esta evidencia técnica, sin incluir las tres notas locales ajenas. Las notas locales previas y las entrantes se restauraron mediante una unión trazable; todas sus líneas añadidas fueron verificadas y el stash inicial permanece como respaldo recuperable.

## Publicación completa y cierre

- Backend publicado primero: `10527a9`, release `20260918-multi-origin-10527a9-1fbdb5e2`.
- Frontend corregido publicado después: `dd321b8`, con respaldo privado `20260918-multi-origin-10527a9-b9196950-frontend` y archivo SHA-256 comprobado antes de la transferencia. Se utilizó el publisher estándar después del prevuelo completo, sin el flujo que reescribe configuración legal/Sheets. No se borraron archivos exclusivos del hosting.
- Gate final confirmó el mismo hash del JSON privado del backend, las mismas columnas/constraints y el mismo historial de migraciones antes/después del frontend. Otros JSON privados intactos; solo se permite actualizar el manifiesto de propiedad del endpoint administrado como artefacto del instalador.
- Veinte verificaciones HTTPS pasaron en ambos sitios: los cinco módulos de administración/portal/validación y sus dependencias respondieron 200, con MIME JavaScript e igualdad SHA-256 con el build; las cinco vistas respondieron 200, con caché `20260918-multi-origin-1` y CSP de ambas APIs. El módulo antes omitido ya está disponible en ambos dominios.
- Se repitieron las diez comprobaciones CORS/health tras el frontend: GET 200, OPTIONS 204 para ambos dominios contra ambas APIs; origen coincidente, credenciales y `Vary: Origin` correctos; origen extraño 403 sin autorización CORS.
- Las tres notas guardadas para la publicación se restauraron con sus SHA-256 exactamente iguales a los registrados antes del stash, incluida normalización de fin de línea verificada. Ambos stashes propios se conservan recuperables; las actualizaciones de cierre en las notas compartidas permanecen locales y separadas del commit técnico.
- Sin migraciones ni escrituras de registros en producción. No se enviaron formularios de personas, ni se cambiaron DNS, credenciales, Google Sheets o proyectos externos. No queda bloqueo del despliegue.

## Relacionados

- [[README|Tecnología y datos]]
- [[2026-09-15_plan-implementacion-cuentas-voceros-fotografia-web_v01|Portal autenticado de Voceros]]
