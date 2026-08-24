---
titulo: "Arquitectura documental"
responsable: "líder de marketing"
estado: aprobado
ultima_actualizacion: 2026-08-24
fuente: interna
confidencialidad: interno
---

# Arquitectura documental

## Criterio principal

La ubicación depende de la función estable del material, no de la persona que lo creó ni de la herramienta utilizada.

| Código | Área | Qué contiene | Qué no contiene |
|---|---|---|---|
| 00 | Gobernanza | Reglas, decisiones, taxonomía, plantillas | Ejecución de marketing |
| 01 | Contexto del negocio | Historia, modelo, objetivos, fuentes, preguntas | Estrategias de campaña |
| 02 | Equipo y stakeholders | Directorio, roles, RACI, responsables | Datos personales sensibles |
| 03 | Marca | Identidad, voz, mensajes, aprobaciones | Piezas de una campaña específica |
| 04 | Estrategia | Objetivos, posicionamiento, planes anuales | Tareas diarias |
| 05 | Audiencias e investigación | Segmentos, entrevistas, competencia, insights | Listas de contactos sin autorización |
| 06 | Oferta y experiencias | Servicios, atractivos, precios, paquetes | Promesas no aprobadas |
| 07 | Campañas | Expediente completo por campaña | Activos maestros genéricos |
| 08 | Contenido | Calendario, producción editorial, publicaciones | Estrategia corporativa |
| 09 | Canales | Reglas y desempeño por canal | Contraseñas o tokens |
| 10 | Creatividad | Conceptos, copys, guiones, archivos de trabajo | Versiones finales maestras de marca |
| 11 | Eventos | Planes operativos y marketing de eventos | Toda la historia del negocio |
| 12 | Ventas y alianzas | Patrocinios, expositores, convenios, pipeline | Información bancaria |
| 13 | Datos y medición | KPIs, tracking, tableros, informes | Credenciales de plataformas |
| 14 | Operaciones | Procesos, proveedores, presupuestos, permisos | Material creativo final |
| 15 | Activos | Logos, fotos y recursos aprobados reutilizables | Borradores y duplicados |
| 90 | Entrada por clasificar | Material temporal con duda documentada | Archivo permanente |
| 99 | Archivo | Material cerrado o reemplazado | Trabajo activo |

## Árbol de decisión

1. ¿Es una regla que afecta a todo el equipo? → `00_gobernanza/`.
2. ¿Describe qué es el negocio o cómo funciona? → `01_contexto-negocio/`.
3. ¿Pertenece a una campaña concreta? → carpeta única en `07_campanas/`.
4. ¿Es reutilizable en muchas campañas? → marca, canal, medición, operación o activos según su función.
5. ¿Es un evento con operación propia? → `11_eventos/`, enlazado desde su campaña si existe.
6. ¿No se puede decidir sin contexto adicional? → `90_entrada-por-clasificar/` y pregunta al responsable.

## Ciclo de vida

```text
entrada → borrador → en revisión → aprobado/publicado → cerrado → archivo
```

Mover el original entre estados conserva el historial. Nunca crees carpetas `final`, `final-2` o `final-ahora-si`.

## Cuándo cambiar esta arquitectura

Solo cuando el nuevo tipo de información sea recurrente, tenga responsable propio y no encaje razonablemente en un área existente. Registra la decisión antes de añadir una carpeta raíz.
