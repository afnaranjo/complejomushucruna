---
titulo: "Revisión de campañas activas de Meta para Finados 2026"
responsable: "Alex Naranjo / responsable de pauta digital"
estado: en-revision
ultima_actualizacion: 2026-09-02
fuente: "consulta autorizada de solo lectura a Meta Marketing API"
confidencialidad: interno
tags:
  - feria-finados-2026
  - meta-ads
  - pauta
  - seguridad
---

# Revisión de campañas activas de Meta para Finados 2026

Relacionado con [[../../13_datos-medicion/2026-08-24_auditoria-meta-2021-2026/README|la auditoría histórica de Meta]], [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/03_pauta/2026-08-24_plan-pauta-social-usd4000-finados-2026_v01|el plan de pauta social]] y [[../../_pendientes|los pendientes ejecutivos]].

## Alcance autorizado

Alex autorizó revisar en modo de solo lectura la cuenta publicitaria seleccionada para Finados 2026. La consulta se limitó a configuración general, objetos con estado efectivo activo y resultados de esos objetos durante los siete días completos anteriores y el día en curso parcial según la zona horaria de la cuenta.

No se autorizó ni realizó creación, edición, pausa, activación, publicación o cambio de presupuesto.

## Destinos previstos

Alex indicó que la pauta de Finados 2026 debe salir desde la cuenta revisada hacia la página pública [Finados Mushuc Runa](https://www.facebook.com/FinadosMushucRunaEc) y la cuenta de Instagram `@finadosmushucruna`, ambas reportadas por él como propiedad de Marketing Mushuc Runa. Los identificadores internos y enlaces privados de administración no se copiaron al repositorio.

Una segunda ventana de solo lectura validó la ruta técnica seleccionada: la página figura entre las páginas que la cuenta publicitaria puede promocionar; el Instagram indicado está vinculado a esa página y figura entre las cuentas de Instagram asignadas a la cuenta publicitaria; y la credencial posee los permisos vigentes de lectura y administración publicitaria necesarios para preparar pauta. Los nombres e identificadores devueltos coincidieron con los datos que Alex proporcionó, pero los identificadores internos no se copiaron al repositorio público.

## Resultado verificado

- La cuenta respondió como habilitada, sin motivo de desactivación y en moneda USD.
- La zona horaria de la cuenta continúa en `America/Los_Angeles`; no se modificó y los análisis operativos deben normalizarse a `America/Guayaquil`.
- En el corte del 2026-09-02 no existían campañas, conjuntos ni anuncios con estado efectivo activo.
- Por esa razón no hubo filas de rendimiento para objetos activos entre el 26 de agosto y el 1 de septiembre ni para el 2 de septiembre parcial.
- La respuesta fue completa, sin páginas pendientes: seis solicitudes `GET` en API v26.0, sin `Retry-After`, con utilización de cuenta reportada en 0 % y máximo observado de 1 % en el caso de uso.
- La validación posterior de permisos y activos realizó cinco solicitudes `GET` adicionales, todas con respuesta 200, sin `Retry-After` y con utilización máxima observada de 4 %. No consultó audiencias personalizadas ni realizó reintentos.

## Calidad y límites

El resultado demuestra únicamente que no había objetos **actualmente activos** en el momento de la consulta. No demuestra gasto cero de toda la cuenta durante el periodo, porque el corte de Insights se restringió a los identificadores activos y no auditó campañas pausadas, archivadas o finalizadas.

El presupuesto aprobado de USD 4.000 para Finados 2026 todavía no está conciliado con campañas creadas, gasto del periodo o facturación. No se puede calcular gasto 2026, saldo, CPA, ROAS ni rendimiento creativo con este corte.

La asociación técnica de cuenta, página e Instagram quedó validada, pero esto no demuestra que la facturación, el destino, la medición o una audiencia concreta estén listos para una campaña todavía no definida. Antes de crear o activar pauta se deben recibir y validar pieza, oferta, objetivo, público, ubicación, presupuesto, fechas, llamada a la acción, derechos y evento de optimización aplicable.

## Seguridad

Durante el proceso inicial una credencial fue pegada accidentalmente en el prompt normal de Terminal y terminó incluida en un archivo adjunto del chat. Su valor no se copia ni se conserva en este repositorio y debe considerarse expuesto. La validación posterior leyó una credencial de reemplazo desde el Llavero de macOS y la envió únicamente en el encabezado de autorización; no se imprimió, incorporó a URL, guardó en un archivo ni versionó. La revocación efectiva de la credencial anterior todavía debe confirmarse mediante el mecanismo oficial de Meta.

## Cierre

- Publicación externa: ninguna; solo once consultas `GET` autorizadas en dos ventanas.
- Cambios en Meta: ninguno.
- Gasto generado: USD 0; campañas, conjuntos y anuncios creados: 0.
- Riesgo inmediato: confirmar la revocación de la credencial anterior expuesta; conservar la de reemplazo exclusivamente en el Llavero.
- Siguiente paso de pauta: recibir de Alex la publicación o pieza exacta, oferta, objetivo, audiencia, ubicación, presupuesto, calendario y destino; luego cerrar facturación, medición, inventario, derechos y aprobación. La programación se traducirá desde `America/Guayaquil` a la zona horaria `America/Los_Angeles` de la cuenta. Una activación requerirá autorización nueva y específica.
