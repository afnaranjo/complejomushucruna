---
titulo: "Guía móvil informativa sin backend Finados 2026"
responsable: "tecnología y experiencia"
estado: borrador
ultima_actualizacion: 2026-08-27
fuente: "solicitud de Alex Naranjo, evidencia histórica y referencias oficiales"
confidencialidad: interno
tags:
  - feria-finados-2026
  - guia-movil
  - mapa
  - pwa
---

# Guía móvil informativa sin backend

## Decisión de producto

Construir una **guía móvil del Complejo Mushuc Runa**, inspirada en la función de orientación de las aplicaciones de parques temáticos, pero limitada al problema real de Finados 2026:

> “Estoy dentro de un complejo gigante. Quiero saber dónde estoy, qué hay cerca y cómo llegar.”

Será una **web-app instalable (PWA) estática**, accesible por enlace y QR, sin backend, cuentas, registro, pagos, CRM, venta de entradas ni recopilación propia de datos personales.

La referencia no se copia visual ni comercialmente. Se adapta el patrón de mapas, direcciones y servicios: los términos oficiales de My Disney Experience describen mapas del resort y direcciones cuando el visitante permite ubicación; Xcaret presenta mapa, búsqueda, restaurantes, actividades y favoritos. Consulta: 2026-08-24. Fuentes: [Walt Disney World](https://disneyworld.disney.go.com/en_CA/park-experience-terms-conditions/) y [Xcaret App](https://www.xcaret.com/en/xcaret-app/).

## Por qué PWA y no app de tienda

Una PWA puede abrirse directamente desde el navegador, instalarse opcionalmente y funcionar desde una sola base de código. El navegador sigue siendo la puerta de entrada si el dispositivo no permite instalación. Esto reduce la fricción de pedir una descarga para un evento temporal y permite cachear el mapa y la agenda. Fuentes oficiales consultadas el 2026-08-24: [web.dev: qué son las PWA](https://web.dev/articles/what-are-pwas?hl=en), [checklist PWA](https://web.dev/articles/pwa-checklist?authuser=0&hl=en) y [estrategia de instalación](https://web.dev/articles/define-install-strategy?authuser=2&hl=en).

No se necesita publicar en App Store ni Google Play para el MVP. Si en el futuro se desea una app permanente para varios eventos, esa decisión debe basarse en uso repetido y no en novedad.

## Alcance MVP

### Inicio

- botón principal `Abrir mapa`;
- `Estoy en...` con selector manual de entrada o zona;
- agenda de hoy;
- accesos rápidos: baños, comida, escenarios, primeros auxilios y salida;
- hora y fecha de última actualización;
- aviso visible: horarios y ubicaciones sujetos a operación confirmada.

### Mapa

Capas filtrables:

- entradas y salidas;
- escenarios y zonas de feria;
- baños y baños accesibles;
- comida, bebidas y puntos de agua;
- primeros auxilios, seguridad y puntos de información;
- parqueaderos, desembarque, transporte y rutas peatonales;
- atracciones y zonas familiares;
- cajeros/puntos de pago, si se confirman;
- áreas restringidas y rutas de evacuación solo según la versión pública aprobada.

Cada punto muestra nombre, icono, zona, breve descripción, horario, accesibilidad y una instrucción simple para llegar.

### Ubicación

Dos modos complementarios:

1. **manual y confiable:** “estoy en la entrada norte / megaescenario / plaza…”;
2. **GPS opcional:** el navegador ubica al usuario solo con su permiso y procesa la posición en el dispositivo.

La navegación debe funcionar aunque el GPS sea impreciso. Se utilizan hitos físicos, colores de zona y señalética con los mismos nombres/iconos del mapa.

### Agenda

- filtro por día, hora, zona, familia, feria, música y tradición;
- ficha con horario, lugar, precio/inclusión y edad/restricción cuando corresponda;
- `ver en el mapa`;
- rutas sugeridas predefinidas: `2 horas en familia`, `día de feria`, `tradición`, `música`;
- sin favoritos sincronizados ni cuenta; si se incluye “mi ruta”, se guarda únicamente en el dispositivo.

### Emergencia y ayuda

- teléfono y ubicación de primeros auxilios, seguridad e información;
- instrucciones aprobadas para objeto perdido, niño extraviado y evacuación;
- botón de llamada, no chat automático;
- la guía nunca reemplaza señalética, altavoces ni personal.

## Qué queda fuera

- backend, inicio de sesión y perfil;
- compras, reservas o billetera;
- control de entradas;
- conteo de aforo en tiempo real;
- pedidos de comida;
- notificaciones push;
- chatbot abierto;
- crowdsourcing de ubicaciones;
- panel de administración;
- publicación en tiendas;
- promesas de tiempo real que una versión estática no puede cumplir.

## IA: uso prudente

No se recomienda poner un chatbot de IA dentro del MVP. Sin backend, fuente viva, supervisión y conexión confiable puede inventar horarios, precios o ubicaciones.

La IA sí puede utilizarse **internamente** para:

- revisar consistencia de nombres, horarios y descripciones;
- proponer rutas que luego valida operación;
- redactar versiones de lectura fácil y traducciones revisadas por personas;
- detectar puntos sin descripción, icono o accesibilidad;
- preparar preguntas frecuentes a partir de consultas reales.

El visitante recibe respuestas deterministas: búsqueda, filtros, fichas y rutas aprobadas. Es menos llamativo que un chatbot, pero más seguro y útil.

## Arquitectura sin backend

```text
QR o enlace
   ↓
PWA estática servida por HTTPS
   ├── mapa vectorial/ilustrado
   ├── puntos.json
   ├── agenda.json
   ├── rutas.json
   ├── textos de ayuda
   └── caché offline (service worker)
```

Los archivos se generan desde las fuentes aprobadas del vault y se publican como una versión cerrada. Si cambia un horario, el equipo modifica la fuente, valida y publica una versión estática nueva. Sin conexión, el visitante conserva la última versión cargada; la interfaz debe mostrar cuándo fue actualizada.

## Fuente única de verdad

| Dato | Fuente requerida | Aprueba | Estado actual |
|---|---|---|---|
| geometría y zonas | plano operativo aprobado | producción/seguridad | pendiente |
| baños, comida, ayuda y servicios | inventario georreferenciado | servicio/operaciones | pendiente |
| agenda | `programacion-maestra.csv` | programación/producción | vacío |
| precios e inclusiones | matriz comercial aprobada | ventas/finanzas | parcial |
| parqueaderos y transporte | plan de movilidad | logística/seguridad | por confirmar |
| rutas públicas/evacuación | plano público autorizado | seguridad | pendiente |
| descripciones culturales | contenido autorizado | gobierno cultural | pendiente |

Ningún dato se inventa para llenar el mapa. Un punto pendiente no se publica como confirmado.

## Experiencia de uso

Principios:

- mapa visible en menos de tres acciones;
- texto grande, contraste alto y botones para uso bajo luz exterior;
- español claro; traducciones solo si se validan;
- iconos acompañados por texto;
- descarga liviana y degradación correcta con señal débil;
- uso con una sola mano;
- no exigir instalación;
- QR repetidos en entradas, señalética, agenda impresa y puntos de información;
- mapa impreso equivalente para quien no tenga teléfono.

## Privacidad y seguridad

- sin cuentas, correos, teléfonos ni perfiles;
- ubicación opcional, usada en el dispositivo y no almacenada por el organizador;
- sin SDK publicitarios ni seguimiento individual dentro de la guía;
- analítica solo agregada y mínima si Dirección la aprueba;
- aviso de privacidad comprensible;
- HTTPS, dependencias mínimas, integridad de activos y respaldo offline;
- no utilizar el dominio principal mientras persista la redirección no autorizada registrada como riesgo crítico.

Aunque el producto no busque datos personales, cualquier medición o permiso de ubicación debe cumplir finalidad informada y proporcionalidad. Referencia oficial consultada el 2026-08-24: [Ley Orgánica de Protección de Datos Personales de Ecuador](https://spdp.gob.ec/wp-content/uploads/2024/12/03.pdf.pdf).

## Plan de entrega propuesto

| Fecha límite | Entregable | Puerta |
|---|---|---|
| 2026-08-28 | responsable, nombre del producto y alcance aprobados | G0 |
| 2026-09-02 | plano base, inventario de puntos y taxonomía | tecnología + operación |
| 2026-09-09 | prototipo navegable con una zona real | prueba interna |
| D-43 | mapa completo y agenda de prueba | G2 |
| D-34 | prueba de campo con familias y personal | experiencia |
| D-27 | versión candidata, offline y accesibilidad | G3 |
| D-15 | datos finales, señalética y QR coordinados | producción |
| D-8 | guía final aprobada | G4 |
| D-1 | simulacro de orientación y contingencia | G5 |

`D0 = Día 1`; la conversión a fechas exactas se hace únicamente desde la fuente controlada y con autorización de Dirección.

## Prueba de éxito

No medir descargas como objetivo principal. Medir:

- porcentaje que abre el mapa desde el QR;
- búsquedas más frecuentes;
- clics en `ver en el mapa`;
- tareas resueltas en prueba: encontrar baño, comida, escenario y salida;
- tiempo y errores para completar cada tarea;
- solicitudes de orientación presenciales antes/después;
- disponibilidad y carga offline;
- discrepancias entre mapa y recinto: meta cero.

## Recursos mínimos

- dueño de producto: una persona que decide alcance y prioridad;
- cartografía/diseño UX;
- desarrollo web estático/PWA;
- responsables de datos por operación, programación, servicio y seguridad;
- prueba con usuarios y control de calidad en campo;
- dominio o subdominio seguro aprobado;
- señalética física coordinada.

La guía no pertenece al presupuesto de USD 4.000 de pauta social salvo decisión expresa de finanzas. El costo debe estimarse aparte.

Relacionados: [[README|Tecnología y datos]] · [[../01_concepto-experiencia/2026-08-24_arquitectura-experiencia-asistencia-200k-finados-2026_v01|Arquitectura 200K]] · [[diccionario-datos|Diccionario de datos]] · [[../13_riesgos-contingencias/registro-riesgos|Riesgos]]
