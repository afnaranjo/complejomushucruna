---
titulo: "Diseño de cuentas de voceros y fotografía privada"
responsable: "por asignar"
estado: en-revision
ultima_actualizacion: 2026-09-15
fuente: interna
confidencialidad: interno
---

# Diseño de cuentas de voceros y fotografía privada

Relacionado con [[diccionario-datos]] y [[registro-riesgos]].

## Objetivo

Convertir el registro de Voceros en un flujo autenticado con dos perfiles claramente aislados:

- **Administrador:** conserva el panel privado y puede revisar todos los registros, fotografías, estados y notas.
- **Vocero:** crea su propia cuenta, inicia sesión y solo puede completar, consultar o editar su registro mientras esté en estado `Nuevo` o `Pendiente de autorización`.

Cada respuesta de sesión identificará explícitamente el rol como `administrador` o `vocero`; el rol se decide en el servidor y nunca se acepta desde el navegador.

La fotografía será obligatoria para los registros nuevos y servirá para verificar identidad y preparar una credencial o gafete. No será una imagen pública ni se enviará a Google Sheets.

## Alcance aprobado

1. Autorregistro de voceros con correo y contraseña.
2. Inicio y cierre de sesión independiente del acceso administrativo.
3. Formulario autenticado, ligado uno a uno con la cuenta del vocero.
4. Fotografía obligatoria y privada para registros nuevos.
5. Consulta del propio registro y edición antes de una decisión administrativa.
6. Vista de fotografía desde el detalle administrativo.
7. Recuperación asistida: el administrador genera un enlace de un solo uso que entrega al vocero por el canal operativo acordado.
8. Migración aditiva: los registros históricos permanecen visibles sin inventar cuentas, fotos o consentimientos.
9. Respaldo verificable de base de datos y fotografías.

Quedan fuera de esta versión: envío automático de correos o mensajes, acceso con redes sociales, reconocimiento facial, publicación automática de fotografías, generación masiva de gafetes, carga de videos, termómetro de visualizaciones y vinculación automática de registros históricos.

## Decisiones de arquitectura

### Separación de perfiles

El acceso administrativo existente continuará en `/admin/` y utilizará sus rutas `/api/auth/*`. El nuevo acceso de voceros vivirá en la web pública, pero tendrá sesiones y rutas separadas bajo `/api/vocero/*`. Una sesión de vocero nunca autoriza una ruta administrativa y una ruta de vocero siempre limita las consultas al identificador de la cuenta autenticada.

La base conservará `admin_users` para no arriesgar el acceso existente y añadirá tablas específicas para cuentas de voceros. La separación física simplifica la autorización y evita una migración destructiva del sistema administrativo ya desplegado.

### Rutas de interfaz

- `/finados/voceros/`: conserva la landing y cambia sus llamados a la acción a `Crear cuenta` e `Iniciar sesión`.
- `/finados/voceros/acceso/`: registro e inicio de sesión del vocero.
- `/finados/voceros/mi-registro/`: formulario y estado personal; si no existe sesión, redirige a acceso.
- `/finados/voceros/restablecer/`: recibe un token temporal generado por el administrador y permite definir una contraseña nueva.
- `/admin/` y `/admin/voceros/`: acceso y gestión administrativa existente.

Todas las páginas de cuenta, registro y administración serán `noindex` y no aparecerán en el mapa del sitio.

### Rutas de API

El frontend seguirá en `complejomushucruna.com`. Las funciones y datos privados vivirán en `https://finados.complejomushucruna.com/api/`:

- `GET /api/vocero/auth/session`
- `POST /api/vocero/auth/register`
- `POST /api/vocero/auth/login`
- `POST /api/vocero/auth/logout`
- `GET /api/vocero/profile`
- `POST /api/vocero/profile`, multipart e idempotente para enviar o editar mientras el estado lo permita
- `GET /api/vocero/photo`, fotografía de la cuenta autenticada
- `POST /api/vocero/auth/reset`, consumo de un token temporal
- `POST /api/voceros/{public_id}/password-reset`, generación administrativa del enlace temporal
- `GET /api/voceros/{public_id}/photo`, fotografía para el administrador autenticado

El endpoint anónimo actual `/api/voceros/` dejará de aceptar altas cuando se publique el nuevo frontend. El despliegue será compatible por etapas: primero se instala el backend nuevo sin interrumpir el flujo vigente; después el frontend cambia al acceso autenticado y desactiva el alta anónima.

## Modelo de datos

Las migraciones serán nuevas y aditivas para MySQL y SQLite:

- `vocero_accounts`: identificador público, correo cifrado, índice ciego del correo, hash de contraseña, evidencia de lectura del aviso de privacidad, estado activo/bloqueado y fechas de creación, actualización y último acceso.
- `vocero_account_attempts`: intentos de acceso limitados por cuenta e IP mediante hashes HMAC.
- `vocero_password_resets`: token guardado únicamente como hash, fecha de expiración, fecha de consumo y administrador que lo creó.
- `vocero_account_links`: relación uno a uno entre `vocero_accounts` y `voceros`; los registros históricos no tendrán una fila de vínculo.
- `vocero_photos`: relación única con `voceros`, clave aleatoria de almacenamiento, tipo, tamaño, dimensiones, hash SHA-256 y fecha.

El correo será obligatorio, único y no se guardará en texto claro. Cada cuenta podrá tener como máximo un registro. No se asociarán automáticamente cuentas nuevas con registros históricos, porque una coincidencia de correo no acredita propiedad.

## Autenticación y autorización

- Contraseñas entre 10 y 128 caracteres; se aceptan frases largas y no se imponen reglas de símbolos.
- Hash con Argon2id cuando PHP lo soporte y bcrypt como alternativa.
- Cookie exclusiva para voceros, `HttpOnly`, `Secure`, `SameSite=Lax` y separada de la cookie administrativa.
- Sesión con 30 minutos máximos de inactividad y 12 horas de duración absoluta.
- Regeneración del identificador al iniciar sesión y al cambiar contraseña.
- Token CSRF obligatorio en toda operación que cambie estado.
- CORS limitado exactamente a `https://complejomushucruna.com` y solicitudes con credenciales.
- Respuestas de acceso y registro que no permitan enumerar cuentas.
- Bloqueo temporal después de cinco intentos fallidos dentro de 15 minutos.
- El administrador puede generar un enlace aleatorio de un solo uso, con 30 minutos de vigencia; la base guarda solo su hash. El sistema no lo enviará automáticamente.

## Flujo del vocero

1. El usuario pulsa `Crear cuenta` desde la landing.
2. Ingresa correo, contraseña y confirmación; acepta el aviso necesario para crear la cuenta.
3. El sistema inicia su sesión y abre `Mi registro`.
4. Completa los datos actuales del programa y añade una fotografía.
5. La interfaz valida campos y muestra una vista previa local; la validación definitiva ocurre en el servidor.
6. El servidor crea el registro, conserva las versiones exactas de los consentimientos y liga el registro con la cuenta.
7. El vocero ve su estado y sus datos. Puede editarlos mientras esté `Nuevo` o `Pendiente de autorización`.
8. Cuando el administrador lo marca `Aprobado` o `Rechazado`, el registro queda de solo lectura para el vocero.

Los participantes de 16 y 17 años conservan el estado `Pendiente de autorización` hasta que el equipo reciba la autorización escrita. Su foto solo tendrá uso operativo de identificación y gafete mientras no exista la autorización adicional requerida para difusión.

## Fotografía para identificación y gafete

### Experiencia

El campo se llamará **Fotografía para identificación y gafete** y será obligatorio. La ayuda dirá: “Sube una foto reciente, de frente, con el rostro visible y sin filtros. Se usará para verificar tu identidad y, si corresponde, elaborar y entregar tu credencial o gafete. Su carga no autoriza por sí sola la publicación en canales oficiales. JPG, PNG o WebP; máximo 5 MB.”

La interfaz mostrará una vista previa vertical, permitirá reemplazar el archivo antes de guardar y explicará errores sin borrar los demás campos. No se implementará recorte manual en esta versión.

### Validación y normalización

- Archivo recibido correctamente y tamaño real máximo de 5 MiB.
- Solicitud multipart máxima aproximada de 5 MiB más 256 KiB de campos.
- MIME verificado con Fileinfo; extensión o tipo declarado por el navegador no son evidencia suficiente.
- Decodificación real con GD, dimensiones positivas y límite de píxeles para evitar agotamiento de memoria.
- Formatos aceptados: JPEG, PNG y WebP solo si el servidor puede decodificarlos.
- Corrección de orientación cuando exista EXIF utilizable.
- Reescritura a JPEG, calidad aproximada de 88 y lado largo máximo de 1600 píxeles.
- Eliminación del original y de sus metadatos después de normalizar.

### Almacenamiento y acceso

La imagen normalizada se cifrará con la clave de aplicación antes de guardarse. El directorio se derivará de la ubicación privada de configuración, fuera de ambos `public_html`, con permisos `0700`; cada archivo tendrá permisos `0600`. El nombre será aleatorio y nunca contendrá cédula, correo, nombre, identificador público ni nombre original.

La API descifrará y enviará la imagen solo después de comprobar sesión y propiedad o rol administrativo. Las respuestas usarán `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` y no expondrán rutas internas. Cada visualización o descarga administrativa quedará auditada. El navegador utilizará una URL `blob:` temporal y la revocará al cerrar el detalle.

Las fotos, sus rutas y sus nombres lógicos no se incluirán en Google Sheets, CSV, logs, errores ni URLs permanentes. Una futura exportación de gafetes será un flujo separado, mínimo y auditado.

## Privacidad y consentimiento

El uso operativo de la fotografía para identidad y gafete estará cubierto por el consentimiento de datos. La autorización para usar públicamente imagen, voz o contenido seguirá siendo un consentimiento separado; subir la foto no equivale por sí solo a autorizar su publicación.

La Política de Privacidad añadirá la fotografía entre los datos tratados y explicará las finalidades de identificación, gestión del programa y elaboración/entrega de gafete. El texto visible del checkbox y el texto que calcula el hash serán idénticos. Las versiones `privacyVersion` e `imageVersion` pasarán a `2026-09-15`; los consentimientos históricos no se reescribirán.

Los textos canónicos serán:

- **Cuenta:** “Confirmo que he leído la Política de Privacidad y autorizo el tratamiento de mi correo electrónico para crear y proteger mi cuenta de Vocero.”
- **Políticas:** “He leído y acepto las Políticas del Vocero y las Bases del Termómetro.”
- **Imagen pública:** “Autorizo por separado al responsable del programa a usar mi imagen, mi voz y el contenido que publique como vocero en sus canales oficiales y materiales de la feria, con mi crédito y sin pago adicional. Entiendo que la fotografía que subo para identificación y gafete no se publicará por ese solo hecho. He leído la Autorización de uso de imagen y contenido.”
- **Datos y foto operativa:** “Autorizo el tratamiento de mis datos personales, incluida la fotografía que subo, para verificar mi identidad, gestionar mi participación y, si corresponde, elaborar y entregar mi credencial o gafete. He leído la Política de Privacidad y conozco mis derechos de acceso, rectificación, eliminación, oposición y portabilidad.”

El plazo aprobado es de tres años desde el envío. La documentación no afirmará que existe eliminación automática mientras no se configure una ejecución programada. La revocación o eliminación autorizada deberá contemplar fila de base, archivo, exportaciones y política de respaldos.

## Respaldo y recuperación

El respaldo dejará de cubrir solo la base: incluirá también el árbol cifrado de fotografías y un manifiesto con cantidad, bytes y SHA-256 por archivo. La verificación de restauración cruzará cada fila de `vocero_photos` con un archivo existente y su hash. Un respaldo sin fotos verificadas se considerará incompleto.

El despliegue no continuará si faltan Fileinfo, GD con JPEG/PNG, soporte WebP prometido, espacio privado suficiente, permisos seguros o una prueba de restauración satisfactoria.

## Diseño visual

**Tesis visual:** una zona privada sobria y confiable que conserve el morado, el crema y el lenguaje gráfico de Finados sin convertir el formulario en una pieza publicitaria.

**Plan de contenido:** acceso breve; encabezado con identidad y estado; formulario por grupos claros; bloque dominante de fotografía; confirmación y siguiente paso.

**Interacción:** transición corta al cambiar entre crear cuenta e iniciar sesión; vista previa inmediata de la foto; estados de guardado y error visibles con soporte para movimiento reducido.

El panel del vocero será una superficie operativa sin mosaicos decorativos. En móvil, todos los controles tendrán al menos 44 píxeles y el estado, la foto y la acción principal aparecerán antes de los detalles secundarios.

## Errores y continuidad

- Un error de foto no elimina los campos escritos ni crea un registro parcial.
- Una repetición de la misma solicitud no crea dos cuentas, registros o archivos.
- Los archivos se preparan en un área temporal privada y se eliminan si falla la transacción.
- Una foto huérfana o una referencia sin archivo se detecta en la verificación operativa y en el respaldo.
- Los errores públicos no revelan SQL, rutas, nombres de archivo, existencia de correos ni configuración.
- Si falla la auditoría de una acción sensible, la acción no deja una sesión o enlace utilizable.

## Pruebas y criterios de aceptación

1. Un vocero puede crear cuenta, iniciar/cerrar sesión y enviar exactamente un registro con foto válida.
2. Un vocero no puede consultar ni modificar el registro o la foto de otro.
3. Una sesión de vocero no autoriza rutas administrativas y viceversa.
4. El servidor rechaza archivos grandes, MIME falso, imágenes corruptas, exceso de píxeles y formatos no disponibles.
5. La foto guardada está cifrada, no contiene metadatos originales y no es alcanzable por HTTP directo.
6. Un registro histórico sin cuenta o foto sigue visible para el administrador como `Sin fotografía histórica`.
7. Los consentimientos nuevos conservan la versión y el hash del texto exacto mostrado.
8. Un enlace de recuperación caduca, se usa una sola vez y al consumirlo invalida sesiones anteriores.
9. El panel administrativo muestra y descarga la foto solo después de autenticar y registra la auditoría.
10. CSV y Google Sheets no contienen el binario, la ruta privada ni una URL de la fotografía.
11. El respaldo y su prueba de restauración incluyen base, fotos y manifiesto.
12. Build, pruebas PHP, pruebas Node e integración HTTP terminan sin fallos y no modifican otras rutas del sitio.

## Publicación

La secuencia será: migraciones y backend compatibles; comprobación de salud y permisos; creación/verificación del administrador; frontend con cuentas y formulario autenticado; desactivación del alta anónima; prueba real controlada; verificación de respaldo. No se desplegará ninguna parte de este alcance sin autorización expresa posterior de Alex.
