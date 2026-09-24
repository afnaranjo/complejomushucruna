---
titulo: "Nombres en pantalla · experiencia QR Finados 2026"
responsable: "por asignar"
estado: borrador
ultima_actualizacion: 2026-09-24
fuente: interna
confidencialidad: interno
---

# Nombres en pantalla · experiencia QR Finados 2026

## Objetivo

Crear una experiencia pública, independiente del flujo de Voceros, para que una
persona escanee un código QR, escriba su nombre y lo vea aparecer en una
pantalla de Finados 2026. La pantalla debe sentirse como una instalación
escénica: fondo lila oscuro, grano y niebla luminosa, tipografía serif y una
animación breve que mantenga la lectura incluso cuando llegan varias personas a
la vez.

La experiencia no modifica formularios, cuentas, datos ni rutas existentes de
Voceros, Medios, Creadoras, Emprendedores o Administración.

Relacionado con [[11_eventos/2026_feria-finados/README]] y
[[11_eventos/2026_feria-finados/10_tecnologia-datos/README]].

## Alcance aprobado

- Nueva landing de captura: `/finados/nombre/`.
- Nueva landing de pantalla: `/finados/pantalla/`.
- El QR de la landing de captura apunta a su propia URL absoluta y se genera
  con el generador QR ya presente en el proyecto.
- La persona envía únicamente el nombre que desea mostrar y un consentimiento
  explícito para su publicación.
- El backend conserva una cola corta y temporal de nombres; no crea cuentas ni
  pide correo, cédula, teléfono o red social.
- La pantalla consulta novedades automáticamente sin recargar.
- Se muestran como máximo siete nombres en una misma escena. El nombre
  principal se elige al azar entre los pendientes; los otros aparecen detrás
  en posiciones, escalas y opacidades distintas, sin solaparse de forma que
  impida leerlos.
- Los nombres que excedan los siete visibles esperan en cola y se incorporan
  de forma progresiva. Los registros caducan automáticamente después de 24
  horas para no convertir la cola en un archivo permanente.

## Experiencia y rutas

### Captura: `/finados/nombre/`

1. Presenta el motivo de participación y el QR grande para compartir la
   dinámica.
2. Incluye el campo “¿Cómo quieres que aparezca tu nombre?” con límite de 60
   caracteres, espacios recortados y normalización Unicode sin alterar tildes.
3. Incluye la casilla obligatoria: “Acepto que mi nombre aparezca
   públicamente en la pantalla de Finados.”
4. Al guardar, muestra confirmación breve y no expone el identificador interno
   ni datos de otras personas.
5. Si el mismo navegador envía repetidamente el mismo nombre en pocos segundos,
   muestra una confirmación idempotente en lugar de crear duplicados
   consecutivos.

### Pantalla: `/finados/pantalla/`

1. Oculta navegación y controles de administración; está pensada para
   proyección a pantalla completa.
2. Mantiene una leyenda discreta de contexto (“Finados Mushuc Runa 2026”) y
   una indicación mínima de que el nombre se comparte con consentimiento.
3. Consulta la cola cada dos segundos y conserva una memoria local de
   identificadores ya presentados durante la sesión.
4. Cuando llega una tanda, selecciona al azar un nombre como protagonista y
   distribuye hasta seis nombres secundarios en una constelación con posiciones
   predefinidas y no repetidas.

## Movimiento y composición

- Cada nombre protagonista entra con `fade-in` y desplazamiento sutil durante
  1 segundo.
- Permanece plenamente legible durante 2 segundos.
- Desde el segundo 3 sale con `fade-out`, desenfoque progresivo y un leve
  `motion-blur` simulado con `filter: blur()` y desplazamiento; no se usan
  dependencias de animación externas.
- Los nombres secundarios tienen menor escala, opacidad y contraste, con
  transiciones escalonadas para que la escena no parezca una lista.
- La composición se recalcula al cambiar de tamaño; en móvil usa menos capas y
  reduce el movimiento con `prefers-reduced-motion`.
- El fondo combina gradientes lila, ruido/grano mediante CSS y manchas de niebla
  con `radial-gradient`, sin descargar imágenes externas.
- Se limita la tipografía a una serif display para nombres y una sans auxiliar
  para instrucciones, siguiendo el criterio visual existente de Finados.

## Contrato de datos propuesto

### Tabla `finados_name_queue`

Migración aditiva para SQLite y MariaDB:

- `id` entero autoincremental.
- `public_id` aleatorio, no secuencial y no reutilizable.
- `display_name` texto ya normalizado.
- `consent_given` booleano/entero, siempre verdadero para insertar.
- `created_at` UTC.
- `expires_at` UTC, 24 horas después de `created_at`.

Índices:

- único sobre `public_id`;
- compuesto sobre `expires_at, id` para limpiar/leer la cola.

No se guardan IP, user-agent, correo ni otros identificadores personales.

### API pública

- `POST /api/finados/nombres`
  - Acepta `{ "name": "...", "consent": true }`.
  - Devuelve `201` con `{ "id": "...", "queued": true }`.
  - Devuelve `422` para nombre vacío, demasiado largo o consentimiento
    ausente.
  - Devuelve `429` ante exceso de envíos desde el mismo origen temporal.
- `GET /api/finados/nombres/cola?limit=20`
  - Devuelve únicamente `public_id`, `display_name` y `created_at` vigentes.
  - El servidor elimina/ignora registros vencidos durante la lectura.
  - No devuelve datos administrativos ni permite ordenar por información
    sensible.

Las rutas reutilizan la validación de origen permitida para Finados y sus dos
dominios espejo. No requieren sesión de usuario. El endpoint de escritura
acepta solo JSON, limita el tamaño del cuerpo y aplica el mismo encabezado
`Vary: Origin` que el resto del backend.

## Seguridad, abuso y privacidad

- Sanitizar texto al responder y renderizar; nunca insertar HTML enviado por la
  persona.
- Aplicar longitud máxima, límite de frecuencia por origen y un límite global
  conservador para evitar que la pantalla se llene de envíos automatizados.
- No mostrar mensajes de error que revelen consultas SQL, rutas del servidor o
  credenciales.
- No almacenar datos que no son necesarios para mostrar el nombre.
- Mantener las páginas fuera del menú principal hasta recibir autorización
  específica para enlazarlas; podrán abrirse por URL directa durante la prueba.

## Accesibilidad y responsive

- Campo, casilla y botón con etiquetas visibles y foco de teclado.
- Contraste AA para instrucciones y nombre protagonista.
- `aria-live="polite"` en la confirmación de captura, no en toda la pantalla de
  proyección para evitar que un lector de pantalla repita cada nombre.
- Respeto a `prefers-reduced-motion`: transiciones cortas, sin desenfoque
  intenso y una sola composición estática por ciclo.
- La captura funciona desde móvil en vertical; la pantalla se adapta a
  16:9, 4:3 y ventanas estrechas sin desbordamiento horizontal.

## Pruebas y verificación

- Pruebas unitarias de normalización, longitud, consentimiento, idempotencia y
  selección aleatoria sin repetir posiciones.
- Pruebas de backend para migración SQLite, inserción válida, validaciones,
  caducidad, límite de frecuencia, CORS y escape de contenido.
- Prueba de build que confirme las dos rutas, QR generado y ausencia de
  enlaces en el menú.
- Revisión visual local en escritorio y móvil, incluyendo `prefers-reduced-motion`.
- Verificación de que no cambian hashes ni respuestas de rutas de Voceros,
  Administración y páginas existentes.

## Despliegue y reversibilidad

- El cambio requiere frontend y backend, además de una migración aditiva.
- Antes de desplegar: `npm run check`, respaldo del backend y comprobación de
  migración en una base de prueba.
- No se toca la base de datos de Voceros ni se ejecutan borrados.
- La reversión consiste en retirar las dos rutas, los assets del componente y
  la migración nueva; los registros de la cola pueden caducar sin afectar otros
  módulos.
- Esta especificación no autoriza publicación en producción; la autorización
  se solicitará después de la revisión y las pruebas.

## Decisiones pendientes

- Confirmar el texto final de la leyenda de consentimiento.
- Confirmar si el equipo quiere una URL corta impresa para el QR además de la
  URL canónica.

