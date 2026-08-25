---
titulo: "Auditoría histórica de Meta 2021-2026 y aprendizajes para Finados 2026"
responsable: "analista de marketing"
estado: en-revision
ultima_actualizacion: 2026-08-24
fuente: "Meta Graph API y Marketing API; extracción autorizada de solo lectura"
confidencialidad: restringido
---

# Auditoría histórica de Meta 2021-2026

## Resumen ejecutivo

La evidencia sostiene una decisión central: **Finados 2026 debe producir menos publicaciones, con más intención, mejor continuidad de medición y una operación digital que responda dudas y proteja la reputación**.

Se analizaron 1.414 publicaciones públicas de dos páginas, de las cuales 1.363 quedaron asociadas a los eventos priorizados, y 13 meses parciales de pauta de la cuenta `ExpoFeria Mushuc Runa`. No se extrajeron comentarios individuales ni datos personales. La consulta fue de solo lectura, se detuvo al primer límite de aplicación y no se volvió a llamar a Meta.

Hallazgos decisivos:

1. **El video es el formato más consistente.** Su mediana superó a la foto en todas las ediciones con muestra suficiente. En Finados 2025 fue 58,5 frente a 34,5 interacciones; en Carnaval 2026, 88 frente a 49.
2. **Música y artistas abren la atención**, pero no bastan para construir una feria diferenciada. Los contenidos líderes combinan artista, emoción reconocible, prueba humana y un momento concreto.
3. **La utilidad también puede ganar.** El contenido líder de Finados 2022 fue un video sobre los 6.000 parqueaderos: 1.784 interacciones y 406 compartidos. La certeza operativa es contenido, no un anexo.
4. **Finados 2025 sufrió saturación.** Publicó 430 piezas en 56 días; durante los cinco días de feria fueron 179, equivalentes a 35,8 por día. La mediana de la fase en vivo quedó en 33 interacciones por pieza.
5. **Los totales están muy concentrados.** Una sola pieza del cierre con Dina Paucar aportó 28.595 interacciones, 25,8% del total de Finados 2025. Las diez mejores piezas aportaron 51,7%. El total no representa la publicación típica.
6. **La pauta recuperada es parcial, pero material:** USD 26.532,46 observados, 71,48 millones de impresiones, 431.866 clics de enlace y 6.959 conversaciones atribuidas por Meta en cuatro ventanas de evento. No es el gasto total histórico.
7. **La medición de conversión no es comparable entre años.** Finados 2025 registra 221 compras atribuidas y Carnaval 2026 registra cero, pese a inversión y tráfico relevantes. Sin auditar píxel, Conversion API, ventana, deduplicación y boletería, no se puede concluir que una edición vendió mejor.
8. **La marca quedó dividida entre dos páginas.** A la fecha de consulta, Carnaval tenía 76.298 seguidores y Finados 18.653. La página de Finados solo contiene historia desde septiembre de 2025; compararla directamente con años anteriores sería incorrecto.

La recomendación no es duplicar las publicaciones de mayor interacción, sino duplicar sus principios: **un solo motivo por pieza, video reconocible en segundos, prueba real, información accionable, edición disciplinada y destino de conversión medido**.

## Dictamen y nivel de confianza

| Afirmación | Clasificación | Confianza |
|---|---|---:|
| Fechas históricas citadas y volumen de publicaciones recuperado | verificado en publicaciones | alta |
| Conteos públicos de reacciones, comentarios y compartidos | verificado en extracción | alta |
| Gasto mensual recuperado de `ExpoFeria Mushuc Runa` | verificado, pero parcial | alta sobre lo observado |
| Eficiencia de impresiones, clics y conversaciones atribuidas | verificado en agregado mensual | media |
| Compras y leads como resultado comercial real | por confirmar | baja |
| Causalidad entre pauta y desempeño orgánico | no demostrada | no evaluable |
| Sentimiento y reputación en comentarios de Facebook | no extraído | no evaluable |
| Estrategia recomendada para 2026 | hipótesis informada | sujeta a validación |

## 1. Alcance, seguridad y método

### Activos analizados

| Activo | Cobertura recuperada | Estado |
|---|---|---|
| `Carnavales Mushuc Runa` | 1.017 publicaciones, 2021-01-23 a 2026-03-13 | cobertura histórica amplia |
| `Finados Mushuc Runa` | 397 publicaciones, 2025-09-06 a 2025-11-19 | solo edición 2025 |
| `ExpoFeria Mushuc Runa` — cuenta publicitaria | 13 meses con gasto entre 2023-12 y 2026-03 | parcial |
| `Complejo Mushuc Runa` — cuenta publicitaria | acceso validado, sin historial descargado en esta sesión | pendiente |

Controles aplicados:

- solicitudes `GET` de solo lectura;
- máximo conservador y pausa de tres segundos;
- sin reintentos automáticos;
- detención inmediata al código 4 `Application request limit reached`;
- uso reportado de la cuenta publicitaria: 0% al detenerse;
- token mantenido únicamente en memoria y ausente de archivos;
- sin cambios en páginas, campañas, anuncios, mensajes o configuración;
- sin extracción de comentarios individuales, usuarios o datos personales.

### Método analítico

- Conversión de fechas de publicaciones desde UTC a `America/Guayaquil`.
- Clasificación de eventos mediante ventanas verificadas y texto de publicación.
- Comparación con mediana, percentiles y concentración, no solo totales.
- Temas detectados con reglas de texto; son direccionales y no sustituyen codificación humana.
- Pauta agrupada por ventana de evento. Los meses se asignan por calendario, no por campaña, porque el desglose de campañas no alcanzó a descargarse.
- Clics, conversaciones, leads y compras conservan la definición de atribución de Meta. No se conciliaron con boletería ni caja.

Fuentes de datos: [[datos/calidad_datos.json]], [[datos/resumen_eventos_organico.csv]], [[datos/ranking_publicaciones.csv]], [[datos/resumen_formatos.csv]], [[datos/resumen_fases.csv]], [[datos/resumen_temas.csv]], [[datos/pauta_mensual_procesada.csv]] y [[datos/pauta_eventos_parcial.csv]].

## 2. Comparativo orgánico de eventos

`Interacciones públicas = reacciones + comentarios + compartidos`. No es tasa de engagement porque no existe alcance orgánico por publicación.

| Evento | Publicaciones | Piezas/día activo | Interacciones totales | Mediana por pieza | Copias repetidas |
|---|---:|---:|---:|---:|---:|
| Finados 2021 | 14 | 2,00 | 486 | 18,0 | 35,7% |
| Carnaval 2022 | 156 | 4,33 | 88.943 | 101,5 | 5,1% |
| Finados 2022 | 6 | 1,50 | 2.376 | 131,5 | 33,3% |
| Carnaval 2023 | 241 | 4,55 | 96.138 | 99,0 | 16,2% |
| Carnaval 2024 | 123 | 2,67 | 89.458 | 203,0 | 13,8% |
| Carnaval 2025 | 128 | 2,51 | 71.223 | 141,5 | 6,2% |
| Finados 2025 | 430 | 7,68 | 110.886 | 38,0 | 16,7% |
| Carnaval 2026 | 265 | 3,68 | 109.656 | 66,0 | 4,9% |

Advertencias:

- Finados 2021 y 2022 tienen muestras pequeñas y proceden de la página de Carnaval.
- Carnaval 2024 refleja comunicación de una edición planificada; su ejecución y cierre operativo siguen por confirmar.
- Finados 2025 incorpora 397 piezas de la página nueva y 33 cruces desde Carnaval.
- Las diferencias de seguidores, pauta y edad de página impiden atribuir cambios a creatividad de forma aislada.

### Concentración

| Evento | Aporte de la mejor pieza | Aporte de las diez mejores |
|---|---:|---:|
| Carnaval 2022 | 34,9% | 72,4% |
| Carnaval 2023 | 13,6% | 50,9% |
| Carnaval 2024 | 10,4% | 56,7% |
| Carnaval 2025 | 6,1% | 47,1% |
| Finados 2025 | 25,8% | 51,7% |
| Carnaval 2026 | 7,5% | 48,9% |

Conclusión: el sistema actual produce una larga cola de piezas con poco resultado típico y depende de pocos éxitos. La respuesta correcta es elevar el porcentaje de piezas útiles y distintivas, no aumentar el inventario.

## 3. Qué funcionó

### 3.1 Video con emoción reconocible

| Evento | Mediana video | Mediana foto | Ventaja observada del video |
|---|---:|---:|---:|
| Carnaval 2022 | 211,0 | 88,0 | 2,40× |
| Carnaval 2023 | 179,0 | 91,0 | 1,97× |
| Carnaval 2024 | 450,0 | 115,5 | 3,90× |
| Carnaval 2025 | 324,5 | 80,0 | 4,06× |
| Finados 2025 | 58,5 | 34,5 | 1,70× |
| Carnaval 2026 | 88,0 | 49,0 | 1,80× |

Esto no prueba que “todo video funciona”. Sí prueba que el formato tiene mejor potencial cuando existe una idea clara, un rostro o artista reconocible y una escena que vale la pena compartir.

### 3.2 Música como puerta de entrada

En Finados 2025, tres de las cuatro piezas líderes fueron videos musicales o invitaciones de artistas:

- cierre de Dina Paucar: 28.595 interacciones;
- preparación de la noche de cumbia: 5.557;
- invitación de Euler Caicedo: 4.697;
- tendencia con artista y organizador: 4.523.

En Carnaval 2022, un video previo al show de Paola Jara alcanzó 31.064 interacciones y 9.434 compartidos. En Carnaval 2023, el relato audiovisual sobre el origen de la Expoferia alcanzó 13.057. En Carnaval 2024, el anuncio de Rata Blanca alcanzó 9.340.

Principio replicable: **reconocimiento + tensión emocional + fecha/escena concreta + prueba audiovisual**.

### 3.3 Historia y propósito cuando se vuelven relato

El video de Carnaval 2023 que contó cómo nació la Expoferia superó a la mayoría de anuncios de cartelera. La identidad funciona mejor como historia demostrable que como una repetición de eslogan.

Para 2026, la cultura debe aparecer en personas, prácticas, sabores, artesanía, comunidad, memoria y territorio; no solo en marcos gráficos o hashtags.

### 3.4 Información operativa que reduce incertidumbre

El mejor contenido recuperado de Finados 2022 fue sobre parqueaderos. Obtuvo 1.784 interacciones y 406 compartidos, por encima de la cartelera general de esa pequeña muestra.

Esto coincide con los riesgos reputacionales ya documentados sobre movilidad, filas, higiene, precios e información. Los contenidos de servicio pueden ser altamente compartibles cuando resuelven una decisión familiar real.

### 3.5 Participación interactiva, con cautela

El sorteo del “Pase Dorado” en Finados 2025 generó 3.579 interacciones, de las cuales 3.265 fueron comentarios. Es una señal de capacidad de movilización, pero está incentivada por premio y mecánica; no debe equipararse a intención de compra ni repetirse como columna vertebral. Sirve para captación puntual si se mide calidad posterior.

## 4. Qué funcionó peor o se volvió riesgoso

### 4.1 Saturación durante la feria

| Fase de Finados 2025 | Publicaciones | Piezas/día activo | Mediana |
|---|---:|---:|---:|
| consideración | 38 | 2,11 | 86,0 |
| conversión | 144 | 6,86 | 40,0 |
| urgencia | 56 | 8,00 | 29,5 |
| en vivo | 179 | 35,80 | 33,0 |
| postevento | 13 | 2,60 | 73,0 |

La fase en vivo publicó casi una pieza cada 40 minutos durante una jornada de 24 horas. El máximo diario fue 48. Esto fragmenta atención, compite contra los propios mensajes y dificulta que información de servicio permanezca visible.

No se recomienda aplicar una regla mecánica de “menos siempre es mejor”; se recomienda una mesa editorial que diferencie:

- contenido principal;
- historias/cobertura ligera;
- información de servicio fijada;
- material para archivo y recap, que no necesita publicarse en tiempo real.

### 4.2 Duplicación y cruces de página sin arquitectura

En Finados 2025, 72 publicaciones pertenecen a grupos de texto repetido. Además, 33 cruces en la página de Carnaval sumaron solo 613 interacciones, mediana 12, frente a mediana 41 en la página de Finados.

No conviene copiar todo entre páginas. La página grande de Carnaval debe transferir audiencia con pocas piezas ancla y un destino claro; Finados debe concentrar el relato y la conversión.

### 4.3 CTA y precio poco consistentes

En Finados 2025, 36,7% de piezas tuvo una llamada a la acción detectable, 17,4% incluyó URL y solo 2,3% mostró un precio numérico. La detección es automatizada y puede omitir texto incrustado en imágenes, pero la señal apunta a fricción: múltiples piezas invitan a comprar sin que la propuesta completa sea legible en el texto.

La solución es una ficha única y verificable por día/experiencia: qué incluye, para quién es, horario, precio, punto de compra, cómo llegar y condiciones.

### 4.4 Tipografía ornamental y copy difícil de buscar

El uso frecuente de caracteres Unicode decorativos reduce legibilidad, accesibilidad, búsqueda y consistencia. El contenido debe conservar texto normal en el cuerpo; la identidad visual debe vivir en la pieza, no deformar el alfabeto del mensaje.

### 4.5 Métricas de vanidad

Entre 93,8% y 96,0% de las “interacciones” reportadas en pauta son reproducciones de video. Por ello, `post_engagement` no debe tratarse como señal profunda ni como equivalente a consideración.

Se debe separar:

- reproducción y alcance;
- visita cualificada;
- conversación con intención;
- lead válido;
- compra conciliada;
- asistencia y valor económico.

## 5. Pauta observada

Los valores siguientes son mínimos observados en una sola cuenta y no presupuestos totales.

| Ventana | Meses incluidos | Gasto observado | Impresiones | Clics de enlace | CPC enlace | Conversaciones Meta | Costo/conversación | Compras Meta |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Carnaval 2024 | dic-2023 a mar-2024 | USD 5.435,75 | 15.175.162 | 116.439 | USD 0,047 | 309 | USD 17,59 | 34 |
| Carnaval 2025 | ene-mar 2025 | USD 9.730,14 | 26.233.034 | 93.399 | USD 0,104 | 2.460 | USD 3,96 | 25 |
| Finados 2025 | oct-nov 2025 | USD 3.531,42 | 7.443.415 | 49.861 | USD 0,071 | 1.083 | USD 3,26 | 221 |
| Carnaval 2026 | dic-2025 a mar-2026 | USD 7.835,15 | 22.632.359 | 172.167 | USD 0,046 | 3.107 | USD 2,52 | 0 |

### Lectura correcta

- CPM y CPC fueron bajos en las ventanas observadas, pero costo bajo no significa tráfico cualificado.
- Las conversaciones mejoraron frente a Carnaval 2024, aunque el agregado mezcla objetivos y campañas.
- Finados 2025 muestra la señal de compra atribuida más fuerte: 221 a USD 15,98. **Es una hipótesis de éxito de medición, no una prueba de venta**, hasta conciliarla.
- Carnaval 2026 muestra cero compras atribuidas con 172.167 clics de enlace. Esto sugiere un cambio de tracking, objetivo, sitio o evento de conversión; no demuestra cero ventas.
- El alcance mensual sumado no debe usarse como alcance único porque una persona puede repetirse entre meses.
- Las cuentas publicitarias están configuradas en `America/Los_Angeles`; los cortes diarios deben normalizarse a Guayaquil en análisis, sin cambiar la cuenta sin aprobación.

## 6. Comportamiento del consumidor: lo que sí se puede inferir

### Señales observadas

1. **La audiencia comparte identidad musical.** Artistas y canciones reconocibles generan la mayor propagación.
2. **La familia necesita reducir incertidumbre.** Estacionamiento, agenda, precio, ubicación y seguridad pueden mover interacción cuando están presentados con claridad.
3. **La prueba social pesa.** Recaps, ambiente real y momentos de escenario funcionan mejor que anuncios genéricos cuando muestran una experiencia creíble.
4. **La participación incentivada produce volumen, no necesariamente valor.** Concursos disparan comentarios, pero deben medirse hasta conversación o compra.
5. **La exposición repetida no garantiza atención incremental.** En los seis eventos grandes analizados, la relación diaria entre cantidad de publicaciones y mediana de interacciones fue débilmente negativa. Es descriptiva, no causal.

### Lo que no se sabe todavía

- quiénes compraron y desde qué campaña;
- procedencia geográfica real de compradores y asistentes;
- valor por familia, permanencia, gasto interno o recompra;
- razones de abandono del proceso de compra;
- sentimiento de comentarios en Facebook;
- satisfacción de expositores, patrocinadores y visitantes;
- impacto incremental de pauta frente a orgánico.

## 7. Reputación y marca comercial

La comunicación de 2026 debe resolver dos trabajos simultáneos:

1. **Deseabilidad:** música, cultura, familia, comercio y experiencias.
2. **Confianza:** precio claro, agenda estable, movilidad, limpieza, agua, baños, filas, seguridad, bienestar animal y respuesta rápida.

Una promesa creativa no debe ir por delante de la operación. Cada mensaje de confianza necesita un dueño interno y evidencia. La dirección propuesta `Mushuc Runa — Territorio Vivo de los Andes` sigue siendo hipótesis y requiere aprobación cultural y de marca.

Aplicaciones prácticas:

- publicar un centro de información único y actualizado;
- fijar mapa, horarios, precios, condiciones y accesos;
- responder rumores con un protocolo de fuente y tiempo;
- no confirmar artistas, fechas o precios antes del frente dueño;
- mostrar mejoras operativas solo cuando estén implementadas;
- separar contenido de entretenimiento, servicio y contingencia.

Véanse [[../../05_audiencias-investigacion/01_reputacion-riesgos-y-voz-publica/README|reputación y riesgos]] y [[../../05_audiencias-investigacion/03_inteligencia-competitiva/README|inteligencia competitiva]].

## 8. Directrices para la estrategia digital 2026

### Decisiones recomendadas

1. Una sola página principal para Finados 2026; Carnaval se usa como puente, no como espejo.
2. Video-first con calidad editorial; no volumen-first.
3. La música abre el embudo, la experiencia total diferencia y la confianza convierte.
4. Una landing o centro de información canónico con UTMs, agenda y compra.
5. Pauta estructurada por etapa y destino, no por publicaciones aisladas.
6. Boletería, píxel, Conversion API y caja reconciliados antes de optimizar a compra.
7. Contenido en vivo curado; el resto se guarda para recap, prensa y archivo.
8. Medición de negocio: compra verificada, asistencia, ingreso, satisfacción y valor para expositor.

La arquitectura completa está en [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/01_estrategia/2026-08-24_estrategia-digital-finados-2026_v01|estrategia digital Finados 2026]].

## 9. Preguntas para cerrar antes de aprobar presupuesto

1. ¿Cuál es el presupuesto total y qué cuenta pagará cada frente?
2. ¿Qué venta representa realmente el evento `purchase` en Meta?
3. ¿Qué datos ofrece la boletería por orden, producto, fecha y UTM?
4. ¿Cuál fue la facturación real de Meta por evento y por cuenta?
5. ¿Qué fechas, precios, aforo, artistas y atractivos están confirmados?
6. ¿Cuál es la capacidad diaria de respuesta por WhatsApp/Messenger?
7. ¿Qué métricas definen éxito para dirección, expositores y patrocinadores?
8. ¿Qué página y dominio serán la fuente oficial de verdad?

## 10. Limitaciones y siguiente extracción segura

La auditoría no está cerrada. Faltan:

- exporte de facturación 2021-2026;
- desglose campaña/conjunto/anuncio de `ExpoFeria Mushuc Runa`;
- historial de `Complejo Mushuc Runa`;
- alcance orgánico por publicación;
- crecimiento histórico de seguidores;
- creatividades y miniaturas para auditoría visual;
- configuración de atribución, píxel y Conversion API;
- ventas, asistencia y resultados internos;
- muestra anonimizada de comentarios para reputación.

La siguiente extracción debe realizarse después de que se restablezca la cuota, en lotes pequeños, secuenciales y con el mismo corte inmediato. No se debe reintentar por fuerza ni aumentar ritmo.

## Navegación

- [[README|Índice de la auditoría]]
- [[2026-08-24_auditoria-meta-2021-2026_v01.ipynb|Notebook reproducible]]
- [[../../11_eventos/2026_feria-finados/05_marketing-comunicacion/01_estrategia/2026-08-24_estrategia-digital-finados-2026_v01|Directriz estratégica 2026]]
- [[../../_memoria-del-proyecto|Memoria del proyecto]]
