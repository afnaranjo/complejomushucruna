---
titulo: "Header de presentación Finados 2026"
responsable: "tecnología/diseño"
estado: en-revision
ultima_actualizacion: 2026-09-16
fuente: "Solicitud de Alex y confirmación expresa del 17 de septiembre de 2026 a las 10:30"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, presentacion]
---

# Presentación de Finados en la portada

Relacionado: [[README|Tecnología y datos]] y [[2026-09-16_ajuste-auspiciantes-plaza-shows-web_v01|Último ajuste de SHOWS]].

## Alcance confirmado

El header de `/finados/` pasa a destacar **PRESENTACIÓN FINADOS 2026**. La solicitud contenía una diferencia entre «mañana jueves» y noviembre: Alex confirmó expresamente **jueves 17 de septiembre de 2026, 10:30**, hora de Ecuador. No debe interpretarse como noviembre.

- Fecha absoluta del contador: `2026-09-17T10:30:00-05:00`, equivalente a las 15:30 UTC. No depende de la zona horaria configurada en el dispositivo.
- Lugar: **Complejo Intercultural y Deportivo MUSHUC RUNA**. El botón de mapa reutiliza la ubicación existente aprobada, `https://maps.app.goo.gl/xCssCeX8vNTH3m666`, en pestaña nueva con `noopener noreferrer`.
- Al cumplirse la hora, el contador y su etiqueta se ocultan y aparece **Bienvenidos a Finados Mushuc Runa 2026.**. También funciona al abrir después del inicio o volver de una pestaña suspendida.
- La venta de stands queda como primera sección del body, sin eliminar ni cambiar su información, diseño, expositor, fecha o enlace de reserva. Su título pasa a H2; la presentación es el único H1.
- Artistas, orden de programación, navegación, footer, SHOWS, formularios y páginas del Complejo permanecen sin cambios de contenido.

## Diseño e implementación

Se conserva la identidad de Finados: Anton e Inter locales, morado, lienzo, fucsia, cyan, amarillo, cenefa chumbi y símbolo oficial de legado. La guía de diseño web orienta la jerarquía, separación visual y adaptación a pantallas pequeñas, sin migrar el sitio ni cambiar su arquitectura o proveedor.

El CSS y el módulo del contador se aíslan en `website/src/finados/presentation.css` y `presentation.js`, con versión `20260916-presentation-1`. El build habitual los copia a `/assets/finados/`. El expositor, ahora debajo de la portada, se carga de forma diferida y deja de precargarse como imagen principal.

El reloj usa la diferencia con la fecha absoluta, no decrementos acumulativos. La bienvenida oculta correctamente las rejillas CSS mediante `[hidden]`, detiene su intervalo y mantiene un anuncio accesible sin leer cada segundo. El HTML inicial es determinista y muestra la fecha del evento como alternativa mientras se activa el módulo; no precalcula segundos en el build ni muestra guiones o una cuenta congelada. Sin JavaScript, la fecha sigue disponible.

## Validación y salida

- La primera validación completa detectó diferencias de segundos entre los builds local y de producción. Se corrigió el renderer para preservar el HTML determinista sin relajar ni modificar esa prueba de integración.
- Una repetición encontró un timeout de cinco segundos en el checkpoint de arranque de la prueba de colisión deliberada del servidor local. La misma prueba pasó aislada, sin cambios, en 6,32 segundos totales; el siguiente check completo pasó, incluida esa prueba en 6,55 segundos totales. No se ampliaron límites ni se alteraron fixtures, backend o controles de publicación.
- Seis pruebas específicas cubren zona horaria, límite exacto de inicio, ausencia de valores negativos, contenido y orden del body, enlace seguro de mapa, render determinista, apertura posterior al inicio, regreso de pestaña suspendida y estilos aislados.
- `npm run check` completo aprobado en Linux/PHP, exit code 0: 127 pruebas Node, 18 suites PHP, 10 integración, build de 125 archivos y 31 HTML/1030 referencias válidas. Cero pruebas omitidas.
- Vista previa local: `http://127.0.0.1:4173/finados/`, HTTP 200. Apertura solicitada en el panel de Codex.
- No se realizó revisión visual automatizada en navegador: no fue solicitada en esta tarea, conforme a la guía aplicada. La vista previa queda disponible para revisión de Alex.
- La solicitud actual confirma diseño y fecha, pero no ordena un despliegue. **No se ha publicado este nuevo header en producción**; hace falta autorización expresa para ejecutar el procedimiento estándar con respaldo y verificación HTTPS.

No se modifican credenciales, DNS, backend ni registros de personas en Google Sheets.
