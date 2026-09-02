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

Esta selección editorial está confirmada por Alex, pero el corte de API realizado no validó la asignación técnica de ambos activos a la cuenta publicitaria, sus permisos de publicación ni su vinculación entre Facebook e Instagram. Esos controles, junto con facturación y medición aplicable al objetivo, deben cerrarse antes de activar una campaña.

## Resultado verificado

- La cuenta respondió como habilitada, sin motivo de desactivación y en moneda USD.
- La zona horaria de la cuenta continúa en `America/Los_Angeles`; no se modificó y los análisis operativos deben normalizarse a `America/Guayaquil`.
- En el corte del 2026-09-02 no existían campañas, conjuntos ni anuncios con estado efectivo activo.
- Por esa razón no hubo filas de rendimiento para objetos activos entre el 26 de agosto y el 1 de septiembre ni para el 2 de septiembre parcial.
- La respuesta fue completa, sin páginas pendientes: seis solicitudes `GET` en API v26.0, sin `Retry-After`, con utilización de cuenta reportada en 0 % y máximo observado de 1 % en el caso de uso.

## Calidad y límites

El resultado demuestra únicamente que no había objetos **actualmente activos** en el momento de la consulta. No demuestra gasto cero de toda la cuenta durante el periodo, porque el corte de Insights se restringió a los identificadores activos y no auditó campañas pausadas, archivadas o finalizadas.

El presupuesto aprobado de USD 4.000 para Finados 2026 todavía no está conciliado con campañas creadas, gasto del periodo o facturación. No se puede calcular gasto 2026, saldo, CPA, ROAS ni rendimiento creativo con este corte.

## Seguridad

Durante el proceso una credencial fue pegada accidentalmente en el prompt normal de Terminal y terminó incluida en un archivo adjunto del chat. Su valor no se copia ni se conserva en este repositorio, pero debe considerarse expuesto y no volver a utilizarse. Antes de cualquier nueva consulta, Alex debe revocarla o rotarla mediante el mecanismo oficial de Meta y mantener la nueva credencial fuera del chat.

## Cierre

- Publicación externa: ninguna; solo seis consultas `GET` autorizadas.
- Cambios en Meta: ninguno.
- Riesgo inmediato: credencial expuesta pendiente de revocación o rotación.
- Siguiente paso de pauta: recibir de Alex la pieza, oferta, objetivo y audiencia; luego cerrar los gates de asociación de activos, permisos, facturación, medición, inventario, derechos, destino y responsable antes de preparar campañas pausadas. Una activación requerirá autorización nueva y específica.
