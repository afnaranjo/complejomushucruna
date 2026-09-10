<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

$timezone = new DateTimeZone('America/Guayaquil');
$deadline = new DateTimeImmutable('2026-09-15 18:00:00', $timezone);
$now = new DateTimeImmutable('now', $timezone);

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_field(string $name, int $maxLength): string
{
    $value = isset($_POST[$name]) && is_string($_POST[$name]) ? trim($_POST[$name]) : '';
    $normalized = preg_replace('/\s+/u', ' ', $value);
    if (!is_string($normalized) || $normalized === '' || strlen($normalized) > $maxLength) {
        throw new InvalidArgumentException('Revisa los campos obligatorios e inténtalo nuevamente.');
    }
    return $normalized;
}

function require_choice(string $value, array $allowed): string
{
    if (!in_array($value, $allowed, true)) {
        throw new InvalidArgumentException('Selecciona una opción válida.');
    }
    return $value;
}

function csv_safe(string $value): string
{
    return preg_match('/^[=+\-@]/', $value) === 1 ? "'" . $value : $value;
}

function register_rate_attempt(string $directory): void
{
    $address = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
    $rateDirectory = $directory . DIRECTORY_SEPARATOR . 'rate';
    if (!is_dir($rateDirectory) && !mkdir($rateDirectory, 0700, true) && !is_dir($rateDirectory)) {
        throw new RuntimeException('No se pudo preparar el control de envíos.');
    }

    $path = $rateDirectory . DIRECTORY_SEPARATOR . hash('sha256', $address) . '.json';
    $handle = fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('No se pudo validar el envío.');
    }

    $contents = stream_get_contents($handle);
    $attempts = is_string($contents) && $contents !== '' ? json_decode($contents, true) : [];
    $attempts = is_array($attempts) ? $attempts : [];
    $threshold = time() - 3600;
    $attempts = array_values(array_filter($attempts, static function ($timestamp) use ($threshold): bool {
        return is_int($timestamp) && $timestamp >= $threshold;
    }));

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

if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'HEAD') {
    $payload = [
        'open' => $now < $deadline,
        'deadline' => '2026-09-15T18:00:00-05:00',
        'timezone' => 'America/Guayaquil',
    ];
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
        http_response_code(200);
        exit;
    }
    json_response(200, $payload);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, HEAD, POST');
    json_response(405, ['ok' => false, 'message' => 'Método no permitido.']);
}

$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > 32768) {
    json_response(413, ['ok' => false, 'message' => 'El envío supera el tamaño permitido.']);
}

$allowedOrigins = ['https://complejomushucruna.com', 'https://www.complejomushucruna.com'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim((string) $_SERVER['HTTP_ORIGIN'], '/') : '';
if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    json_response(403, ['ok' => false, 'message' => 'Origen no permitido.']);
}

if ($now >= $deadline) {
    json_response(410, ['ok' => false, 'closed' => true, 'message' => 'El registro de acreditaciones ya finalizó.']);
}

$honeypot = isset($_POST['website']) && is_string($_POST['website']) ? trim($_POST['website']) : '';
if ($honeypot !== '') {
    json_response(200, ['ok' => true, 'message' => 'Registro recibido.']);
}

try {
    $data = [
        'nombre_medio' => clean_field('nombre_medio', 140),
        'tipo_medio' => require_choice(clean_field('tipo_medio', 40), ['Radio', 'TV', 'Prensa escrita', 'Digital', 'Redes sociales']),
        'frecuencia_canal' => clean_field('frecuencia_canal', 120),
        'nombre_programa' => clean_field('nombre_programa', 160),
        'tipo_programa' => require_choice(clean_field('tipo_programa', 40), ['Noticias', 'Magazine', 'Cultural', 'Deportivo', 'Entretenimiento', 'Opinión']),
        'provincia' => require_choice(clean_field('provincia', 60), [
            'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas',
            'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago',
            'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas',
            'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe',
        ]),
        'ciudad' => clean_field('ciudad', 100),
        'contrato_mushuc' => require_choice(clean_field('contrato_mushuc', 4), ['Sí', 'No']),
        'numero_personas' => require_choice(clean_field('numero_personas', 1), ['1', '2']),
        'equipo' => clean_field('equipo', 500),
        'telefono' => clean_field('telefono', 25),
        'correo' => clean_field('correo', 180),
        'acepta_condiciones' => require_choice(clean_field('acepta_condiciones', 4), ['Sí']),
    ];

    if (!filter_var($data['correo'], FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Ingresa un correo electrónico válido.');
    }
    if (preg_match('/^[0-9+() .\-]{7,25}$/', $data['telefono']) !== 1) {
        throw new InvalidArgumentException('Ingresa un teléfono o WhatsApp válido.');
    }

    $privateDirectory = dirname(__DIR__, 4) . DIRECTORY_SEPARATOR . 'private-data';
    if (!is_dir($privateDirectory) && !mkdir($privateDirectory, 0700, true) && !is_dir($privateDirectory)) {
        throw new RuntimeException('No se pudo preparar el almacenamiento.');
    }
    @chmod($privateDirectory, 0700);
    register_rate_attempt($privateDirectory);

    $registrationId = bin2hex(random_bytes(8));
    $submittedAt = $now->format(DateTimeInterface::ATOM);
    $csvPath = $privateDirectory . DIRECTORY_SEPARATOR . 'acreditacion-medios-finados-2026.csv';
    $csv = fopen($csvPath, 'c+');
    if ($csv === false || !flock($csv, LOCK_EX)) {
        if (is_resource($csv)) {
            fclose($csv);
        }
        throw new RuntimeException('No se pudo guardar el registro.');
    }

    $header = [
        'Fecha de envío', 'ID', 'Nombre del medio', 'Tipo de medio', 'Frecuencia / canal',
        'Programa o espacio', 'Tipo de programa', 'Provincia', 'Ciudad', 'Contrato vigente',
        'Personas', 'Nombres y cargos', 'Teléfono / WhatsApp', 'Correo', 'Aceptó condiciones',
    ];
    $row = [
        $submittedAt,
        $registrationId,
        $data['nombre_medio'],
        $data['tipo_medio'],
        $data['frecuencia_canal'],
        $data['nombre_programa'],
        $data['tipo_programa'],
        $data['provincia'],
        $data['ciudad'],
        $data['contrato_mushuc'],
        $data['numero_personas'],
        $data['equipo'],
        $data['telefono'],
        $data['correo'],
        $data['acepta_condiciones'],
    ];

    $fileStats = fstat($csv);
    if (is_array($fileStats) && $fileStats['size'] === 0) {
        fwrite($csv, "\xEF\xBB\xBF");
        fputcsv($csv, $header);
    }
    fseek($csv, 0, SEEK_END);
    fputcsv($csv, array_map('csv_safe', $row));
    fflush($csv);
    flock($csv, LOCK_UN);
    fclose($csv);
    @chmod($csvPath, 0600);

    $messageLines = [
        'Nueva solicitud de acreditación de medios',
        '',
        'ID: ' . $registrationId,
        'Fecha: ' . $submittedAt,
        'Medio: ' . $data['nombre_medio'],
        'Tipo de medio: ' . $data['tipo_medio'],
        'Frecuencia / canal: ' . $data['frecuencia_canal'],
        'Programa o espacio: ' . $data['nombre_programa'],
        'Tipo de programa: ' . $data['tipo_programa'],
        'Provincia: ' . $data['provincia'],
        'Ciudad: ' . $data['ciudad'],
        'Contrato vigente con Mushuc Runa: ' . $data['contrato_mushuc'],
        'Número de personas: ' . $data['numero_personas'],
        'Equipo: ' . $data['equipo'],
        'Teléfono / WhatsApp: ' . $data['telefono'],
        'Correo: ' . $data['correo'],
        'Aceptó condiciones: ' . $data['acepta_condiciones'],
    ];
    $subject = '=?UTF-8?B?' . base64_encode('Nueva acreditación de medios · ' . $data['nombre_medio']) . '?=';
    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: Acreditaciones Finados <no-reply@complejomushucruna.com>',
        'Reply-To: ' . $data['correo'],
    ]);
    $mailSent = function_exists('mail') && mail(
        'finadosmushucruna@gmail.com',
        $subject,
        implode("\n", $messageLines),
        $headers
    );

    if (!$mailSent) {
        error_log('Acreditación ' . $registrationId . ': la copia de correo quedó pendiente.');
    }

    json_response(200, [
        'ok' => true,
        'registrationId' => $registrationId,
        'emailBackup' => $mailSent,
        'message' => 'Acreditación registrada correctamente.',
    ]);
} catch (InvalidArgumentException $error) {
    json_response(422, ['ok' => false, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Error interno en acreditación de medios: ' . $error->getMessage());
    json_response(500, ['ok' => false, 'message' => 'No fue posible completar el registro. Inténtalo nuevamente.']);
}
