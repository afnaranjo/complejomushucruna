---
titulo: "Edwin Masabanda y Alex Naranjo como observadores de las tareas existentes en Bitrix"
responsable: "administración Bitrix / dirección integral de la feria"
estado: cerrado
ultima_actualizacion: 2026-08-31
fuente: "instrucción directa de Alex y verificación interna en Bitrix"
confidencialidad: interno
---

# Edwin Masabanda y Alex Naranjo como observadores en Bitrix

Relacionado con [[2026-08-28_bitacora_correccion-roles-dependencias-bitrix-finados-2026_v01|la corrección de roles y dependencias]], [[2026-08-31_bitacora_modelo-tareas-madre-bitrix-finados-2026_v01|el modelo de tareas madre y subtareas]], [[../../_memoria-del-proyecto|la memoria del proyecto]] y [[../../_pendientes|los pendientes ejecutivos]].

## Alcance autorizado

Alex solicitó añadir a Edwin Masabanda y a Alex Naranjo como observadores de todas las tareas que ya existían en el Collab `FINADOS 2026`. La instrucción no autorizó crear, borrar, recrear, cerrar, mover o reasignar tareas ni cambiar su contenido operativo.

La validación de identidad distinguió a Edwin Masabanda de la cuenta audiovisual `EDWIN NAULA`. También confirmó que la cuenta de Alex aparece en Bitrix con su nombre completo. No se utilizó una coincidencia aproximada ni se añadió a una cuenta ambigua.

## Corte previo

La consulta inicial de solo lectura encontró 15 tareas:

- Edwin Masabanda no figuraba como observador en ninguna;
- Alex Naranjo ya figuraba en 5;
- faltaba añadir a Edwin en 15 y a Alex en 10.

## Cambio aplicado

Cada tarea recibió la unión entre sus observadores existentes y las dos cuentas confirmadas. De esta forma:

- Edwin Masabanda fue añadido a las 15 tareas;
- Alex Naranjo fue añadido únicamente a las 10 donde faltaba;
- los observadores anteriores se conservaron;
- no se generaron observadores duplicados.

## Verificación posterior

Una consulta nueva de solo lectura confirmó las 15 tareas y comprobó que:

- Edwin Masabanda y Alex Naranjo figuran como observadores en todas;
- la lista de observadores de cada tarea coincide exactamente con la lista previa más las cuentas que faltaban;
- títulos, responsables, creadores, participantes, fechas límite, estados, etapas, jerarquía, prioridad, descripción y controles operativos seleccionados permanecen iguales;
- el conjunto y el orden de las tareas no cambiaron.

## Seguridad y límites

- No se borró, recreó, duplicó, cerró, movió o reasignó ninguna tarea.
- No se modificaron CRM, negocios, contactos, miembros, permisos, Notion ni otros proyectos.
- No se publicó, programó o pautó contenido.
- La conexión utilizó el mecanismo OAuth existente con salida sensible silenciada; ninguna credencial, token, URL privada o identificador interno entró al repositorio.
- El alcance verificado corresponde a las 15 tareas existentes en el corte del 2026-08-31. Las tareas futuras deben seguir el [[../../11_eventos/2026_feria-finados/00_direccion-control/2026-08-31_modelo-jerarquia-tareas-bitrix-finados-2026_v01|modelo aprobado]] y recibir sus observadores durante su propia carga y validación.
