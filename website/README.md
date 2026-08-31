# Sitio web y despliegue seguro

Este directorio contiene el código fuente de `complejomushucruna.com`, incluida la landing privada por enlace `/finados/`. Es un sitio estático generado con Node.js y Tailwind CSS 4; no usa WordPress, PHP, base de datos ni un framework con servidor.

## Qué se versiona y qué nunca se sube

Git conserva el código, las páginas, estilos, pruebas, activos autorizados, el constructor y este procedimiento. `dist/`, `node_modules/`, `website/.env.deploy` y cualquier llave SSH privada permanecen fuera de Git.

Nunca pegues una llave privada, contraseña, passphrase, token, usuario real o dirección del servidor en Git, en un chat, en una captura o dentro del frontend. El archivo `deploy.env.example` contiene únicamente nombres de campos y valores ficticios.

`/finados/` no aparece en el menú y lleva instrucciones `noindex`, pero cualquier persona que conozca la URL puede abrirla. Esto permite revisión discreta; no equivale a protección mediante contraseña.

## Preparar una computadora nueva

Necesitas Git, Node.js 22 LTS o posterior, npm y OpenSSH. Trabaja en una única copia del repositorio.

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

El comando vuelve a ejecutar todas las validaciones, crea una copia recuperable del sitio actual en `/home/<usuario>/backups/`, sube `website/dist/` por SSH/SCP sin borrar archivos exclusivos del servidor y verifica por HTTPS la portada, `/finados/`, las hojas de estilo y la respuesta 404.

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
