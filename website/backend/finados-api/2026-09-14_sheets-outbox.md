---
titulo: "Cola durable y contrato de Google Sheets para Voceros"
responsable: "operación del backend"
estado: en-revision
ultima_actualizacion: 2026-09-14
fuente: interna
confidencialidad: interno
---

# Sincronización secundaria de Voceros

Relacionado: [[2026-09-14_panel-voceros-backend-finados-diseno]].

La migración `002_sheets_outbox` debe instalarse antes de este backend y del handler público. Es aditiva y repetible para SQLite/MySQL; no transforma ni elimina registros existentes. La ficha, sus tres consentimientos y el pendiente cifrado se confirman juntos. Si falla la inserción del pendiente, toda la recepción revierte. Una caída posterior de Sheets conserva el éxito de la ficha y `googleSheets: queued`.

Cada pendiente guarda referencias, un payload AES-256-GCM y metadatos de entrega. El contenido se construye desde la ficha canónica y sus consentimientos. Los reintentos del mismo `submission_id` usan el snapshot persistido, sin sustituirlo por datos de otro POST. Tras confirmar la entrega, la misma transacción marca `synced`, retira el payload cifrado y registra `vocero.sheets_synced`. Si falla la auditoría, conserva el pendiente.

## Contrato obligatorio del receptor

El POST conserva `token`, `kind: voceros` y `record`. `record.id` y `record.submission_id` contienen el mismo ID estable de 32 caracteres hexadecimales. El Apps Script debe:

1. Autenticar el token y validar ambos identificadores.
2. Serializar la deduplicación y escritura (por ejemplo, con `LockService`), buscando por `submission_id` antes de insertar. Un reenvío no debe crear otra ficha.
3. Completar o recuperar escrituras parciales de los tres consentimientos, usando una clave estable por ID/tipo/hash.
4. Solo después de conservar ficha y consentimientos, responder HTTP 2xx con `{"ok":true,"submission_id":"<el mismo ID>"}`. Un duplicado ya completo devuelve el mismo comprobante.

Un `ok:true` genérico, un ID distinto, un error o timeout conserva `queued`. Este cliente impone el comprobante específico; no puede comprobar por sí solo la deduplicación interna del Apps Script. El receptor real y este contrato están **por confirmar**: no se modificó ni consultó Google en esta corrección. No activar reintentos remotos automáticos hasta probar la deduplicación y la recuperación parcial en un destino autorizado. La garantía es entrega **al menos una vez**, nunca exactamente una vez; perder el comprobante después de la escritura exige reenviar el mismo ID.

## Reconciliación y reinicios

Ejecutar desde la instalación privada del backend:

```sh
php bin/reconcile-sheets.php
```

Usa `FINADOS_CONFIG_PATH` y `FINADOS_PUBLIC_ROOTS` ya definidos por operación. En una base local sintética admite `--config /private/tmp/config.json`. Lee `google-sheets-config.json` junto a la configuración privada. Sin configuración secundaria conserva la cola y no accede a la red.

Cada ejecución procesa hasta 100 pendientes y muestra únicamente cantidades `synced`/`queued`. Una ejecución posterior es segura. Los errores de arranque devuelven código 1 y texto fijo; un pendiente secundario devuelve código 0 y su cantidad. Para monitorear el total durable, consultar `SELECT COUNT(*) FROM sheets_outbox WHERE state = 'pending'` en la base privada. Programar cron requiere la validación del receptor y la autorización operativa; esta tarea no lo instala.

Los fallos se programan con `next_attempt_at`, separado del lease: esperan 60 segundos la primera vez, duplican la espera por intento y llegan a un máximo de una hora. El formulario y el CLI respetan ese plazo. Los lotes eligen primero el plazo vencido más antiguo, con desempate por creación e ID; un lote antiguo fallido no impide intentar registros posteriores. Un resultado CLI de cero significa que no había trabajos elegibles en ese instante, no necesariamente que la cola durable esté vacía. El plazo sobrevive al reinicio y solo su dueño vigente puede modificarlo. La columna está incluida en la migración 002 todavía no desplegada; cualquier base local con su versión previa debe recrearse antes de probar esta versión.

La adquisición usa un UPDATE condicional y un token aleatorio de lease de 120 segundos. El transporte dura como máximo 10 segundos por petición. Dos trabajadores no entregan simultáneamente un pendiente con lease vigente. Si muere un proceso, el pendiente queda disponible al vencer; una confirmación antigua no puede completar el trabajo de otro token. Reiniciar no borra el pendiente.

Las importaciones históricas siguen usando `create()` sin crear envíos externos nuevos. Un registro canónico anterior sin outbox se recupera al repetir su ID por el formulario: se reconstruye desde DB y respeta un evento histórico de sincronización. El CLI procesa exclusivamente la outbox; no presume que todos los registros importados deban reenviarse. La cola JSONL compartida anterior deja de ser utilizada por Voceros; no se borra ni se altera porque otras páginas aún la usan. Su conciliación histórica debe resolverse antes de activar el trabajador sobre un receptor real.

Validación ejecutada localmente con SQLite. MySQL conserva un esquema equivalente y adquisición condicional compatible con InnoDB, pero su ejecución real queda pendiente del entorno autorizado.
