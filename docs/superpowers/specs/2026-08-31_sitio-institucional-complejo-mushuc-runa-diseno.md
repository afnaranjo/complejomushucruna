---
titulo: "Diseño del sitio institucional Complejo Mushuc Runa"
responsable: "Alex Naranjo"
estado: aprobado
ultima_actualizacion: 2026-08-31
fuente: "interna y auditoría de solo lectura de complejomushucruna.ec"
confidencialidad: interno
---

# Diseño del sitio institucional Complejo Mushuc Runa

## Decisión aprobada

Construir y publicar en `complejomushucruna.com` un sitio institucional permanente, profesional y completamente independiente de WordPress. La renovación preserva la identidad, los textos recuperables, las fotografías y el archivo histórico del WordPress antiguo, pero reorganiza la experiencia para que sea clara, rápida, accesible y mantenible.

Alex aprobó el 2026-08-31 la alternativa de renovación profesional, la conservación de la paleta y tipografías existentes y el despliegue por SSH/HTTP. El archivo temporal `Hola mundo` puede ser reemplazado durante el despliegue.

Ese mismo día se aclaró la fuente cronológica: se debe adaptar la última portada institucional activa en 2026, aunque reutilice fotografías de años anteriores. La fecha del archivo visual no define la vigencia de la composición. El archivo 2021–2025 permanece como memoria secundaria y no sustituye la portada institucional más reciente.

## Objetivos

- Presentar el Complejo Intercultural y Deportivo Mushuc Runa como destino institucional permanente.
- Conservar el contenido histórico recuperable sin mostrar datos vencidos como si fueran actuales.
- Mantener la identidad visual digital del sitio anterior con una aplicación más consistente.
- Servir páginas estáticas rápidas, responsivas y seguras, sin PHP, base de datos, WordPress, plugins o panel de administración.
- Mantener un archivo navegable de eventos publicados entre 2021 y 2025.
- Facilitar que una visita encuentre experiencias, historia, ubicación, rutas y canales oficiales.

## Fuera de alcance

- No reparar ni limpiar el WordPress de `complejomushucruna.ec`.
- No copiar temas, plugins, PHP, JavaScript de plugins, configuraciones, usuarios, credenciales o base de datos.
- No publicar precios, horarios, capacidades, disponibilidad, teléfonos o servicios como vigentes sin validación.
- No publicar información de Finados 2026 que permanezca bajo control o embargo.
- No incorporar reservas, pagos, cuentas de usuario, formularios con backend o panel CMS en esta versión.

## Evidencia recuperada

La auditoría de solo lectura confirmó:

- WordPress 7.1 con Elementor y tema Neve.
- páginas institucionales: Inicio, Historia, Atractivos, Reservas, Contacto, Granja Agroturística, Eventos y Ubícanos;
- archivo publicado: Festival de Canto, Toros, Finados 2021, Finados 2022, Finados 2023, Finados 2025 y Navidad 2025;
- cabecera y pie globales de Elementor;
- dos menús principales y un enlace de tour virtual;
- 598 MB en `wp-content/uploads`, 4.405 archivos físicos, 688 adjuntos de imagen, 11 videos y 9 fuentes registradas;
- redirección HTTP actual desde `.ec` hacia dominios externos no relacionados, aunque su `.htaccess` conserva reglas WordPress normales.
- portada `Inicio` ID 6 modificada el 2026-03-10, con revisiones 3002–3004;
- tres capturas públicas de Internet Archive del 2026-01-21, 2026-02-11 y 2026-03-14 que muestran la misma estructura institucional, con infraestructura y contenido de 2025 sobre una base fotográfica histórica;
- ausencia de una página, borrador, campaña o carpeta de medios propia del Complejo titulada 2026 dentro de ese WordPress.

La redirección confirma que el sitio nuevo debe consumir únicamente datos y medios inspeccionados por SSH, nunca el runtime antiguo.

## Arquitectura de información

### Navegación principal

1. Inicio — `/`
2. Experiencias — `/experiencias/`
3. Granja — `/granja/`
4. Eventos — `/eventos/`
5. Historia — `/historia/`
6. Visítanos — `/visitanos/`

Acciones destacadas:

- `Planifica tu visita` lleva a `/visitanos/`.
- `Tour virtual` abre el enlace histórico externo en una pestaña nueva y lo identifica como servicio externo.

### Archivo histórico

`/eventos/` reúne los eventos históricos con tarjetas cronológicas. Cada evento recuperado tiene una página propia bajo `/eventos/archivo/<slug>/`. Las páginas históricas conservan nombres, textos, imágenes y enlaces publicados, con una señal visible de `Archivo histórico` y el año correspondiente.

### Pie

Incluye logotipo, descripción institucional, navegación, redes sociales recuperadas, enlace a Mushuc Runa Sporting y una nota de que horarios, precios y disponibilidad deben consultarse en canales oficiales.

## Preservación del contenido

- Se crea un inventario normalizado de todos los textos visibles de las páginas publicadas y de sus enlaces.
- Ningún texto se descarta silenciosamente. Cada bloque queda marcado como `institucional`, `histórico` o `por confirmar`.
- El sitio público usa el texto institucional vigente y ofrece el resto dentro del archivo histórico o del inventario de migración.
- Las páginas vacías de WordPress —Atractivos, Reservas y Contacto— se reconstruyen con navegación y mensajes honestos, sin inventar oferta.
- Las afirmaciones temporales, precios y teléfonos permanecen fuera del contenido vigente hasta confirmación expresa.
- Las variantes automáticas de WordPress no se consideran contenido independiente; se conserva el original útil y se generan tamaños web optimizados.

## Sistema visual

### Paleta digital recuperada

| Token | Valor | Uso |
|---|---:|---|
| `--color-rojo-profundo` | `#7C170F` | navegación, fondos institucionales |
| `--color-rojo-mushuc` | `#AD140E` | llamadas a la acción y acentos |
| `--color-rojo-oscuro` | `#5B0B05` | contraste y pie |
| `--color-dorado` | `#9E7721` | detalles de identidad |
| `--color-dorado-claro` | `#E3B85D` | líneas, iconos y estados activos |
| `--color-blanco` | `#FFFFFF` | superficies y texto invertido |
| `--color-texto` | `#2E2927` | texto principal accesible |
| `--color-texto-suave` | `#7A7A7A` | metadatos y texto secundario |
| `--color-morado-profundo` | `#6E2845` | archivo cultural e histórico |
| `--color-morado-claro` | `#A388BE` | fondos secundarios del archivo |

El WordPress no contiene códigos Pantone oficiales. La implementación conserva los valores HEX/RGB exactos encontrados y no inventa equivalencias Pantone. La futura incorporación de Pantone requiere un manual autorizado.

### Tipografía

- Navegación: Montserrat Medium, registrada en el WordPress como `Monserrate`.
- Cuerpo: Roboto 400 y 600.
- Títulos editoriales: Roboto Slab 400/600.
- Acento expresivo: Handgoal, usado con moderación y nunca para párrafos.
- Archivo histórico: conserva el carácter de Paytone One, Archivo y Rubik donde aporta reconocimiento.
- Berlin Sans y Trajan solo se publican si el uso de los archivos existentes queda validado; de lo contrario se conserva la jerarquía con una alternativa métrica segura, sin falsificar una licencia.

### Dirección de arte

- Portada de imagen real y panorámica del complejo, con titular legible y dos acciones.
- Uso de fotografías históricas auténticas, no imágenes generadas.
- Secciones amplias, composición editorial y ritmo vertical; evitar cuadrículas densas de tarjetas.
- Motivos circulares y patrones presentes en el logotipo como detalles de fondo, sin competir con el contenido.
- Cabecera clara al inicio y sólida al desplazarse; menú móvil accesible.
- Movimiento discreto, respetando `prefers-reduced-motion`.

## Contenido por página

### Inicio

Portada panorámica, promesa histórica `¡Cultura y diversión en un solo lugar!`, bloque de actualidad institucional, presentación, experiencias principales, historia breve, eventos/archivo, llamada a planificar visita y cierre fotográfico.

El bloque de actualidad recupera de la portada más reciente `Más de 10 mil parqueaderos`, `El Megaescenario` y `Responsabilidad social`, con sus tres fotografías de 2025. La cifra de parqueaderos se atribuye a esa comunicación institucional y queda pendiente de conciliación operativa en el expediente de Finados 2026.

### Experiencias

Reorganiza el contenido recuperado de piscina, cabalgatas, granja, tren, pesca y Mushuc Park. Cada experiencia se presenta como parte del legado del sitio y queda marcada `por confirmar` cuando su disponibilidad actual no está validada.

### Granja

Conserva la introducción y las categorías recuperadas: aves, conejos, cuyes, ganado vacuno, mulas y burros, caballos y ponis, ovinos y porcinos. Prioriza bienestar, aprendizaje y fotografías reales; no promete interacción o disponibilidad actual sin confirmación.

### Eventos

Presenta el Complejo como espacio de encuentro y enlaza el archivo cronológico. Los eventos vencidos nunca usan llamados de compra, inscripción o cuenta regresiva activos.

### Historia

Conserva el título y el texto institucional recuperado sobre qué es el Complejo, acompañado por fotografías aéreas y del entorno.

### Visítanos

Conserva las dos rutas y enlaces de Google Maps de la página `Ubícanos`, presenta indicaciones y un bloque de contacto. Los teléfonos recuperados se mantienen en el inventario, pero no se publican como actuales hasta validación.

## Arquitectura técnica

- Fuente en `website/` dentro del repositorio.
- Generador estático propio con Node.js y módulos ES, sin dependencias de producción.
- Datos normalizados en módulos separados de las plantillas.
- Salida en `website/dist/` con HTML semántico, CSS y JavaScript progresivo.
- JavaScript limitado al menú móvil, revelado discreto y mejora de navegación; el contenido funciona sin JavaScript.
- Medios propios en `website/public/assets/`, seleccionados desde el WordPress por SSH, inspeccionados y optimizados.
- Ningún recurso publicado depende de `complejomushucruna.ec`.

## Seguridad de migración

- Lista blanca de extensiones: `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.mp4`, `.woff2` y `.ttf` para la tipografía Handgoal ya publicada en el sitio anterior.
- Ningún `.php`, `.phtml`, `.js`, `.html`, `.htaccess`, plugin, tema, archivo de configuración o volcado SQL cruza al sitio nuevo.
- Los SVG se inspeccionan y se evitan cuando contengan scripts, referencias externas o elementos activos.
- Se verifican MIME, tamaño y extensión de cada activo incorporado.
- Se reescriben URLs internas hacia rutas locales.
- Los enlaces externos usan `rel="noopener noreferrer"`.

## Accesibilidad, SEO y rendimiento

- HTML semántico, enlace de salto, regiones `header`, `nav`, `main` y `footer`.
- Un solo `h1` por página y jerarquía de encabezados válida.
- Contraste mínimo WCAG AA para texto normal.
- Navegación completa por teclado, foco visible y menú móvil con `aria-expanded`.
- Imágenes con dimensiones, texto alternativo, `loading="lazy"` fuera de portada y formatos optimizados.
- Metadatos únicos, canonical en `.com`, Open Graph, `sitemap.xml`, `robots.txt` y página 404.
- Objetivo orientativo: HTML inicial menor a 80 KB, CSS menor a 100 KB, JavaScript menor a 30 KB y ninguna dependencia de runtime.

## Pruebas y criterios de aceptación

- El generador crea todas las rutas definidas.
- No existen enlaces internos rotos.
- Ningún HTML/CSS/JS publicado referencia WordPress, `.ec`, PHP o rutas `wp-content`.
- Todos los archivos locales enlazados existen en `dist/`.
- Cada página tiene título, descripción, canonical, `h1` y navegación.
- El sitio responde `200` por HTTPS en las rutas principales y `404` para una ruta inexistente.
- La página principal conserva el mensaje histórico y la identidad aprobada.
- El archivo histórico no presenta acciones vencidas como vigentes.

## Despliegue y recuperación

- Crear una copia fechada del `index.html` temporal y un inventario de archivos existentes antes de subir.
- Construir localmente y transferir únicamente la salida estática por SSH/SCP.
- Conservar sin cambios las directivas generadas por cPanel en `.htaccess` y añadir solamente el aislamiento del sitio estático, `DirectoryIndex`, bloqueo de listados y documento 404. No modificar `.user.ini`, `php.ini`, `.well-known` ni `cgi-bin`.
- No usar borrado remoto ni sincronización con `--delete`.
- Verificar por HTTPS y HTTP con `curl` después de subir.
- Si falla una comprobación crítica, restaurar el `index.html` temporal desde la copia fechada.
