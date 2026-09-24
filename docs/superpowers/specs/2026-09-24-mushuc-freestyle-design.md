---
titulo: "Módulo Mushuc Freestyle 2026"
responsable: "por asignar"
estado: aprobado
ultima_actualizacion: 2026-09-24
fuente: interna
confidencialidad: interno
---

# Especificación de diseño — Mushuc Freestyle 2026

## 1. Resumen y decisión

Mushuc Freestyle será una nueva experiencia de la Feria de Finados 2026 con
landing pública, cuentas propias para participantes y revisión desde el mismo
panel administrativo que ya gestiona Voceros, Medios, Emprendedores y los
demás programas.

La administración será unificada en interfaz y sesión: aparecerá una nueva
opción **Mushuc Freestyle** en el sidebar actual. La información y las cuentas
de MFS estarán aisladas en tablas, endpoints y sesión propios para evitar que
un cambio de este programa afecte a Voceros u otros registros.

Esta especificación cubre el MVP de inscripción y preselección. No incluye
publicación automática de participantes, pagos, votación pública ni selección
automática por algoritmo.

## 2. Objetivo y criterios de éxito

### Objetivo

Permitir que una persona interesada en competir:

1. conozca la segunda edición de Mushuc Freestyle;
2. cree una cuenta propia;
3. complete sus datos, cargue una fotografía y envíe un enlace público de
   TikTok con su video de audición;
4. consulte que su registro fue recibido; y
5. sea revisada por coordinación desde el panel administrativo existente.

### Éxito verificable

- La opción `MFS` aparece dentro del submenú de Finados sin romper las rutas
  actuales.
- Un participante puede crear cuenta, iniciar sesión y guardar su ficha sin
  que sus datos aparezcan en Voceros, Medios o Emprendedores.
- La foto se almacena fuera del webroot y solo se entrega a la persona
  autenticada o a un administrador autorizado.
- El enlace de TikTok se valida como URL HTTPS permitida y queda inmutable
  después del envío de la audición, salvo una acción administrativa explícita.
- El administrador puede filtrar, abrir el detalle, ver foto y video, cambiar
  estado, añadir notas y archivar de forma reversible.
- Las migraciones SQLite y MySQL se ejecutan sin alterar ni borrar tablas
  existentes.
- La experiencia es usable en móvil, escritorio y en los dominios principal y
  espejo ya soportados.

## 3. Alcance funcional

### 3.1 Landing pública

Ruta: `/finados/mfs/`.

La página seguirá el sistema visual de Finados y contendrá:

- Hero: `II EDICIÓN`, `MUSHUC FREESTYLE 2026`, lunes 2 de noviembre, 13:00,
  Plaza de la Luna, Complejo Mushuc Runa — Tisaleo, Tungurahua.
- CTA principal: `INSCRÍBETE GRATIS`.
- CTA secundario: `VER LAS BASES`.
- Nota de cierre de inscripción: jueves 29 de octubre a las 23:59.
- Sección editorial `LA PLAZA VUELVE A LLENARSE`.
- Premios: USD 600, USD 250 y USD 100; total anunciado `MÁS DE USD 950 EN
  PREMIOS`.
- Reconocimiento especial al mejor MC de la zona centro.
- Bases resumidas, cupo de 32 participantes y requisitos de identificación.
- Formulario de inscripción y acceso a cuenta.
- Ubicación, estacionamiento e ingreso general de la feria.
- Bloque de auspiciantes con el contacto `+593 98 034 6729`.

El copy de premios deja claro que son personales e intransferibles, que se
entregan con cédula y acta firmada, y que el pago ocurre dentro de 15 días
hábiles. No se incorpora el escenario alternativo de premios hasta que exista
aprobación expresa de dirección.

### 3.2 Cuenta del participante

Rutas:

- `/finados/mfs/acceso/` — crear cuenta e iniciar sesión.
- `/finados/mfs/mi-registro/` — ficha privada y estado.
- `/finados/mfs/restablecer/` — restablecer contraseña.

La cuenta usa un namespace de sesión `mfs`, independiente de `vocero`,
`emprendedor`, `media` y `admin`. Se reutilizan las mismas garantías de
seguridad existentes: contraseñas Argon2id/bcrypt con prehash compatible,
limitación de intentos, CSRF, sesiones regeneradas y mensajes que no revelan
si un correo existe.

### 3.3 Ficha de inscripción

Campos mínimos confirmados para el MVP:

- nombres y apellidos;
- nombre artístico (opcional);
- teléfono o WhatsApp;
- correo electrónico de la cuenta;
- fotografía tipo retrato;
- enlace público de TikTok del video de audición;
- confirmación de que el video presenta al postulante y anuncia que la final
  será en Finados Mushuc Runa 2026;
- aceptación de bases, autorización de imagen y tratamiento de datos.

Los campos de cédula, fecha de nacimiento, ciudad/provincia y talla de
camiseta, incluidos en el brief inicial, quedan como **pendientes de
confirmación legal y operativa** antes de volverlos obligatorios. Si se
aprueban, se incorporarán cifrados y con acceso restringido, no como texto
plano en listados públicos.

Reglas:

- La foto se recibe como `multipart/form-data`, con tipo, dimensiones y peso
  limitados; se normaliza y se guarda mediante un almacenamiento privado.
- El enlace de audición debe ser HTTPS y pertenecer a TikTok. Se guarda una
  sola audición para el MVP, no cinco videos.
- Al enviar la audición, el enlace queda bloqueado para el participante. Si
  existe un error, solicita corrección a coordinación; no se permite sustituir
  silenciosamente el material enviado.
- El formulario muestra un resumen antes del envío y una confirmación con
  fecha/hora de recepción.
- El estado inicial es `Nuevo`.

### 3.4 Revisión administrativa

Ruta: `/admin/mushuc-freestyle/`.

Es una sección nueva dentro del panel existente y comparte el mismo login,
sidebar, encabezado, estilos de tabla, filtros y controles de sesión. No se
crea un segundo panel.

La vista incluye:

- contador de registros por estado;
- búsqueda por nombre, nombre artístico, correo o teléfono enmascarado;
- filtros por estado y fecha de registro;
- tabla con participante, ciudad (si se habilita), foto disponible, enlace de
  audición, fecha, estado y acción `Ver detalle`;
- detalle lateral o página de detalle con foto protegida, datos, enlace de
  TikTok, declaración del video, historial y notas internas;
- cambio de estado: `Nuevo`, `En revisión`, `Aprobado`, `Rechazado`,
  `Seleccionado`;
- notas con auditoría;
- archivo reversible (`Archivado`) en vez de borrado físico;
- acción de restablecer contraseña solo para coordinación autorizada.

La sección se coloca debajo de las secciones administrativas actuales según el
orden visual del sidebar, sin mover ni renombrar Voceros, Medios o
Emprendedores.

## 4. Arquitectura técnica

### 4.1 Frontend

Nuevos módulos propuestos:

- `website/src/finados/mfs-page.mjs` — renderer de la landing;
- `website/src/finados/mfs.css` — estilos scoped de la experiencia;
- `website/src/finados/mfs.js` — navegación de anclas, validación y estados del
  formulario;
- `website/src/finados/mfs-portal-page.mjs` y `mfs-portal.js` — acceso y ficha
  privada;
- `website/src/admin/admin-mfs.js` — cliente del panel MFS;
- extensión de `website/src/admin/page.mjs` para renderizar la nueva sección.

Se reutilizan el logo, la línea cromática, fuentes Anton/DM Serif/Inter,
componentes de navegación y patrones de accesibilidad de Finados. El hero es
de borde a borde; el texto se mantiene en HTML y no se incrusta en imágenes.

El póster de `post (1) a.rar` contiene un solo SVG grande. Se usará como
referencia de formas y color; si se incorpora un derivado, debe optimizarse
para web y conservarse la licencia/origen. No se copian logotipos ni piezas de
Red Bull Batalla de Gallos.

### 4.2 Backend

Se agregan módulos con prefijo `Mfs` y rutas `/api/mfs/...`, sin reutilizar
tablas de Voceros o Emprendedores:

- `MfsAuth` — registro, login, logout, sesión y recuperación;
- `MfsRepository` — listado y lectura de participantes;
- `MfsProfile` — validación y guardado de ficha;
- `MfsPhotoStorage` — cifrado/almacenamiento privado de fotos;
- `MfsPasswordReset` — tokens de recuperación;
- rutas administrativas para estados, notas, foto y archivo.

El router debe cargar manualmente las nuevas clases, incluir las rutas públicas
en su whitelist, aplicar el guard de administración a las rutas privadas y
mantener CORS/CSRF coherentes con los dominios principal y espejo.

### 4.3 Persistencia

Se añadirá una migración posterior a la última versión existente (la siguiente
versión disponible, no un número inventado al desplegar) para ambos motores:

- `mfs_accounts`: correo cifrado, índice HMAC, hash de contraseña, estado
  activo y timestamps;
- `mfs_profiles`: identidad y estado de revisión;
- `mfs_photos`: clave de almacenamiento, dimensiones, tipo y timestamps;
- `mfs_auditions`: URL TikTok, declaración, estado de envío y timestamps;
- `mfs_consents`: versión, hash, fecha y hash de IP;
- `mfs_login_attempts` y `mfs_password_resets`;
- `mfs_notes` y `mfs_review_events` para trazabilidad.

Correo, teléfono, cédula y demás PII se cifran siguiendo los patrones de
`Crypto`; los índices de búsqueda se almacenan como HMAC. Las fotos no viven
en `website/public`.

## 5. Seguridad, privacidad y operación

- No se publican listados de participantes ni fotos automáticamente.
- La foto y los datos completos requieren sesión de participante o guard de
  administración.
- Se mantienen límites de tamaño, MIME real, dimensiones, rate limiting,
  CSRF, validación de origen y auditoría.
- El enlace TikTok se trata como dato externo no confiable; se muestra con
  `rel="noopener noreferrer"` y se valida antes de guardarlo.
- El archivado es reversible y no se hace `DELETE` físico desde la UI.
- Se conserva consentimiento separado para bases, imagen y datos.
- No se ejecutan migraciones reales, creación de cuentas ni despliegues hasta
  completar pruebas y recibir autorización explícita.

## 6. Pruebas y despliegue

Antes de publicar:

1. pruebas unitarias PHP de auth, validación, estados y almacenamiento;
2. pruebas SQLite/MySQL de migraciones y rollback controlado;
3. pruebas Node del renderer, rutas, navegación y validación de formulario;
4. integración local de registro → login → foto → audición → revisión admin;
5. `npm run check`, `check-dist` y auditoría de archivos permitidos por el
   script de despliegue;
6. revisión visual responsive en dominio principal y espejo;
7. copia de seguridad y migración de producción solo después de autorización.

El despliegue seguirá los scripts existentes del repositorio. No se ejecutará
`npm`, `tsc` ni compilaciones en el servidor remoto y no se cambiarán datos
existentes.

## 7. Decisiones de la primera implementación

- El MVP recolectará únicamente los campos mínimos confirmados: nombres,
  nombre artístico opcional, teléfono, correo, fotografía, enlace de TikTok y
  consentimientos. Cédula, fecha de nacimiento, ciudad/provincia y talla no se
  guardarán todavía; podrán añadirse en una migración posterior con aprobación
  legal y operativa.
- Confirmar el texto legal final de bases, imagen y tratamiento de datos.
- Confirmar el límite de peso/formato de la foto y quién puede verla.
- Confirmar si `Aprobado` significa habilitado para selección o si habrá un
  estado intermedio adicional.
- Confirmar la fecha exacta de cierre y el cupo operativo de 32 participantes.
