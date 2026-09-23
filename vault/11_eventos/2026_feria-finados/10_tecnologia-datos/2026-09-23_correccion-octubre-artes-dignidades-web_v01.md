---
titulo: "Corrección de ACTUBRE a OCTUBRE en artes de dignidades"
responsable: "tecnología/diseño"
estado: publicado
ultima_actualizacion: 2026-09-23
fuente: "Solicitud directa de Alex del 23 de septiembre de 2026"
confidencialidad: interno
tags: [feria-finados-2026, tecnologia, web, dignidades, correccion]
---

# Corrección de ACTUBRE a OCTUBRE en artes de dignidades

Relacionado: [[2026-09-22_correccion-final-las-nanas-disposicion-auspiciantes-web_v01|Arte final de Las Ñañas y disposición de auspiciantes]].

## Alcance

Alex pidió corregir en toda la web el error de escritura `ACTUBRE` por `OCTUBRE`. La palabra no estaba en el HTML: formaba parte de la imagen rasterizada de nueve artes de la elección de dignidades 2026. El arte de Las Ñañas ya tenía la grafía correcta.

## Implementación

- Se sustituyó únicamente la franja inferior de fecha de los nueve artes afectados por la franja oficial ya correcta del arte de Las Ñañas: `VOTACIONES HASTA EL 27 DE OCTUBRE`.
- No se modificaron fotografías, rostros, nombres, logotipos, rótulos ni la composición de los nominados.
- Los diez artes continúan como WebP de 1080 × 1350 y quedan protegidos por una prueba de SHA-256 individual.
- La versión de caché cambió a `20260923-dignities-4` para impedir que el navegador reutilice las imágenes anteriores.

## Validación

- TDD: la prueba nueva falló primero con la versión anterior y el hash del primer arte sin corregir; después pasó con los diez hashes aprobados.
- `npm run check` final, después de integrar el `main` más reciente: 199 pruebas Node, 24 suites PHP y 10 pruebas de integración; build de 181 archivos, 61 HTML y 1.916 referencias válidas.
- QA responsive con Edge en 1440 × 1000 y 390 × 844: 10/10 imágenes cargadas a 1080 × 1350, versión correcta y sin desbordamiento horizontal.
- No se modificaron backend, base de datos, migraciones, formularios, DNS, Google Sheets ni datos de personas.

## Publicación

- Commit técnico `4f1a659` (`Corregir octubre en artes de dignidades`) publicado en `origin/main`.
- Prevuelo y despliegue frontend estándar aprobados, con respaldo recuperable y transferencia sin borrar archivos exclusivos del servidor. El backend no se desplegó.
- Verificación independiente por HTTPS en `complejomushucruna.com` y `finados.expoferiamushucruna.com`: página de Finados HTTP 200, versión nueva presente y 10/10 artes idénticos al build por SHA-256 en cada dominio.
- Resultado: Git y producción actualizados, sin bloqueo pendiente.
