---
titulo: "Implementación de SHOWS Finados 2026"
responsable: "tecnología/diseño"
estado: aprobado
ultima_actualizacion: 2026-09-16
fuente: "afiche FINAL proporcionado por Alex y fuente web existente"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, shows]
---

# SHOWS Finados 2026

Relacionado: [[README|Tecnología y datos]] y [[../../../_memoria-del-proyecto|Memoria del proyecto]].

## Alcance verificado

- Nueva ruta `/finados/shows/`, situada antes de `VENTA DE STANDS` dentro del desplegable de `FINADOS 2026`.
- Identidad de campaña conservada: Anton, Inter, DM Serif Display, lienzo, noche, morado, fucsia, cian, amarillo y chumbi. No se modifica la identidad institucional.
- Header con personas disfrutando de un concierto, creado con la herramienta integrada de generación de imágenes, no con la CLI. Se identifica como imagen conceptual, no como fotografía del evento real.
- Afiche oficial responsive, ampliable en una nueva pestaña, y programación equivalente en HTML legible en celulares. Se conserva la jerarquía original del afiche, no se reordena cronológicamente.
- Atractivos, organizador, horario, shows de Plaza de la Luna y QR preservados. No se inventan precios, enlaces de compra de entradas ni condiciones.
- Los logos originales de auspiciantes quedan en una sola línea dentro del footer. En celular se desplaza solo esa banda horizontalmente, no toda la página.

## Fuente y exportación

Archivo original en el almacenamiento compartido: `Propuesta afiche artistas web - FINAL.svg`, recibido el 2026-09-16; el original no fue modificado.

SHA-256: `630832afe90c4d2ff0386cd704dd17d7b88ee8262e60f03a40bc4df638a66370`.

El SVG contiene una única imagen PNG embebida de 2481 × 3508, sin textos vectoriales. Se exportaron dos viewports nativos contiguos: body `0 0 2481 3300` y auspiciantes `0 3300 2481 208`. Ambos cubren el diseño entero. No se utilizó IA para modificar artistas, letras o logotipos.

Activos finales dentro del proyecto:

- `website/public/assets/finados/shows/ambiente-concierto-1600.webp` (133.206 bytes).
- `website/public/assets/finados/shows/ambiente-concierto-800.webp` (52.640 bytes).
- `website/public/assets/finados/shows/cartel-shows-2481.webp` (4.038.848 bytes, sin pérdida).
- `website/public/assets/finados/shows/cartel-shows-1240.webp` (1.297.286 bytes, sin pérdida).
- `website/public/assets/finados/shows/auspiciantes-finados-2026.webp` (40.326 bytes, sin pérdida).

Exportador reproducible: `website/scripts/prepare-shows-assets.mjs`. Recibe el SVG fuente, la imagen generada y un módulo Sharp disponible; no depende de la unidad compartida durante el build habitual.

## Prompt final del header

Modo utilizado: herramienta integrada `image_gen`, generación original sin imágenes de referencia. Las conversiones WebP son optimización web, no cambios de contenido.

> Use case: photorealistic-natural. Asset type: wide website hero photograph for SHOWS, Finados Mushuc Runa 2026. Primary request: create an original atmospheric image of adults enjoying an outdoor live concert in Ecuador, with a close group of happy Latin American friends in the foreground and a joyful audience behind them. People are cheering, singing and naturally raising their hands toward a stage outside the frame, genuine lively expressions, plausible anatomy. Style: premium candid concert photography with realistic skin texture and natural varied clothes, strong editorial festival energy, not illustration or UI mockup. Composition: panoramic landscape 16:9, medium-wide framing, foreground people concentrated across center and right; left third dark and visually quiet to accommodate HTML headline. Faces large enough to read on mobile, do not cut off heads, no identifiable celebrity or performer. Lighting and palette: nighttime deep plum and violet atmosphere, controlled magenta and turquoise stage light, a little warm amber rim light, soft concert haze; maintain clear face contrast, no heavy lens flares. Constraints: fictional conceptual crowd, no named real event, no logos, no lettering, no captions, no watermark, no fake brand symbols, no confetti covering faces, no alcohol, no glass UI panels. All typography and official branding will be added separately in HTML/CSS.

## QA y estado de publicación

- 49 pruebas enfocadas de frontend, contenido, identidad, activos y recepción en verde; 8 pruebas nuevas de SHOWS incluidas.
- Build: 121 archivos, 31 HTML, 1024 referencias válidas.
- Vista previa HTTP disponible en `/finados/shows/`; revisión visual en escritorio y viewport de 390 × 844. Anton visible, título fuera de la cabecera, artistas sin desbordes y logos con scroll localizado.
- Se conservaron fuera del commit técnico los cambios previos de `AGENTS.md`, memoria y pendientes.
- Al cierre de la creación, la página y sus artes permanecían locales por la limitación histórica de difusión del cartel. En el siguiente mensaje del 2026-09-16, Alex autorizó expresamente `sube a git y producción`, en respuesta a la pregunta sobre el afiche completo y el repositorio público. La autorización cubre la página SHOWS y los recursos entregados; no habilita anuncios adicionales ajenos al afiche.
- Las verificaciones parciales no equivalen a `npm run check` completo: esta computadora carece de PHP y tiene restricciones de symlinks. No se omiten ni debilitan los gates del despliegue.

## Próximo paso

Responsable: tecnología. Autorización recibida el 2026-09-16. Sincronizar los commits técnicos con GitHub, ejecutar el prevuelo completo en un entorno compatible y desplegar con respaldo. Registrar el resultado real; la autorización no sustituye las validaciones del despliegue.

## Resultado del intento autorizado del 2026-09-16

- GitHub actualizado: `15fea09` (implementación) y `04e32a3` (autorización), con `main` sincronizada `0 0` al iniciar el prevuelo.
- Se recuperaron los seis campos `FINADOS_*` desde el controlador público ya instalado y directorios existentes, comprobando sus rutas canónicas y permisos. Se completó únicamente `website/.env.deploy`, ignorado por Git. No se leyeron ni copiaron credenciales del JSON privado; no se cambiaron rutas o archivos del servidor. `deploy:validate` ahora aprueba también la configuración completa del backend.
- `npm run check` no aprobó: este Windows carece de PHP local y rechaza la creación de enlaces simbólicos con `EPERM`, incluso fuera del sandbox. No hay Docker ni instalación de WSL disponible.
- El prevuelo estándar `npm run deploy:check`, desde `main` limpia y sincronizada, se detuvo con **`No se pudo ejecutar npm.cmd.`** en el lanzador Windows, antes de llegar a respaldos, configuración o transferencia. No se omitió ni debilitó ninguna prueba para publicar.
- Las tres notas locales previas se guardaron temporalmente y se restauraron; sus hashes coincidieron exactamente. Se retiró solo el stash creado por esta ejecución después de verificar la restauración.
- Consulta remota posterior de solo lectura: SHOWS y su hero todavía no están instalados; PHP remoto y el backend existente sí están presentes. `GET /api/health` responde HTTP 200 con contrato `vocero-accounts-v1`. No hubo cambios en producción, backend, Sheets, DNS o canal de compra.
- **Pendiente:** ejecutar el prevuelo y despliegue en un entorno compatible con PHP y enlaces simbólicos, o preparar ese entorno local con autorización adicional porque implica instalar componentes de sistema. Revisar también el lanzador `npm.cmd` si se conserva la ejecución nativa Windows. Responsable: Alex/tecnología. Fecha: antes de producción.

## Preparación autorizada de Linux del 2026-09-16

- Alex respondió `si` a la solicitud expresa de preparar Linux/PHP en esta computadora, con aviso de posibles permisos de administrador y reinicio. No se amplió el alcance de publicación más allá de SHOWS.
- Se ejecutó el instalador oficial de Microsoft con `wsl --install --no-distribution --web-download`, mediante confirmación de administrador y sin reinicio automático. Resultado: exit code 0; WSL 2.7.14.0 instalado y `VirtualMachinePlatform` habilitado.
- **Bloqueo actual verificado:** el instalador informa que los cambios se aplican después de reiniciar; Windows tiene `Component Based Servicing/RebootPending`. `wsl --status` todavía informa que WSL2 no puede iniciar por virtualización no disponible. No se presupone resuelto el aviso de virtualización hasta comprobarlo después del reinicio; no se cambió el firmware.
- No se instalaron aún una distribución Linux ni PHP. No se modificaron el código de SHOWS, las validaciones, el servidor, el backend, Google Sheets, DNS o el canal de compra. GitHub ya contiene SHOWS; producción sigue pendiente y no se presenta como publicada.
- **Siguiente paso:** Alex debe guardar su trabajo y reiniciar Windows voluntariamente. Después, tecnología verificará WSL2, instalará la distribución y los requisitos PHP/Node, trabajará sobre el mismo checkout existente, ejecutará `npm ci` y el check completo, y retomará el despliegue estándar con respaldo. Si persiste el aviso de virtualización, diagnosticar antes de cambiar ajustes del sistema.
- Fuente del procedimiento consultada el 2026-09-16: [instalación oficial de WSL](https://learn.microsoft.com/en-us/windows/wsl/install) y [opciones oficiales de instalación](https://learn.microsoft.com/en-us/windows/wsl/basic-commands). El reinicio pendiente fue comprobado directamente en Windows, no inferido solo de la documentación.

## Reanudación después del reinicio del 2026-09-16

- Alex confirmó `listo`. WSL2 inicia después del reinicio voluntario y Ubuntu 26.04.1 LTS quedó instalado mediante el distribuidor oficial. Se prepararon PHP 8.5.4 CLI/CGI, sus extensiones necesarias y Node 24.19.0 desde fuentes oficiales; el archivo de Node se comprobó contra su SHA-256 oficial.
- Se utiliza el mismo checkout existente, sin clones, con un usuario Linux local sin contraseña habilitada. La configuración local de usuario y montaje resolvió los permisos de `npm ci`; instalación completada con cero vulnerabilidades informadas por npm.
- La llave existente, las huellas del servidor ya conocidas y la configuración de despliegue se copiaron a almacenamiento privado Linux con permisos restrictivos. No se cambiaron credenciales ni configuración del servidor. Estos archivos no se incorporan al repositorio.
- El primer check Linux detectó fixtures defectuosos: los datos privados sintéticos estaban dentro del docroot temporal y una prueba histórica dependía del controlador mutable actual. Se separó el docroot público canónico de los datos privados y se fijó el contenido histórico a un blob aprobado e inmutable. Se agregó una prueba negativa que confirma el rechazo cuando los datos privados están dentro del docroot. Las 48 pruebas de despliegue y las 118 pruebas Node aprobaron, sin relajar las protecciones del instalador.
- La prueba de terminal en Linux fallaba al leer el maestro después de cerrar el último descriptor esclavo del pseudoterminal. El fixture ahora mantiene abierto el esclavo desechable hasta verificar el estado restaurado. No se suprimen errores de lectura ni se modifican el comando real, la captura oculta de contraseñas o sus controles. La prueba enfocada de autenticación aprobó; también aprobó la prueba API después de instalar PHP CGI.
- El check completo, la integración, el build, el prevuelo remoto y la publicación se vuelven a ejecutar antes de considerar SHOWS publicada. Los resultados anteriores no sustituyen esas comprobaciones.
- Resultado posterior verificado: `npm run check` completo terminó con exit code 0: 118 pruebas Node, 18 suites PHP y 10 pruebas de integración aprobadas; build de 121 archivos y validación de 31 HTML/1024 referencias. `git diff --check` también aprobó. Falta todavía el prevuelo remoto y el despliegue estándar con respaldo; esta aprobación local no se presenta como publicación.
