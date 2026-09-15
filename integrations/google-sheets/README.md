# Conexión de formularios con Google Sheets

El puente recibe los registros de producción y los guarda por separado en las tres hojas autorizadas:

- `media`: acreditación de medios.
- `brunch`: confirmaciones de invitaciones.
- `voceros`: registros de la comunidad de voceros. La primera pestaña conserva las fichas y la pestaña `Consentimientos` guarda el registro de auditoría de cada autorización.

La publicación requiere una única autorización del propietario de las hojas:

1. Crear un proyecto en Google Apps Script y pegar `Code.gs`.
2. En **Configuración del proyecto > Propiedades del script**, crear `INGEST_TOKEN` con un valor aleatorio de al menos 32 caracteres.
3. Implementar como **Aplicación web**, ejecutar como el propietario y permitir acceso a cualquier usuario.
4. Para Voceros, guardar la URL terminada en `/exec` y el mismo token en `dirname(FINADOS_CONFIG_PATH)/google-sheets-config.json`, fuera de ambos directorios públicos del servidor.

En Voceros, `dirname(FINADOS_CONFIG_PATH)` significa la carpeta que contiene el JSON de configuración del backend y es la única ubicación de sus archivos privados de configuración. Por ejemplo, si `FINADOS_CONFIG_PATH=/home/usuario_cpanel/private-data/finados-backend.json`, los dos archivos son `/home/usuario_cpanel/private-data/google-sheets-config.json` y `/home/usuario_cpanel/private-data/voceros-registration.json`. Estos valores son ficticios: `private-data` es solo la carpeta del ejemplo, no una ruta fija adicional. Si se configura otra carpeta privada, ambos archivos deben quedar en esa misma carpeta. Conserva la configuración existente de los otros formularios.

El archivo privado debe tener esta forma y permisos `0600`:

```json
{"webAppUrl":"https://script.google.com/macros/s/IMPLEMENTACION/exec","token":"TOKEN_PRIVADO"}
```

Si Google no responde temporalmente, el sitio conserva el registro en su respaldo local y lo coloca en `google-sheets-pending.jsonl` para reintentar en el siguiente envío.

El formulario de voceros permanece cerrado por defecto. Para habilitarlo, además de la conexión anterior, debe existir `dirname(FINADOS_CONFIG_PATH)/voceros-registration.json` con `enabled: true` y los datos legales aprobados: responsable, RUC, dirección, correo de derechos, plazo de conservación y las cuatro versiones documentales. El archivo es privado y nunca se versiona.
