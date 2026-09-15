---
titulo: "Diseño del panel y backend de Voceros"
responsable: "Alex Naranjo"
estado: aprobado
ultima_actualizacion: 2026-09-14
fuente: interna
confidencialidad: interno
---

# Diseño del panel y backend de Voceros

## Decisiones aprobadas en conversación

Alex aprobó el 2026-09-14 construir un panel sencillo y funcional para administrar los registros de la Comunidad de Voceros de Finados 2026. La separación acordada es:

- todo el frontend continúa en `complejomushucruna.com`, conservando sus rutas actuales;
- el login y panel se publican como frontend estático en `complejomushucruna.com/admin/`;
- las funciones privadas del panel se sirven desde `finados.complejomushucruna.com/api/`;
- el formulario público permanece en `complejomushucruna.com/finados/voceros/`;
- el primer usuario se llama `admin`;
- el acceso visible se denomina `Iniciar sesión`.

Alex ratificó después la ejecución y acotó expresamente el trabajo a este módulo: formulario de Voceros, acceso administrativo, panel y backend privado. Las demás páginas, contenidos y rutas no deben alterarse.

El código fuente y el procedimiento reproducible se versionan. Contraseñas, hashes operativos, llaves, cookies, credenciales de base de datos, claves de cifrado y configuración real permanecen fuera de Git y fuera del directorio público.

## Estado verificado

- La landing pública ya contiene un formulario propio y no redirige a Google.
- El formulario envía a `/api/voceros/`, donde un endpoint PHP valida la ficha y los consentimientos.
- Producción respondió HTTP 200 y confirmó que el registro está habilitado.
- Google Sheets es actualmente el destino operativo; existe además respaldo CSV privado y cola de reintentos.
- No existen todavía login, usuarios administrativos, sesiones, panel, roles ni base MySQL en el repositorio.
- `finados.complejomushucruna.com` resuelve por DNS y presenta certificado HTTPS, pero actualmente responde HTTP 403.
- PHP y Apache están verificados en producción. MySQL/MariaDB, `pdo_mysql`, cron y el mecanismo de copias administradas todavía deben confirmarse por SSH o cPanel antes de desplegar.

## Objetivo del MVP

Permitir que una persona administradora pueda iniciar sesión, consultar los registros de Voceros, buscarlos, filtrarlos, revisar su detalle, cambiar su estado, añadir notas internas y exportar un CSV, sin depender de abrir Google Sheets.

El MVP inicia con un único administrador. El modelo queda preparado para añadir usuarios y roles después, pero la gestión visual de usuarios no forma parte de esta primera entrega.

## Fuera de alcance inicial

- Autoservicio para crear cuentas administrativas.
- Recuperación de contraseña por correo.
- Inicio de sesión con Google, Microsoft o redes sociales.
- Aplicación móvil nativa.
- Mensajería masiva por WhatsApp o correo.
- Carga de archivos de autorización de menores.
- Eliminación física de registros o consentimientos.
- Panel CMS para editar las demás páginas institucionales.
- Analítica avanzada, atribución publicitaria o automatización del Termómetro.

## Arquitectura

### Frontend público y administrativo

El generador estático actual seguirá produciendo todas las páginas de `complejomushucruna.com`. Se añadirán:

- `/admin/`: pantalla principal con el título y botón `Iniciar sesión`;
- `/admin/voceros/`: tablero protegido;
- activos propios para login, sesión, tabla, filtros, detalle y estados.

`/admin/` será la página principal del módulo y mostrará el título y la acción `Iniciar sesión`. No se alterarán la portada, la navegación ni el contenido de las demás páginas. La ruta administrativa llevará `noindex, nofollow, noarchive`, pero la seguridad dependerá exclusivamente del backend y no de ocultar la URL.

### Backend privado

`finados.complejomushucruna.com/api/` servirá una API PHP JSON independiente del frontend. Solo aceptará el origen exacto `https://complejomushucruna.com`, usará credenciales de sesión y responderá a los preflight requeridos. No publicará listados ni datos sin una sesión válida.

El formulario público conservará su endpoint del dominio principal. Ese endpoint escribirá en la misma base MySQL y mantendrá Google Sheets como sincronización secundaria. Así, el registro público continúa siendo de mismo origen y el panel privado queda aislado en el subdominio.

### Base de datos

MySQL/MariaDB de cPanel será la fuente canónica, sujeta al prevuelo técnico. Se utilizará PDO con consultas preparadas y una cuenta de base con permisos mínimos sobre una sola base.

Tablas iniciales:

- `admin_users`: usuario, hash de contraseña, estado y marcas de tiempo;
- `voceros`: ficha, estado operativo, procedencia y seguimiento;
- `vocero_consents`: versión, hash, fecha y evidencia de cada consentimiento;
- `vocero_notes`: notas internas con autor y fecha;
- `audit_log`: inicios de sesión, consultas sensibles, cambios de estado, notas y exportaciones;
- `login_attempts`: intentos fallidos y ventana de bloqueo.

Cada entidad expuesta usará un identificador aleatorio no secuencial. No se reutilizará una cédula como identificador público.

## Flujo de datos

1. La persona completa el formulario público.
2. El endpoint del dominio principal valida campos, edad, representante, origen, consentimiento y duplicados.
3. El registro y sus consentimientos se guardan en una transacción MySQL.
4. Después de confirmar la transacción, se intenta sincronizar con Google Sheets.
5. Si Sheets falla, el registro permanece válido en MySQL y entra en una cola privada de reintentos.
6. El panel obtiene listados y detalles desde la API privada del subdominio.
7. Cada cambio administrativo genera una entrada de auditoría.

Los CSV privados existentes se importarán una sola vez mediante un comando idempotente por SSH, usando el ID de registro para evitar duplicados. Antes de importar se hará una copia recuperable de los archivos fuente.

## Autenticación y sesión

- Usuario inicial: `admin`.
- No existirá una contraseña predeterminada.
- La contraseña se establecerá mediante un comando interactivo por SSH que no la imprime ni la registra en el historial.
- Se almacenará únicamente con `password_hash`, usando Argon2id si el PHP remoto lo admite y bcrypt como alternativa.
- La sesión residirá en servidor; la cookie será `HttpOnly`, `Secure`, host-only para el subdominio y `SameSite=Strict`.
- El identificador de sesión rotará al iniciar sesión y al elevar privilegios.
- La sesión expirará por inactividad y tendrá un límite absoluto.
- Login, cierre de sesión y mutaciones usarán protección CSRF.
- Los intentos fallidos tendrán límite progresivo sin revelar si el usuario existe.

La creación o reactivación de otros administradores seguirá siendo una operación explícita por SSH durante el MVP.

## API inicial

- `POST /api/auth/login`: inicia sesión.
- `POST /api/auth/logout`: cierra y destruye la sesión.
- `GET /api/auth/session`: devuelve estado de sesión y token CSRF, nunca el hash.
- `GET /api/voceros`: listado paginado, búsqueda y filtros.
- `GET /api/voceros/{id}`: detalle autorizado.
- `PATCH /api/voceros/{id}`: cambia estado operativo.
- `POST /api/voceros/{id}/notes`: añade una nota interna.
- `POST /api/voceros/export`: genera CSV protegido y registra la exportación.
- `GET /api/dashboard`: totales por estado y fecha.
- `GET /api/health`: comprobación técnica sin datos ni secretos.

Todas las respuestas de error serán JSON consistente. Los errores internos se registrarán en servidor sin devolver rutas, consultas, credenciales o trazas al navegador.

## Panel administrativo

### Login

La pantalla usa la línea institucional del Complejo con referencias visuales moderadas a Finados. Contiene usuario, contraseña, mostrar/ocultar contraseña, estado accesible, recuperación operativa por contacto interno y el botón principal `Iniciar sesión`.

### Tablero

- Total de registros.
- Registros nuevos.
- Pendientes de autorización de representante.
- Aprobados y rechazados.
- Registros de los últimos siete días.

### Listado y detalle

- Búsqueda por nombre, ID de registro, correo, teléfono o cédula.
- Filtros por estado, fecha, ciudad, red principal y participación anterior.
- Paginación en servidor.
- Cédula y teléfono enmascarados en el listado.
- Ficha completa únicamente dentro del detalle autenticado.
- Estados: `Nuevo`, `En revisión`, `Aprobado`, `Rechazado` y `Pendiente de autorización`.
- Notas internas cronológicas.
- Exportación CSV protegida y auditada.
- No habrá botón de borrado físico.

## Protección de datos

- Claves y configuración en una carpeta privada fuera de ambos docroots, con permisos `0700/0600`.
- Cédula, teléfonos, correo y datos del representante cifrados por campo; los índices de búsqueda exacta usarán HMAC con una clave distinta.
- Consultas preparadas, validación por lista permitida y límites estrictos de entrada.
- CORS limitado al origen institucional y sin comodines.
- CSP y encabezados de seguridad en frontend y API.
- Ningún token de sesión se guarda en `localStorage` o `sessionStorage`.
- Registro de auditoría sin contraseñas ni valores sensibles completos.
- La política operativa conservará tres años únicamente si esa retención continúa aprobada; el sistema permitirá anonimización controlada cuando corresponda atender derechos.
- Las copias de base quedarán fuera del docroot y requerirán una prueba de restauración antes de considerar el sistema terminado.

## Despliegue

1. Confirmar por SSH versión de PHP, `pdo_mysql`, MySQL/MariaDB, cron, docroot real del subdominio y estrategia de backup.
2. Crear base, usuario de mínimo privilegio y configuración privada. Si el hosting no permite hacerlo por SSH/UAPI, esta será la única operación requerida desde cPanel.
3. Ejecutar migraciones SQL idempotentes.
4. Crear `admin` mediante el comando interactivo de SSH.
5. Importar los CSV privados existentes de forma idempotente.
6. Construir y probar frontend y backend localmente.
7. Crear respaldo recuperable de ambos docroots y de la base.
8. Desplegar primero API privada y luego frontend.
9. Verificar HTTPS, CORS, login, sesión, filtros, actualización, exportación, cierre de sesión y ausencia de datos sin autenticar.

No se borrarán archivos remotos, no se usarán sincronizaciones con `--delete` y no se tocará el WordPress `.ec`.

## Pruebas y aceptación

- La suite actual continúa aprobada.
- El build genera `/admin/` y `/admin/voceros/` con `noindex`.
- Una solicitud anónima a cualquier endpoint de datos recibe `401`.
- Un origen no permitido no obtiene credenciales ni datos.
- Login correcto crea sesión; credenciales inválidas no revelan información y activan límite de intentos.
- El formulario público crea exactamente un registro y tres consentimientos en una transacción.
- Repetir el mismo ID de envío no crea duplicados.
- Listado, búsqueda, filtros y paginación devuelven resultados consistentes.
- Cambios de estado, notas y exportaciones quedan auditados.
- Las columnas sensibles aparecen enmascaradas en listados.
- Cierre de sesión invalida la sesión anterior.
- La migración puede ejecutarse dos veces sin duplicar datos.
- El panel funciona en escritorio y móvil, por teclado y sin desbordamiento horizontal.
- Ninguna respuesta, HTML, JavaScript, log de prueba o commit contiene secretos.
- Existe una copia recuperable y la restauración se prueba antes del cierre.

## Riesgos y decisiones pendientes antes del despliegue

- Confirmar MySQL/MariaDB, `pdo_mysql`, cron y backups en el hosting.
- Confirmar el docroot real de `finados.complejomushucruna.com`.
- Revisar con el responsable interno que la retención de tres años y los textos de privacidad continúan vigentes.
- La contraseña inicial debe ser elegida por Alex en un prompt seguro; no puede entregarse por chat.
- El acceso se realizará directamente por `/admin/`; no se añadirá a la cabecera pública para respetar el alcance limitado solicitado.
