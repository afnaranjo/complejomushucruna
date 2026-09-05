---
titulo: "Estado de la pauta activa y audiencias de Meta · Finados 2026 · corte 2026-09-05"
responsable: "Alex Naranjo / responsable de pauta digital"
estado: en-revision
ultima_actualizacion: 2026-09-05
fuente: "consulta autorizada a Meta Marketing API v26.0 y escrituras autorizadas por Alex Naranjo el 2026-09-05"
confidencialidad: restringido
tags: [feria-finados-2026, meta-ads, pauta, audiencias, expositores]
---

# Estado de la pauta activa y audiencias de Meta · corte 2026-09-05

Complementa el [[2026-08-24_plan-pauta-social-usd4000-finados-2026_v01|plan de pauta social USD 4.000]] y la [[../../../../14_operaciones/bitacora-diaria/2026-09-02_bitacora_revision-campanas-activas-meta-finados-2026_v01|revisión del 2 de septiembre]]. Los identificadores internos de cuenta, página, Instagram, audiencias, campañas y anuncios no se copian a este repositorio público.

## Cuenta

- Cuenta publicitaria `ExpoFeria Mushuc Runa`, confirmada por Alex como la cuenta de Finados 2026.
- Habilitada, moneda USD, zona horaria `America/Los_Angeles`. Los cortes diarios de esta nota usan esa zona; convertir a `America/Guayaquil` para operación.
- Términos de audiencias personalizadas y de sitio web: aceptados.
- Gasto acumulado 2026 (1 ene – 5 sep): USD 7.332,59 en 81 campañas con actividad, casi todo de Carnaval 2026. Esta cifra sí concilia objetos pausados y archivados, a diferencia del corte del 2 de septiembre.

## Campañas activas de Finados 2026

La primera campaña se creó la tarde del 2 de septiembre, después de la revisión que reportó cero activas. Al corte hay cuatro activas, todas desde la página `Finados Mushuc Runa` y su Instagram, todas Ecuador completo y 18 a 65 años.

| Campaña | Objetivo | Público | Presupuesto | Gasto al 5 sep |
|---|---|---|---|---|
| `F26 · Interacción · Reel ritmos · 20260902` | Interacción con publicación | 9 audiencias de remarketing, ubicaciones manuales feed y reels | USD 10 total, 3 días, terminó el 5 sep | USD 8,09 |
| `F27 · Reconocimiento · Reel Guaynaa · 20260903` | ThruPlay | Intereses de música latina + Advantage | USD 30/día | USD 45,18 |
| `F28 · Interacción · Finados 2026 · 20260904` | Interacción, 3 anuncios | 7 audiencias de remarketing + Advantage | USD 30/día | USD 39,90 |
| `F29 · Alcance · expositores · 20260905` | Alcance | Reestructurada el 5 sep, ver abajo | USD 8/día | USD 0 al corte |

Gasto de Finados 2026 al corte: USD 93,17. Existe además un duplicado archivado de F26 sin gasto.

### Rendimiento 3–5 de septiembre

| Campaña | Alcance | CPM | Frecuencia | Señal |
|---|---|---|---|---|
| F26 Reel ritmos | 10.223 | USD 0,61–0,64 | 1,2–1,35 | 3.928 interacciones |
| F27 Reel Guaynaa | 79.953 | USD 0,43–0,59 | 1,14–1,18 | 32.789 ThruPlay, 21 seguidores nuevos |
| F28 Finados 2026 | 38.165 | USD 0,73–0,74 | 1,09–1,63 | 6.811 interacciones, 1.121 reacciones |

### Observaciones (verificado)

- El ritmo combinado antes de la reestructuración era USD 65/día. La fase de expectativa del plan prevé USD 400 en 14 días, unos USD 28/día. Al ritmo observado la fase se agota en unos seis días. Decisión pendiente de Alex y pauta.
- Los nombres `Zona centro` y `Cálido` no reflejan la segmentación real, que es todo Ecuador sin provincias ni ciudades.
- Ninguna campaña usa exclusiones. F28 combina remarketing con Advantage, por lo que Meta amplía fuera de las audiencias listadas.
- Errores de tipeo en nombres: `Zono centro`, `Lanzamietno videos`.
- No hay campañas de tráfico ni de venta; coherente con la fase de expectativa y con `/finados/` aún en `noindex`.

## Audiencias existentes

La cuenta tenía 34 audiencias personalizadas antes de esta sesión. Un paquete con prefijo `FF26 | … | RMKT`, actualizado a fines de agosto, cubre seguidores e interactuantes de Facebook e Instagram de Finados, Complejo, Carnaval y Expoferia; espectadores de video a 365 días por línea de contenido; asistentes a eventos de Facebook; y tres audiencias de sitio web. También existe `F26 | Interactuantes pagina Finados | 365d | 20260902`.

| Audiencia | Tamaño estimado |
|---|---|
| Espectadores de video Finados 365 d | 431.000 – 507.000 |
| Espectadores video cumbia 365 d | 185.000 – 218.000 |
| Interactuantes página Finados 365 d | 120.000 – 144.000 |
| Interactuantes Finados FB 365 d | 122.000 – 144.000 |
| Multicuenta seguidores FB | 81.000 – 96.000 |
| Seguidores Instagram Finados 365 d | 10.700 – 12.500 |

Vacíos verificados:

- **No existe ninguna audiencia similar (lookalike).** La semilla natural para prospección de asistentes es la de espectadores de video de Finados a 365 días.
- **Las tres audiencias de sitio web están en el mínimo (vacías).** El píxel `ExpoFeria` disparó el 4 de septiembre desde otro dominio, pero no está instalado en `complejomushucruna.com`. Sin píxel en `/finados/`, `/acceso-compra-stands/` y el flujo de Mushuc Ticket no hay remarketing web ni optimización a compra.

## Escrituras autorizadas del 2026-09-05

Alex confirmó por escrito que F29 es exclusivamente para empresas y comerciantes que quieran ser expositores, que las listas corresponden a clientes que ya compraron stands, que existe permiso para contactarlos y que la información les sirve para conocer la fecha de venta. Con esa autorización textual se ejecutó:

1. **Audiencia de clientes** `F26 | Clientes stands 2024-2026 | Lista | 20260905`, tipo lista de clientes, fuente declarada `USER_PROVIDED_ONLY`.
   - Origen: cinco listas entregadas por Alex en Descargas (clientes Carnaval 2026; Expoferia 2024; Finados 2024; Finados 2025; Carnaval 2025). Solo nombre, apellido y teléfono; sin correo.
   - 2.763 filas de origen, 1.193 teléfonos únicos válidos tras normalizar a formato internacional (1.181 celulares, 12 fijos). 183 filas sin teléfono utilizable.
   - Envío cifrado SHA-256, en memoria; Meta recibió 1.193 registros y 0 inválidos. No se creó ningún archivo con datos en claro y nada personal entró a Git.
   - Estado al cierre: `La audiencia ya se puede usar`, tamaño estimado en actualización. Meta suele emparejar entre 40 % y 60 % de una lista de teléfonos.
2. **F29 reestructurada en dos conjuntos**, ambos Ecuador, 18 a 65, Advantage desactivado, objetivo alcance, mismo anuncio de expositores:

| Conjunto | Público | Presupuesto |
|---|---|---|
| `Prospección empresarios y comerciantes · EC 18-65 · USD5` (conjunto original renombrado) | Comportamientos: pequeños empresarios, administradores de páginas de empresa, de comercios minoristas, de perfiles de Instagram para empresas, administradores de tiendas, nuevos negocios activos < 24 meses. Intereses: pequeña empresa, pymes, empresariado, comercio minorista, negocio familiar. | USD 5/día |
| `Clientes stands 2024-2026 · lista · EC · USD3` (nuevo) | Solo la audiencia de clientes | USD 3/día |

Ambos anuncios quedaron `IN_PROCESS` (revisión de Meta) al cierre; corresponde comprobar el 6 de septiembre que estén activos y entregando.

## Recomendaciones (hipótesis, sin ejecutar)

- Crear una audiencia similar 1 % Ecuador desde los espectadores de video de Finados a 365 días para la fase de conversión.
- Crear una audiencia de espectadores del 50 % o más solo de los Reels de Finados 2026, 180 días, para separar interés nuevo del histórico.
- Instalar el píxel `ExpoFeria` en `complejomushucruna.com` y validar el flujo de compra de Mushuc Ticket antes de la fase de conversión.
- Ajustar los nombres de F27 y F28 a la geografía real o segmentar de verdad por zona, y definir exclusiones cruzadas entre remarketing y prospección.
- Fijar el ritmo diario de la fase de expectativa contra los USD 400 del plan.

## Seguridad

- Alex entregó el token de acceso directamente en el chat. Se usó solo como variable de entorno en la sesión, nunca en URL, archivos ni Git. Debe considerarse expuesto y revocarse, junto con el del 2 de septiembre cuya revocación sigue sin confirmar.
- Total de llamadas a la API en la sesión: 15 de lectura y 5 de escritura, sin `Retry-After`, uso de cuenta máximo observado 4 %.

## Navegación

- [[README|Índice de pauta]]
- [[2026-08-24_plan-pauta-social-usd4000-finados-2026_v01|Plan de pauta social USD 4.000]]
- [[../../../../14_operaciones/bitacora-diaria/2026-09-05_bitacora_revision-pauta-y-audiencia-clientes-f29-finados-2026_v01|Bitácora del 2026-09-05]]
- [[../../03_expositores/README|Expositores]]
- [[../../../../_pendientes|Pendientes]]
