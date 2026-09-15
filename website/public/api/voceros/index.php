<?php
declare(strict_types=1);

if (!defined('MUSHUC_API_ENTRY')) define('MUSHUC_API_ENTRY', true);
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . '_google-sheets.php';

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . '_voceros-bootstrap.php';

const POLICY_TEXT = 'He leído y acepto las Políticas del Vocero y las Bases del Termómetro.';
const IMAGE_TEXT = 'Autorizo al responsable del programa a usar mi imagen, mi voz y el contenido que publique como vocero en sus canales oficiales y materiales de la feria, con mi crédito y sin pago adicional. He leído la Autorización de uso de imagen y contenido.';
const DATA_TEXT = 'Autorizo el tratamiento de mis datos personales para gestionar el programa de voceros, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador. He leído la Política de Privacidad y conozco mis derechos de acceso, rectificación, eliminación, oposición y portabilidad.';

function voceros_response(int $status, array $payload, array $headers = []): array
{
    return ['status' => $status, 'json' => $payload, 'headers' => $headers];
}

function registration_config(string $directory): ?array
{
    $path = $directory . DIRECTORY_SEPARATOR . 'voceros-registration.json';
    if (!is_file($path)) return null;
    $contents = file_get_contents($path);
    $config = is_string($contents) ? json_decode($contents, true) : null;
    if (!is_array($config) || ($config['enabled'] ?? false) !== true) return null;
    foreach ([
        'responsable', 'direccion', 'telefono', 'contactEmail',
        'policiesVersion', 'thermometerVersion', 'imageVersion', 'privacyVersion',
    ] as $field) {
        if (!is_string($config[$field] ?? null) || trim($config[$field]) === '') return null;
    }
    if (!filter_var($config['contactEmail'], FILTER_VALIDATE_EMAIL)) return null;
    if ((int) ($config['retentionYears'] ?? 0) !== 3) return null;
    return $config;
}

function clean_required(array $post, string $name, int $maxLength, int $minLength = 1): string
{
    $value = isset($post[$name]) && is_string($post[$name]) ? trim($post[$name]) : '';
    $value = preg_replace('/\s+/u', ' ', $value);
    if (!is_string($value) || strlen($value) < $minLength || strlen($value) > $maxLength) {
        throw new InvalidArgumentException('Revisa los campos obligatorios e inténtalo nuevamente.');
    }
    return $value;
}

function clean_optional(array $post, string $name, int $maxLength): string
{
    $value = isset($post[$name]) && is_string($post[$name]) ? trim($post[$name]) : '';
    $value = preg_replace('/\s+/u', ' ', $value);
    if (!is_string($value) || strlen($value) > $maxLength) {
        throw new InvalidArgumentException('Uno de los campos supera el tamaño permitido.');
    }
    return $value;
}

function require_choice(string $value, array $allowed): string
{
    if (!in_array($value, $allowed, true)) throw new InvalidArgumentException('Selecciona una opción válida.');
    return $value;
}

function valid_ecuadorian_id(string $value): bool
{
    return preg_match('/^\d{10}$/', $value) === 1;
}

function valid_submission_id(string $value): bool
{
    return preg_match('/^[a-f0-9]{32}$/', $value) === 1;
}

function valid_https_url(string $value): bool
{
    if ($value === '') return true;
    if (filter_var($value, FILTER_VALIDATE_URL) === false) return false;
    return strtolower((string) parse_url($value, PHP_URL_SCHEME)) === 'https';
}

function voceros_handle_request(array $server, array $post, ?callable $bootstrap = null, ?callable $sheets = null): array
{
    $timezone = new DateTimeZone('America/Guayaquil');
    $now = new DateTimeImmutable('now', $timezone);
    try {
        $dependencies = ($bootstrap ?? 'voceros_bootstrap')();
        $repository = $dependencies['repository'];
        $privateDirectory = $dependencies['privateDirectory'];
        $config = $dependencies['config'];
    } catch (Throwable $error) {
        $config = null;
    }

    if ($server['REQUEST_METHOD'] === 'GET' || $server['REQUEST_METHOD'] === 'HEAD') {
        if ($server['REQUEST_METHOD'] === 'HEAD') {
            return voceros_response(200, []);
        }
        return voceros_response(200, [
            'open' => $config !== null,
            'message' => $config !== null
                ? 'El registro está habilitado.'
                : 'El formulario se habilitará cuando estén publicados los documentos legales y la configuración privada de recepción.',
            'timezone' => 'America/Guayaquil',
        ]);
    }

    if ($server['REQUEST_METHOD'] !== 'POST') {
        return voceros_response(405, ['ok' => false, 'message' => 'Método no permitido.'], ['Allow' => 'GET, HEAD, POST']);
    }

    if ($config === null) {
        return voceros_response(503, ['ok' => false, 'message' => 'El registro todavía no está habilitado.']);
    }

    $contentLength = isset($server['CONTENT_LENGTH']) ? (int) $server['CONTENT_LENGTH'] : 0;
    if ($contentLength > 65536) return voceros_response(413, ['ok' => false, 'message' => 'El envío supera el tamaño permitido.']);

    $allowedOrigins = ['https://complejomushucruna.com', 'https://www.complejomushucruna.com'];
    $origin = isset($server['HTTP_ORIGIN']) ? rtrim((string) $server['HTTP_ORIGIN'], '/') : '';
    if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
        return voceros_response(403, ['ok' => false, 'message' => 'Origen no permitido.']);
    }

    $honeypot = isset($post['website']) && is_string($post['website']) ? trim($post['website']) : '';
    if ($honeypot !== '') return voceros_response(200, ['ok' => true, 'message' => 'Registro recibido.']);

    try {
        $birthValue = clean_required($post, 'fecha_nacimiento', 10, 10);
        $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $birthValue, $timezone);
        $birthErrors = DateTimeImmutable::getLastErrors();
        if ($birth === false || (is_array($birthErrors) && ($birthErrors['warning_count'] > 0 || $birthErrors['error_count'] > 0))) {
            throw new InvalidArgumentException('Ingresa una fecha de nacimiento válida.');
        }
        $age = $birth->diff($now)->y;
        if ($birth > $now || $age < 16) throw new InvalidArgumentException('El programa recibe participantes desde los 16 años.');

        $data = [
            'nombre_completo' => clean_required($post, 'nombre_completo', 160, 5),
            'cedula' => clean_required($post, 'cedula', 10, 10),
            'fecha_nacimiento' => $birthValue,
            'edad' => (string) $age,
            'whatsapp' => clean_required($post, 'whatsapp', 10, 10),
            'correo' => clean_required($post, 'correo', 180),
            'ciudad' => clean_required($post, 'ciudad', 100),
            'tiktok' => clean_optional($post, 'tiktok', 300),
            'instagram' => clean_optional($post, 'instagram', 300),
            'facebook' => clean_optional($post, 'facebook', 300),
            'red_principal' => require_choice(clean_required($post, 'red_principal', 20), ['TikTok', 'Instagram', 'Facebook']),
            'vocero_previo' => require_choice(clean_required($post, 'vocero_previo', 60), ['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición']),
            'fuente_comunidad' => require_choice(clean_required($post, 'fuente_comunidad', 80), ['Facebook', 'Instagram', 'TikTok', 'Un amigo o familiar me invitó', 'Un vocero me contó', 'WhatsApp', 'Otro']),
            'retiro_kit' => require_choice(clean_required($post, 'retiro_kit', 80), ['En la oficina', 'En la feria, en la Zona de Creadores']),
            'consentimiento_politicas' => require_choice(clean_required($post, 'consentimiento_politicas', 4), ['Sí']),
            'autorizacion_imagen' => require_choice(clean_required($post, 'autorizacion_imagen', 4), ['Sí']),
            'consentimiento_datos' => require_choice(clean_required($post, 'consentimiento_datos', 4), ['Sí']),
        ];

        if (!valid_ecuadorian_id($data['cedula'])) throw new InvalidArgumentException('Ingresa una cédula de 10 dígitos.');
        if (preg_match('/^09\d{8}$/', $data['whatsapp']) !== 1) throw new InvalidArgumentException('Ingresa un WhatsApp con formato 09XXXXXXXX.');
        if (!filter_var($data['correo'], FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Ingresa un correo electrónico válido.');
        if ($data['tiktok'] === '' && $data['instagram'] === '' && $data['facebook'] === '') {
            throw new InvalidArgumentException('Ingresa al menos un perfil social.');
        }
        foreach (['tiktok', 'instagram', 'facebook'] as $profile) {
            if (!valid_https_url($data[$profile])) throw new InvalidArgumentException('Los perfiles sociales deben comenzar con https://.');
        }

        $representative = [
            'representante_nombre' => clean_optional($post, 'representante_nombre', 160),
            'representante_cedula' => clean_optional($post, 'representante_cedula', 10),
            'representante_telefono' => clean_optional($post, 'representante_telefono', 10),
            'representante_correo' => clean_optional($post, 'representante_correo', 180),
        ];
        if ($age < 18) {
            foreach ($representative as $value) {
                if ($value === '') throw new InvalidArgumentException('Completa los datos de tu representante legal.');
            }
            if (!valid_ecuadorian_id($representative['representante_cedula'])) throw new InvalidArgumentException('La cédula del representante debe tener 10 dígitos.');
            if (preg_match('/^09\d{8}$/', $representative['representante_telefono']) !== 1) throw new InvalidArgumentException('Revisa el teléfono del representante legal.');
            if (!filter_var($representative['representante_correo'], FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Revisa el correo del representante legal.');
        }

        $tracking = [];
        foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $field) {
            $tracking[$field] = clean_optional($post, $field, 180);
        }
        $urlOrigin = clean_optional($post, 'url_origen', 500);
        if ($urlOrigin === '' || !str_starts_with($urlOrigin, 'https://complejomushucruna.com/')) {
            $urlOrigin = 'https://complejomushucruna.com/finados/voceros/';
        }

        $registrationId = strtolower(clean_required($post, 'submission_id', 32, 32));
        if (!valid_submission_id($registrationId)) {
            throw new InvalidArgumentException('No fue posible identificar este envío. Recarga la página e inténtalo nuevamente.');
        }
        $submittedAt = $now->format(DateTimeInterface::ATOM);
        $status = $age < 18 ? 'Pendiente de autorización' : 'Nuevo';
        $ip = isset($server['REMOTE_ADDR']) ? substr((string) $server['REMOTE_ADDR'], 0, 64) : '';
        $userAgent = isset($server['HTTP_USER_AGENT']) ? substr((string) $server['HTTP_USER_AGENT'], 0, 500) : '';

        $consentDefinitions = [
            ['politicas', $config['policiesVersion'] . ' + ' . $config['thermometerVersion'], POLICY_TEXT],
            ['imagen', $config['imageVersion'], IMAGE_TEXT],
            ['datos', $config['privacyVersion'], DATA_TEXT],
        ];
        $consents = [];
        foreach ($consentDefinitions as [$type, $version, $text]) {
            $consents[] = [
                'consentimiento_tipo' => $type,
                'aceptado' => 'true',
                'texto_version' => $version,
                'texto_hash' => hash('sha256', $text),
                'fecha_hora' => $submittedAt,
                'ip_origen' => $ip,
                'user_agent' => $userAgent,
                'url_origen' => $urlOrigin,
                'metodo' => 'formulario_web',
                'id_registro' => $registrationId,
            ];
        }
        $record = [
            'submission_id' => $registrationId, 'status' => $status,
            'full_name' => $data['nombre_completo'], 'cedula' => $data['cedula'],
            'birth_date' => $birthValue, 'age_at_submission' => $age,
            'whatsapp' => $data['whatsapp'], 'email' => $data['correo'], 'city' => $data['ciudad'],
            'main_network' => $data['red_principal'], 'previous_participation' => $data['vocero_previo'],
            'community_source' => $data['fuente_comunidad'], 'kit_pickup' => $data['retiro_kit'],
            'tiktok' => $data['tiktok'], 'instagram' => $data['instagram'], 'facebook' => $data['facebook'],
            'representative_name' => $representative['representante_nombre'],
            'representative_cedula' => $representative['representante_cedula'],
            'representative_phone' => $representative['representante_telefono'],
            'representative_email' => $representative['representante_correo'],
            'submitted_at' => $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
            ...$tracking,
        ];
        $databaseConsents = array_map(static fn (array $consent): array => [
            'consent_type' => $consent['consentimiento_tipo'], 'accepted' => 1,
            'text_version' => $consent['texto_version'], 'text_hash' => $consent['texto_hash'],
            'accepted_at' => $record['submitted_at'], 'ip' => $ip, 'user_agent' => $userAgent,
            'source_url' => $urlOrigin, 'method' => 'formulario_web',
        ], $consents);
        $receipt = $repository->createPublic($record, $databaseConsents, $ip);
        $googleSheetsStatus = $receipt['sheets'];
        if ($googleSheetsStatus !== 'synced') {
            try {
                $googleSheetsStatus = $repository->syncSheets($registrationId, static function (array $payload) use ($sheets, $privateDirectory): string {
                    if ($sheets !== null) return $sheets($privateDirectory, 'voceros', $payload);
                    return Finados\SheetsTransport::deliver($privateDirectory, $payload);
                });
            } catch (Throwable $error) {
                // Both canonical data and encrypted outbox committed before this external attempt.
                $googleSheetsStatus = 'queued';
                error_log('Voceros: Sheets delivery deferred; durable job retained.');
            }
        }

        return voceros_response(200, [
            'ok' => true,
            'registrationId' => $registrationId,
            'database' => 'stored',
            'googleSheets' => $googleSheetsStatus,
            'message' => 'Registro recibido correctamente.',
        ]);
    } catch (Finados\DuplicateRegistration $error) {
        return voceros_response(409, ['ok' => false, 'message' => 'Ya existe un registro con los datos proporcionados.']);
    } catch (Finados\RegistrationRateLimit $error) {
        return voceros_response(429, ['ok' => false, 'message' => 'Se alcanzó el límite de envíos. Inténtalo en 15 minutos.'], ['Retry-After' => '900']);
    } catch (InvalidArgumentException $error) {
        return voceros_response(422, ['ok' => false, 'message' => $error->getMessage()]);
    } catch (Throwable $error) {
        error_log('Voceros: registration could not be persisted.');
        return voceros_response(500, ['ok' => false, 'message' => 'No fue posible completar el registro. Inténtalo nuevamente.']);
    }

}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $response = voceros_handle_request($_SERVER, $_POST);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    foreach ($response['headers'] as $name => $value) header($name . ': ' . $value);
    http_response_code($response['status']);
    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') echo json_encode($response['json'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
