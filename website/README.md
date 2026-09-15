# Sitio web y despliegue seguro

Este directorio contiene el frontend completo de `complejomushucruna.com`, incluidas `/finados/`, `/admin/` y `/admin/voceros/`. Node.js y Tailwind CSS 4 generan HTML, CSS y JavaScript estáticos. Los formularios usan PHP; Voceros se guarda en MySQL/MariaDB mediante PDO y sincroniza Google Sheets como destino secundario. La API administrativa vive exclusivamente en `finados.complejomushucruna.com/api/`. No se usa WordPress ni un framework de servidor.

## Qué se versiona y qué nunca se sube

Git conserva el código, las páginas, estilos, pruebas, activos autorizados, el constructor y este procedimiento. `dist/`, `node_modules/`, `website/.env.deploy` y cualquier llave SSH privada permanecen fuera de Git.

Nunca pegues una llave privada, contraseña, passphrase, token, usuario real o dirección del servidor en Git, en un chat, en una captura o dentro del frontend. El archivo `deploy.env.example` contiene únicamente nombres de campos y valores ficticios.

`/finados/` no aparece en el menú y lleva instrucciones `noindex`, pero cualquier persona que conozca la URL puede abrirla. Esto permite revisión discreta; no equivale a protección mediante contraseña.

## Preparar una computadora nueva

Necesitas Git, Node.js 22 LTS o posterior, npm, OpenSSH, tar y PHP 8.1+ con PDO, SQLite, OpenSSL y sesiones para las pruebas locales. Producción requiere `pdo_mysql`, MySQL/MariaDB y `mysqldump`. Trabaja en una única copia del repositorio.

```bash
git clone https://github.com/afnaranjo/complejomushucruna.git
cd complejomushucruna
git checkout main
git fetch origin
git pull --ff-only origin main
cd website
npm ci
npm run check
```

Si el repositorio ya existe en la computadora, no lo clones otra vez: abre esa carpeta y ejecuta desde la raíz `git fetch origin` y `git pull --ff-only origin main`.

## Instalar la llave SSH local

La llave privada debe trasladarse por un medio seguro aprobado, nunca mediante Git. En macOS o Linux, abre Terminal y sustituye `<ARCHIVO-RECIBIDO>` por el nombre real:

```bash
mkdir -p ~/.ssh
mv ~/Downloads/<ARCHIVO-RECIBIDO> ~/.ssh/id_rsa_complejo
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa_complejo
ssh-add ~/.ssh/id_rsa_complejo
```

Si la llave tiene passphrase, `ssh-add` la solicitará localmente y no mostrará lo escrito. No compartas esa passphrase. Si `ssh-add` indica que no existe un agente, inicia uno en esa sesión con `eval "$(ssh-agent -s)"` y repite `ssh-add`.

En Windows PowerShell con OpenSSH:

```powershell
New-Item -ItemType Directory -Force "$HOME\.ssh"
Move-Item "$HOME\Downloads\<ARCHIVO-RECIBIDO>" "$HOME\.ssh\id_rsa_complejo"
icacls "$HOME\.ssh\id_rsa_complejo" /inheritance:r
icacls "$HOME\.ssh\id_rsa_complejo" /grant:r "$($env:USERNAME):(R)"
ssh-add "$HOME\.ssh\id_rsa_complejo"
```

## Crear la configuración local

Desde `website/`:

```bash
cp deploy.env.example .env.deploy
```

Edita `.env.deploy` en esa computadora con los datos autorizados de cPanel. La ruta de destino debe ser exactamente `/home/<usuario>/public_html/complejomushucruna.com` y la ruta de la llave debe ser absoluta. Este archivo está ignorado por Git.

Primero valida únicamente el archivo local; este comando no se conecta al servidor:

```bash
npm run deploy:validate
```

Después ejecuta el prevuelo. Comprueba `main`, sincronización con GitHub, pruebas, construcción, llave y acceso de escritura al directorio remoto, sin modificar el sitio:

```bash
npm run deploy:check
```

## Publicar

Solo publica después de autorización expresa y desde `main` limpia, confirmada y sincronizada con `origin/main`:

```bash
npm run deploy
```

El comando vuelve a ejecutar todas las validaciones, crea una copia recuperable del sitio actual en `/home/<usuario>/backups/`, sube `website/dist/` mediante un flujo `tar → SSH` sin borrar archivos exclusivos del servidor y verifica por HTTPS la portada, `/finados/`, las hojas de estilo y la respuesta 404.

Para Voceros, despliega primero el backend como se indica abajo. El despliegue del frontend valida también ese backend y prepara `/api/voceros/index.php` con sus rutas de bootstrap y los helpers públicos incorporados, sin contraseña ni claves. Tras el respaldo, valida el PHP y exige que el GET real de la versión preparada confirme `open:true`; después reemplaza el endpoint mediante un único rename. La transferencia general excluye ese archivo: una interrupción no le retira las variables ni sustituye sus dependencias. Conserva los otros endpoints, la configuración privada de Sheets y el funcionamiento del dominio principal. Las rutas administrativas no se añaden a la navegación pública.

La restauración de una copia remota no está automatizada porque sobrescribe el sitio. Si se necesita rollback, identifica primero la copia exacta y obtén autorización antes de reemplazar archivos.

## Flujo diario de cambios

```bash
cd <RUTA-DE-TU-COPIA>/complejomushucruna
git checkout main
git fetch origin
git pull --ff-only origin main
cd website
npm ci
npm run check
```

Edita el código fuente, vuelve a ejecutar `npm run check`, confirma los archivos revisados, sube el commit a GitHub y publica únicamente con autorización. El despliegue se bloquea si la rama no es `main`, existen cambios sin commit o GitHub tiene diferencias.

## Texto listo para dar a Codex en otra computadora

> Trabaja únicamente en la copia existente del repositorio Complejo Mushuc Runa. Lee completos `AGENTS.md` y `vault/AGENTS.md` antes de actuar. Sincroniza `main` con `origin/main` mediante avance rápido y revisa `website/README.md`. No muestres, copies al chat ni subas a Git llaves privadas, passphrases, contraseñas, usuarios, servidores o el archivo `website/.env.deploy`. Verifica que la llave local tenga permisos seguros y que `.env.deploy` esté completo. Desde `website/`, ejecuta `npm ci`, `npm run check`, `npm run deploy:validate` y `npm run deploy:check`. Dime el resultado del prevuelo y no despliegues hasta que yo lo autorice expresamente. Cuando lo autorice, usa únicamente `npm run deploy` desde `main` limpia y sincronizada; no borres archivos remotos manualmente.

## Preparación privada de Voceros

Los ejemplos de esta sección son ficticios. Confirma primero en **cPanel → Domains** los dos docroots reales; no deduzcas el del subdominio a partir de su DNS. El backend y la configuración deben resolver fuera de ambos docroots, sin alias o symlinks en sus directorios base. `FINADOS_PUBLIC_ROOTS` es un array JSON de exactamente esas dos rutas. La validación bloquea rutas públicas, amplias, solapadas o con `..`.

Prepara por SSH los directorios privados con modo `0700`, y la configuración JSON con modo `0600`, mediante un editor seguro fuera de Git. Deben existir antes de `backend:check`:

- Aplicación: `/home/usuario_cpanel/apps/finados-api`.
- Configuración: `/home/usuario_cpanel/private-data/finados-backend.json`.
- Respaldo: `/home/usuario_cpanel/backups/finados-api`.
- Backend activo: `/home/usuario_cpanel/apps/finados-api/current`, creado por el despliegue. Este directorio contiene `src/`, `bin/`, `migrations/` y `public/`.

Usa UAPI de cPanel solo si está habilitada y autorizada. Si no está disponible, crea desde **MySQL Database Wizard** una base exclusiva y un usuario exclusivo asociado a ella. Para instalar el esquema se necesitan permisos de creación y lectura/escritura en esa base; no otorgues privilegios globales. Revisa con el hosting el usuario de ejecución PHP, acceso de cron y capacidad de restaurar en una base temporal.

La configuración privada acepta **exactamente** estas siete claves; reemplaza los marcadores en el editor privado, nunca en un comando, chat o archivo versionado:

```json
{
  "environment": "production",
  "databaseDsn": "mysql:host=localhost;dbname=usuario_cpanel_finados;charset=utf8mb4",
  "databaseUser": "usuario_cpanel_finados",
  "databasePassword": "REEMPLAZAR_EN_EDITOR_PRIVADO",
  "allowedOrigin": "https://complejomushucruna.com",
  "encryptionKey": "BASE64_DE_32_BYTES_ALEATORIOS",
  "hmacKey": "OTRA_BASE64_DE_32_BYTES_ALEATORIOS"
}
```

Genera las dos claves de forma independiente en el servidor o gestor de secretos y conserva una copia de recuperación bajo acceso controlado. No guardes el JSON ni sus valores en Git. El despliegue lee la configuración ya instalada; no la sustituye. `FINADOS_CONFIG_PATH`, `FINADOS_BACKEND_ROOT` y `FINADOS_PUBLIC_ROOTS` contienen solamente rutas y se instalan como variables de proceso mediante front controllers PHP gestionados. Este método funciona sin depender de `SetEnv` de Apache bajo PHP-FPM y deja intactos `.user.ini` y `php.ini`.

La carpeta de `FINADOS_CONFIG_PATH` es la única ubicación de la configuración del registro público: allí se instala `voceros-registration.json` y allí se busca el `google-sheets-config.json` ya existente. Si eliges otra carpeta privada aceptada, instala previamente la configuración de Sheets en esa misma carpeta por el medio seguro autorizado; el despliegue la conserva y no copia credenciales entre ubicaciones. El valor de ejemplo `private-data` no es una segunda ruta fija.

Registra previamente la huella SSH del servidor tras verificarla por un canal confiable. El backend exige una entrada conocida (`StrictHostKeyChecking=yes`) y una llave cargada en el agente; no solicita ni guarda passphrases.

## Prevuelo y publicación del backend

Desde `website/`:

```bash
npm run backend:validate
npm run backend:check
```

`backend:validate` comprueba solo la configuración local. `backend:check` es estrictamente de lectura: compara `HEAD` con `git ls-remote origin refs/heads/main` sin hacer fetch, exige `main` limpia, comprueba PHP 8.1+, PDO/`pdo_mysql`/OpenSSL/sesiones, rutas canónicas y permisos privados, lee el JSON y ejecuta exclusivamente `SELECT 1` en la base. No crea carpetas, sesiones, tablas, migraciones ni respaldos. Un backend todavía no instalado es válido si ya existen sus directorios privados y la base.

Después de autorización expresa y con `main` limpia y sincronizada:

```bash
npm run backend:deploy
```

El comando ejecuta `npm run check`, repite el prevuelo y sigue este orden:

1. Guarda backend y ambos docroots en un directorio privado exclusivo de la ejecución, con manifiesto SHA-256.
2. Ejecuta el respaldo de la base usando `mysqldump`, comprime y verifica tamaño/hash. Las credenciales viajan en un archivo privado temporal, nunca en los argumentos del proceso. Si falta `mysqldump`, usa Backup Wizard de cPanel para obtener y verificar un respaldo; el script automático permanece bloqueado hasta disponer del binario.
3. Transfiere únicamente `src/`, `bin/`, `migrations/` y `public/` a `releases/<versión>/`. No transfiere fixtures, datos, configuración ni capturas.
4. Valida cada PHP y aplica las migraciones `*_mysql.sql` pendientes en orden bajo bloqueo de base. Registra cada versión en `schema_migrations`; los `CREATE TABLE` pueden retomarse si un DDL quedó parcial. Las migraciones futuras deben conservar esa propiedad y evitar procedimientos o literales con separadores `;`. MySQL hace commits implícitos en DDL: una falla no implica rollback del esquema.
5. Cambia `current` después de esas validaciones. Conserva todas las releases. Si el hosting no admite symlinks, prepara una copia privada completa, conserva el directorio `current` anterior y renombra la copia preparada.
6. Instala solo el controlador gestionado y las reglas de `/api/` en el subdominio, preservando directivas ajenas de `.htaccess`. Se bloquea ante un `index.php` ajeno en esa ruta. Comprueba `GET /api/health` por HTTPS.

No se usa `--delete`, no se borran archivos exclusivos y no se toca el dominio `.ec`. Las copias de toda la base no deben considerarse cifradas: quedan comprimidas bajo permisos privados y requieren almacenamiento seguro y una política de retención. Una falla después de activar `current` exige revisar el estado y recuperar de forma explícita; no se restaura la base automáticamente ni se descartan registros nuevos.

## Administrador e importación

Ejecuta en una Terminal local real, con entrada y salida sin captura:

```bash
npm run backend:admin
```

SSH abre una TTY y PHP solicita dos veces la contraseña de `admin` con eco desactivado (mínimo 14 caracteres, máximo 72 bytes). No la pegues antes de que aparezca el aviso de entrada oculta. Node hereda la terminal directamente y no captura su contenido. No existen contraseñas predeterminadas ni opciones de contraseña por línea de comandos. Repite este mismo comando para rotarla.

Los CSV históricos deben permanecer en el directorio remoto privado. Sustituye solo sus rutas; nunca copies su contenido al repositorio:

```bash
npm run backend:import:check -- --voceros /home/usuario_cpanel/private-data/voceros.csv --consents /home/usuario_cpanel/private-data/consentimientos.csv
npm run backend:import -- --voceros /home/usuario_cpanel/private-data/voceros.csv --consents /home/usuario_cpanel/private-data/consentimientos.csv
```

El primer comando valida sin escribir. El segundo es la autorización explícita de importación: vuelve a ejecutar dry-run y solo continúa si pasa; el importador guarda copias privadas de los CSV y usa transacción e IDs para evitar duplicados. El CLI PHP informa conteos y líneas sin datos personales; el wrapper de despliegue mantiene la salida remota silenciada. Para conciliar conteos ejecuta el CLI PHP directamente en tu terminal privada con las mismas tres variables `FINADOS_*`. Conserva esos conteos en el acta interna, sin fichas personales. Repetir el importador debe dar cero inserciones nuevas.

Después de backend, administrador e importación, publica el frontend con `npm run deploy`. Verifica login, CORS, cookie, sesión, búsqueda, cambio de estado, notas, exportación y logout. Una respuesta anónima a datos debe ser `401`. Las verificaciones con escritura necesitan registros de prueba identificados y autorización.

## Recuperación y cierre

Antes de considerar el módulo terminado, valida los manifiestos SHA-256, descomprime una copia en almacenamiento privado y prueba la restauración de base en una base temporal de cPanel, nunca sobre producción. Conserva también el JSON privado y sus claves por un medio controlado: sin claves no se pueden descifrar los registros.

Para rollback identifica el respaldo y la release exactos. Con autorización, cambia `current` a la versión anterior (o devuelve el directorio `previous-<versión>` en el modo sin symlinks) y restaura únicamente los archivos públicos del módulo que lo necesiten desde el respaldo. No extraigas un tar completo sobre el sitio sin revisar su contenido. La reversión del código no revierte el esquema: verifica compatibilidad antes de activarla. Si hay que recuperar la base, primero respalda la actual y concilia registros creados después de la copia. No elimines releases ni respaldos como parte del rollback.

Registra commit, hora, versiones, pruebas, conteos, resultado de restauración y pendientes en la bitácora sin rutas operativas reales ni datos personales. La disponibilidad de PHP/MySQL, cron, docroots y recuperación en producción sigue pendiente hasta ejecutar el prevuelo autorizado.
