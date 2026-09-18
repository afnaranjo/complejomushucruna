---
titulo: "Publicación multi-origen sin migraciones"
responsable: "tecnología"
estado: en-revision
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

La nueva prueba de regresión falló primero con «Dependencia pública ausente: assets/finados/runtime-origins.mjs» y pasó después de la corrección. Comprueba la igualdad del módulo publicado con su fuente, recorre los imports ESM relativos de los tres clientes y exige las nuevas versiones en las cinco vistas afectadas. Check completo después de la corrección: exit code 0, 144 pruebas Node, 20 suites PHP, 10 de integración; build de 130 archivos, 32 HTML y 1066 referencias válidas. Pendiente: publicar el frontend con respaldo y verificar integridad de assets/caché en ambos dominios y CORS/health otra vez.

La revisión automática rechazó inicialmente un commit/push adicional de documentación; no se ejecutaron esos comandos. Las notas locales previas y las entrantes se restauraron mediante una unión trazable; todas sus líneas añadidas fueron verificadas y el stash propio permanece como respaldo recuperable. La corrección de código posteriormente autorizada se mantendrá separada de esas tres notas locales ajenas, que no se incorporarán al commit.

## Relacionados

- [[README|Tecnología y datos]]
- [[2026-09-15_plan-implementacion-cuentas-voceros-fotografia-web_v01|Portal autenticado de Voceros]]
