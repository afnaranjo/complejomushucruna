<?php
declare(strict_types=1);

define('MUSHUC_API_ENTRY', true);
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . '_google-sheets.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

$timezone = new DateTimeZone('America/Guayaquil');
$now = new DateTimeImmutable('now', $timezone);
$privateDirectory = dirname(__DIR__, 4) . DIRECTORY_SEPARATOR . 'private-data';

const POLICY_TEXT = 'He leído y acepto las Políticas del Vocero y las Bases del Termómetro.';
const IMAGE_TEXT = 'Autorizo al responsable del programa a usar mi imagen, mi voz y el contenido que publique como vocero en sus canales oficiales y materiales de la feria, con mi crédito y sin pago adicional. He leído la Autorización de uso de imagen y contenido.';
const DATA_TEXT = 'Autorizo el tratamiento de mis datos personales para gestionar el programa de voceros, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador. He leído la Política de Privacidad y conozco mis derechos de acceso, rectificación, eliminación, oposición y portabilidad.';

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
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

function clean_required(string $name, int $maxLength, int $minLength = 1): string
{
    $value = isset($_POST[$name]) && is_string($_POST[$name]) ? trim($_POST[$name]) : '';
    $value = preg_replace('/\s+/u', ' ', $value);
    if (!is_string($value) || strlen($value) < $minLength || strlen($value) > $maxLength) {
        throw new InvalidArgumentException('Revisa los campos obligatorios e inténtalo nuevamente.');
    }
    return $value;
}

function clean_optional(string $name, int $maxLength): string
{
    $value = isset($_POST[$name]) && is_string($_POST[$name]) ? trim($_POST[$name]) : '';
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
    if (preg_match('/^\d{10}$/', $value) !== 1) return false;
    $province = (int) substr($value, 0, 2);
    $third = (int) $value[2];
    if ($province < 1 || $province > 24 || $third >= 6) return false;
    $total = 0;
    for ($index = 0; $index < 9; $index++) {
        $product = ((int) $value[$index]) * ($index % 2 === 0 ? 2 : 1);
        if ($product > 9) $product -= 9;
        $total += $product;
    }
    return ((10 - ($total % 10)) % 10) === (int) $value[9];
}

function valid_https_url(string $value): bool
{
    if ($value === '') return true;
    if (filter_var($value, FILTER_VALIDATE_URL) === false) return false;
    return strtolower((string) parse_url($value, PHP_URL_SCHEME)) === 'https';
}

function csv_safe(string $value): string
{
    return preg_match('/^[=+\-@]/', $value) === 1 ? "'" . $value : $value;
}

function append_csv(string $path, array $header, array $rows): void
{
    $handle = fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) fclose($handle);
        throw new RuntimeException('No se pudo guardar el registro.');
    }
    $stats = fstat($handle);
    if (is_array($stats) && $stats['size'] === 0) {
        fwrite($handle, "\xEF\xBB\xBF");
        fputcsv($handle, $header);
    }
    fseek($handle, 0, SEEK_END);
    foreach ($rows as $row) fputcsv($handle, array_map('csv_safe', array_map('strval', $row)));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    @chmod($path, 0600);
}

function register_rate_attempt(string $directory): void
{
    $address = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
    $rateDirectory = $directory . DIRECTORY_SEPARATOR . 'rate-voceros';
    if (!is_dir($rateDirectory) && !mkdir($rateDirectory, 0700, true) && !is_dir($rateDirectory)) {
        throw new RuntimeException('No se pudo preparar el control de envíos.');
    }
    $path = $rateDirectory . DIRECTORY_SEPARATOR . hash('sha256', $address) . '.json';
    $handle = fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) throw new RuntimeException('No se pudo validar el envío.');
    $contents = stream_get_contents($handle);
    $attempts = is_string($contents) && $contents !== '' ? json_decode($contents, true) : [];
    $attempts = is_array($attempts) ? $attempts : [];
    $threshold = time() - 3600;
    $attempts = array_values(array_filter($attempts, static fn($timestamp): bool => is_int($timestamp) && $timestamp >= $threshold));
    if (count($attempts) >= 5) {
        flock($handle, LOCK_UN);
        fclose($handle);
        json_response(429, ['ok' => false, 'message' => 'Se alcanzó el límite de envíos. Inténtalo más tarde.']);
    }
    $attempts[] = time();
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($attempts));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    @chmod($path, 0600);
}

$config = registration_config($privateDirectory);

if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'HEAD') {
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
        http_response_code(200);
        exit;
    }
    json_response(200, [
        'open' => $config !== null,
        'message' => $config !== null
            ? 'El registro está habilitado.'
            : 'El formulario se habilitará cuando estén publicados los documentos legales y la configuración privada de recepción.',
        'timezone' => 'America/Guayaquil',
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, HEAD, POST');
    json_response(405, ['ok' => false, 'message' => 'Método no permitido.']);
}

if ($config === null) {
    json_response(503, ['ok' => false, 'message' => 'El registro todavía no está habilitado.']);
}

$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > 65536) json_response(413, ['ok' => false, 'message' => 'El envío supera el tamaño permitido.']);

$allowedOrigins = ['https://complejomushucruna.com', 'https://www.complejomushucruna.com'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim((string) $_SERVER['HTTP_ORIGIN'], '/') : '';
if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    json_response(403, ['ok' => false, 'message' => 'Origen no permitido.']);
}

$honeypot = isset($_POST['website']) && is_string($_POST['website']) ? trim($_POST['website']) : '';
if ($honeypot !== '') json_response(200, ['ok' => true, 'message' => 'Registro recibido.']);

try {
    if (!is_dir($privateDirectory) && !mkdir($privateDirectory, 0700, true) && !is_dir($privateDirectory)) {
        throw new RuntimeException('No se pudo preparar el almacenamiento.');
    }
    @chmod($privateDirectory, 0700);
    register_rate_attempt($privateDirectory);

    $birthValue = clean_required('fecha_nacimiento', 10, 10);
    $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $birthValue, $timezone);
    $birthErrors = DateTimeImmutable::getLastErrors();
    if ($birth === false || (is_array($birthErrors) && ($birthErrors['warning_count'] > 0 || $birthErrors['error_count'] > 0))) {
        throw new InvalidArgumentException('Ingresa una fecha de nacimiento válida.');
    }
    $age = $birth->diff($now)->y;
    if ($birth > $now || $age < 16) throw new InvalidArgumentException('El programa recibe participantes desde los 16 años.');

    $data = [
        'nombre_completo' => clean_required('nombre_completo', 160, 5),
        'cedula' => clean_required('cedula', 10, 10),
        'fecha_nacimiento' => $birthValue,
        'edad' => (string) $age,
        'whatsapp' => clean_required('whatsapp', 10, 10),
        'correo' => clean_required('correo', 180),
        'ciudad' => clean_required('ciudad', 100),
        'tiktok' => clean_optional('tiktok', 300),
        'instagram' => clean_optional('instagram', 300),
        'facebook' => clean_optional('facebook', 300),
        'red_principal' => require_choice(clean_required('red_principal', 20), ['TikTok', 'Instagram', 'Facebook']),
        'vocero_previo' => require_choice(clean_required('vocero_previo', 60), ['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición']),
        'fuente_comunidad' => require_choice(clean_required('fuente_comunidad', 80), ['Facebook', 'Instagram', 'TikTok', 'Un amigo o familiar me invitó', 'Un vocero me contó', 'WhatsApp', 'Otro']),
        'retiro_kit' => require_choice(clean_required('retiro_kit', 80), ['En la oficina', 'En la feria, en la Zona de Creadores']),
        'consentimiento_politicas' => require_choice(clean_required('consentimiento_politicas', 4), ['Sí']),
        'autorizacion_imagen' => require_choice(clean_required('autorizacion_imagen', 4), ['Sí']),
        'consentimiento_datos' => require_choice(clean_required('consentimiento_datos', 4), ['Sí']),
    ];

    if (!valid_ecuadorian_id($data['cedula'])) throw new InvalidArgumentException('Ingresa una cédula ecuatoriana válida.');
    if (preg_match('/^09\d{8}$/', $data['whatsapp']) !== 1) throw new InvalidArgumentException('Ingresa un WhatsApp con formato 09XXXXXXXX.');
    if (!filter_var($data['correo'], FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Ingresa un correo electrónico válido.');
    if ($data['tiktok'] === '' && $data['instagram'] === '' && $data['facebook'] === '') {
        throw new InvalidArgumentException('Ingresa al menos un perfil social.');
    }
    foreach (['tiktok', 'instagram', 'facebook'] as $profile) {
        if (!valid_https_url($data[$profile])) throw new InvalidArgumentException('Los perfiles sociales deben comenzar con https://.');
    }

    $representative = [
        'representante_nombre' => clean_optional('representante_nombre', 160),
        'representante_cedula' => clean_optional('representante_cedula', 10),
        'representante_telefono' => clean_optional('representante_telefono', 10),
        'representante_correo' => clean_optional('representante_correo', 180),
    ];
    if ($age < 18) {
        foreach ($representative as $value) {
            if ($value === '') throw new InvalidArgumentException('Completa los datos de tu representante legal.');
        }
        if (!valid_ecuadorian_id($representative['representante_cedula'])) throw new InvalidArgumentException('Revisa la cédula del representante legal.');
        if (preg_match('/^09\d{8}$/', $representative['representante_telefono']) !== 1) throw new InvalidArgumentException('Revisa el teléfono del representante legal.');
        if (!filter_var($representative['representante_correo'], FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Revisa el correo del representante legal.');
    }

    $tracking = [];
    foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $field) {
        $tracking[$field] = clean_optional($field, 180);
    }
    $urlOrigin = clean_optional('url_origen', 500);
    if ($urlOrigin === '' || !str_starts_with($urlOrigin, 'https://complejomushucruna.com/')) {
        $urlOrigin = 'https://complejomushucruna.com/finados/voceros/';
    }

    $registrationId = bin2hex(random_bytes(16));
    $submittedAt = $now->format(DateTimeInterface::ATOM);
    $status = $age < 18 ? 'Pendiente de autorización del representante' : 'Registrado';
    $ip = isset($_SERVER['REMOTE_ADDR']) ? substr((string) $_SERVER['REMOTE_ADDR'], 0, 64) : '';
    $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 500) : '';

    $mainHeader = [
        'Fecha de envío', 'ID', 'Estado', 'Nombre completo', 'Cédula', 'Fecha de nacimiento', 'Edad',
        'WhatsApp', 'Correo', 'Ciudad', 'TikTok', 'Instagram', 'Facebook', 'Red principal',
        'Vocero anterior', 'Cómo se enteró', 'Retiro del kit', 'Representante', 'Cédula representante',
        'Teléfono representante', 'Correo representante', 'UTM source', 'UTM medium', 'UTM campaign',
        'UTM content', 'UTM term',
    ];
    $mainRow = [
        $submittedAt, $registrationId, $status, $data['nombre_completo'], $data['cedula'], $data['fecha_nacimiento'],
        $data['edad'], $data['whatsapp'], $data['correo'], $data['ciudad'], $data['tiktok'], $data['instagram'],
        $data['facebook'], $data['red_principal'], $data['vocero_previo'], $data['fuente_comunidad'], $data['retiro_kit'],
        $representative['representante_nombre'], $representative['representante_cedula'], $representative['representante_telefono'],
        $representative['representante_correo'], $tracking['utm_source'], $tracking['utm_medium'], $tracking['utm_campaign'],
        $tracking['utm_content'], $tracking['utm_term'],
    ];
    append_csv($privateDirectory . DIRECTORY_SEPARATOR . 'voceros-finados-2026.csv', $mainHeader, [$mainRow]);

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
    $consentHeader = ['Tipo', 'Aceptado', 'Versión', 'SHA-256', 'Fecha y hora', 'IP', 'Navegador', 'URL', 'Método', 'ID de registro'];
    $consentRows = array_map(static fn(array $consent): array => array_values($consent), $consents);
    append_csv($privateDirectory . DIRECTORY_SEPARATOR . 'consentimientos-voceros-finados-2026.csv', $consentHeader, $consentRows);

    $googleSheetsStatus = google_sheets_deliver($privateDirectory, 'voceros', [
        'submittedAt' => $submittedAt,
        'id' => $registrationId,
        'status' => $status,
        ...$data,
        ...$representative,
        ...$tracking,
        'consents' => $consents,
    ]);

    json_response(200, [
        'ok' => true,
        'registrationId' => $registrationId,
        'googleSheets' => $googleSheetsStatus,
        'message' => 'Registro recibido correctamente.',
    ]);
} catch (InvalidArgumentException $error) {
    json_response(422, ['ok' => false, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Error interno en registro de voceros: ' . $error->getMessage());
    json_response(500, ['ok' => false, 'message' => 'No fue posible completar el registro. Inténtalo nuevamente.']);
}
