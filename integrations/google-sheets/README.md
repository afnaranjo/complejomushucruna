# Conexión de formularios con Google Sheets

El puente recibe los registros de producción y los guarda por separado en las dos hojas autorizadas:

- `media`: acreditación de medios.
- `brunch`: confirmaciones de invitaciones.

La publicación requiere una única autorización del propietario de las hojas:

1. Crear un proyecto en Google Apps Script y pegar `Code.gs`.
2. En **Configuración del proyecto > Propiedades del script**, crear `INGEST_TOKEN` con un valor aleatorio de al menos 32 caracteres.
3. Implementar como **Aplicación web**, ejecutar como el propietario y permitir acceso a cualquier usuario.
4. Guardar la URL terminada en `/exec` y el mismo token en el archivo privado del servidor `private-data/google-sheets-config.json`.

El archivo privado debe tener esta forma y permisos `0600`:

```json
{"webAppUrl":"https://script.google.com/macros/s/IMPLEMENTACION/exec","token":"TOKEN_PRIVADO"}
```

Si Google no responde temporalmente, el sitio conserva el registro en su respaldo local y lo coloca en `google-sheets-pending.jsonl` para reintentar en el siguiente envío.
