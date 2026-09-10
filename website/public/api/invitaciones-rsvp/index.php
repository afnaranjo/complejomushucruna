<?php
declare(strict_types=1);

define('MUSHUC_API_ENTRY', true);
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . '_google-sheets.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

date_default_timezone_set('America/Guayaquil');
$timezone = new DateTimeZone('America/Guayaquil');
$now = new DateTimeImmutable('now', $timezone);

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function normalize_text(mixed $value, int $maxLength, bool $required = false): string
{
    $text = is_string($value) ? trim($value) : '';
    $normalized = preg_replace('/\s+/u', ' ', $text);
    if (!is_string($normalized)) {
        throw new InvalidArgumentException('Revisa la información e inténtalo nuevamente.');
    }
    if (($required && $normalized === '') || strlen($normalized) > $maxLength) {
        throw new InvalidArgumentException('Revisa la información e inténtalo nuevamente.');
    }
    return $normalized;
}

function csv_safe(string $value): string
{
    return preg_match('/^[=+\-@]/', $value) === 1 ? "'" . $value : $value;
}

function invitations_csv_headers(): array
{
    return ['Fecha de confirmación', 'ID de registro', 'Código', 'Nombre', 'Empresa', 'Cargo / referencia', 'Asistencia', 'Acompañantes', 'Total personas', 'Comentarios', 'Fuente'];
}

function ensure_csv_schema(string $csvPath): void
{
    if (!is_file($csvPath) || filesize($csvPath) === 0) return;

    $source = fopen($csvPath, 'rb');
    if ($source === false) throw new RuntimeException('No se pudo actualizar el archivo de confirmaciones.');
    $header = fgetcsv($source);
    if (!is_array($header)) {
        fclose($source);
        throw new RuntimeException('El archivo de confirmaciones no tiene una cabecera válida.');
    }
    $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
    if (($header[4] ?? '') === 'Empresa' && ($header[5] ?? '') === 'Cargo / referencia') {
        fclose($source);
        return;
    }
    if (($header[4] ?? '') !== 'Empresa / cargo' || ($header[5] ?? '') !== 'Asistencia') {
        fclose($source);
        throw new RuntimeException('La cabecera del archivo de confirmaciones no es compatible.');
    }

    $temporary = $csvPath . '.tmp-' . bin2hex(random_bytes(4));
    $target = fopen($temporary, 'xb');
    if ($target === false) {
        fclose($source);
        throw new RuntimeException('No se pudo migrar el archivo de confirmaciones.');
    }
    fwrite($target, "\xEF\xBB\xBF");
    fputcsv($target, invitations_csv_headers());
    while (($row = fgetcsv($source)) !== false) {
        if (count($row) < 10) continue;
        array_splice($row, 4, 0, ['']);
        fputcsv($target, $row);
    }
    fclose($source);
    fflush($target);
    fclose($target);
    if (!rename($temporary, $csvPath)) {
        @unlink($temporary);
        throw new RuntimeException('No se pudo activar la nueva estructura de confirmaciones.');
    }
    @chmod($csvPath, 0600);
}

function xml_text(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function register_rate_attempt(string $directory): void
{
    $address = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
    $rateDirectory = $directory . DIRECTORY_SEPARATOR . 'rate-invitaciones';
    if (!is_dir($rateDirectory) && !mkdir($rateDirectory, 0700, true) && !is_dir($rateDirectory)) {
        throw new RuntimeException('No se pudo preparar el control de envíos.');
    }

    $path = $rateDirectory . DIRECTORY_SEPARATOR . hash('sha256', $address) . '.json';
    $handle = fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) fclose($handle);
        throw new RuntimeException('No se pudo validar el envío.');
    }

    $contents = stream_get_contents($handle);
    $attempts = is_string($contents) && $contents !== '' ? json_decode($contents, true) : [];
    $attempts = is_array($attempts) ? $attempts : [];
    $threshold = time() - 3600;
    $attempts = array_values(array_filter($attempts, static fn ($value): bool => is_int($value) && $value >= $threshold));
    if (count($attempts) >= 10) {
        flock($handle, LOCK_UN);
        fclose($handle);
        json_response(429, ['ok' => false, 'message' => 'Se alcanzó el límite de confirmaciones. Inténtalo más tarde.']);
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

function guest_roster(): array
{
    return [
        ['soledad-falconi', 'Ing. Soledad Falconí', 'Directora Ejecutiva · Corpoambato'],
        ['eduardo-calvache', 'Ing. Eduardo Calvache', 'Director Ejecutivo · Cámara de Turismo'],
        ['guillermo-ramirez', 'Ing. Guillermo Ramírez', 'Presidente · Cámara de Turismo Tungurahua'],
        ['david-bucheli', 'Ing. David Bucheli', 'IA Nexus'],
        ['liliana-zuluaga', 'Ing. Liliana Zuluaga', 'Gerente · Ecuabet'],
        ['david-tapia', 'Ing. David Tapia', 'Coordinador de Patrocinios'],
        ['francisco-ponce', 'Sr. Francisco Ponce', 'Gerente · Seguros Unidos'],
        ['andres-solano', 'Ing. Andrés Solano', 'Gerente · Cogarol'],
        ['julio-lutuala', 'Ing. Julio Lutuala', 'Gerente · Pollos al Gusto'],
        ['edison-pinaluisa', 'Ing. Edison Piñaluisa', 'Socio Propietario'],
        ['marcela-lozada', 'Ing. Marcela Lozada', 'Gerente · Skybiz Travel'],
        ['omar-jaramillo', 'Ing. Omar Jaramillo', 'Gerente Comercial'],
        ['ana-luisa-limaico', 'Sra. Ana Luisa Limaico', 'Gerente · Ylaan'],
        ['luis-alfredo-moreno', 'Ing. Luis Alfredo Moreno', 'Cemento Chimborazo'],
        ['marco-galarraga', 'Ing. Marco Galárraga', 'Gerente · MG Automotriz'],
        ['gabriela-llichuspa', 'Ing. Gabriela Llichuspa', 'Boho'],
        ['diego-bonilla', 'Ing. Diego Bonilla', 'Boman Sport'],
        ['santiago-bonilla', 'Ing. Santiago Bonilla', 'Boman Sport'],
        ['andres-ballesteros', 'Ing. Andrés Ballesteros', 'Constructora Ballesteros'],
        ['lucy-sierra', 'Ing. Lucy Sierra', 'Directora Comercial · Salud SA'],
    ];
}

function read_submissions(string $csvPath): array
{
    if (!is_file($csvPath)) return [];
    $handle = fopen($csvPath, 'rb');
    if ($handle === false) throw new RuntimeException('No se pudo actualizar el archivo Excel.');

    $submissions = [];
    $header = fgetcsv($handle);
    if (is_array($header) && isset($header[0])) {
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
    }
    while (($row = fgetcsv($handle)) !== false) {
        if (count($row) < 11) continue;
        $submissions[] = [
            'submitted_at' => (string) $row[0],
            'id' => (string) $row[1],
            'slug' => (string) $row[2],
            'name' => (string) $row[3],
            'company' => (string) $row[4],
            'role' => (string) $row[5],
            'attendance' => (string) $row[6],
            'companions' => (int) $row[7],
            'total' => (int) $row[8],
            'comments' => (string) $row[9],
            'source' => (string) $row[10],
        ];
    }
    fclose($handle);
    return $submissions;
}

function cell(string $reference, string|int $value, int $style = 0, bool $numeric = false): string
{
    if ($numeric) {
        return '<c r="' . $reference . '" s="' . $style . '"><v>' . (int) $value . '</v></c>';
    }
    return '<c r="' . $reference . '" s="' . $style . '" t="inlineStr"><is><t xml:space="preserve">' . xml_text((string) $value) . '</t></is></c>';
}

function build_xlsx(string $xlsxPath, array $submissions): void
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('El servidor no dispone de la extensión ZipArchive para crear el archivo Excel.');
    }

    $latestBySlug = [];
    $unknown = [];
    foreach ($submissions as $submission) {
        $slug = $submission['slug'];
        if ($slug !== '') $latestBySlug[$slug] = $submission;
        else $unknown[] = $submission;
    }

    $rows = [];
    $knownSlugs = [];
    foreach (guest_roster() as [$slug, $name, $role]) {
        $knownSlugs[$slug] = true;
        $submission = $latestBySlug[$slug] ?? null;
        $rows[] = [
            'slug' => $slug,
            'name' => $submission['name'] ?? $name,
            'company' => $submission['company'] ?? '',
            'role' => $submission && $submission['role'] !== '' ? $submission['role'] : $role,
            'status' => $submission ? ($submission['attendance'] === 'si' ? 'Confirmado' : 'No asistirá') : 'Pendiente',
            'companions' => $submission['companions'] ?? 0,
            'total' => $submission['total'] ?? 0,
            'comments' => $submission['comments'] ?? '',
            'submitted_at' => $submission['submitted_at'] ?? '',
            'id' => $submission['id'] ?? '',
            'source' => $submission['source'] ?? 'Lista inicial',
        ];
    }
    foreach ($latestBySlug as $slug => $submission) {
        if (isset($knownSlugs[$slug])) continue;
        $rows[] = [
            'slug' => $slug,
            'name' => $submission['name'],
            'company' => $submission['company'],
            'role' => $submission['role'],
            'status' => $submission['attendance'] === 'si' ? 'Confirmado' : 'No asistirá',
            'companions' => $submission['companions'],
            'total' => $submission['total'],
            'comments' => $submission['comments'],
            'submitted_at' => $submission['submitted_at'],
            'id' => $submission['id'],
            'source' => $submission['source'],
        ];
    }
    foreach ($unknown as $submission) {
        $rows[] = [
            'slug' => '',
            'name' => $submission['name'],
            'company' => $submission['company'],
            'role' => $submission['role'],
            'status' => $submission['attendance'] === 'si' ? 'Confirmado' : 'No asistirá',
            'companions' => $submission['companions'],
            'total' => $submission['total'],
            'comments' => $submission['comments'],
            'submitted_at' => $submission['submitted_at'],
            'id' => $submission['id'],
            'source' => $submission['source'],
        ];
    }

    $confirmed = count(array_filter($rows, static fn (array $row): bool => $row['status'] === 'Confirmado'));
    $declined = count(array_filter($rows, static fn (array $row): bool => $row['status'] === 'No asistirá'));
    $pending = count(array_filter($rows, static fn (array $row): bool => $row['status'] === 'Pendiente'));
    $attendees = array_sum(array_column($rows, 'total'));

    $sheetRows = [];
    $sheetRows[] = '<row r="1" ht="34" customHeight="1">' . cell('A1', 'Confirmaciones · Invitaciones Finados 2026', 1) . '</row>';
    $sheetRows[] = '<row r="2" ht="24" customHeight="1">' . cell('A2', 'Brunch empresarial · Jueves 17 de septiembre · 10:30', 2) . '</row>';
    $sheetRows[] = '<row r="4">' . cell('A4', 'Invitados', 3) . cell('C4', 'Asistirán', 3) . cell('E4', 'No asistirán', 3) . cell('G4', 'Pendientes', 3) . cell('I4', 'Personas confirmadas', 3) . '</row>';
    $sheetRows[] = '<row r="5" ht="30" customHeight="1">' . cell('A5', count($rows), 4, true) . cell('C5', $confirmed, 4, true) . cell('E5', $declined, 4, true) . cell('G5', $pending, 4, true) . cell('I5', $attendees, 4, true) . '</row>';
    $headers = ['Código', 'Nombre', 'Empresa', 'Cargo / referencia', 'Estado', 'Acompañantes', 'Total personas', 'Comentarios', 'Fecha de confirmación', 'ID de registro', 'Fuente'];
    $headerCells = '';
    foreach ($headers as $index => $label) {
        $column = chr(65 + $index);
        $headerCells .= cell($column . '8', $label, 5);
    }
    $sheetRows[] = '<row r="8" ht="28" customHeight="1">' . $headerCells . '</row>';

    $excelRow = 9;
    foreach ($rows as $row) {
        $style = $excelRow % 2 === 1 ? 6 : 7;
        $statusStyle = $row['status'] === 'Confirmado' ? 8 : ($row['status'] === 'No asistirá' ? 9 : 10);
        $sheetRows[] = '<row r="' . $excelRow . '" ht="27" customHeight="1">'
            . cell('A' . $excelRow, $row['slug'], $style)
            . cell('B' . $excelRow, $row['name'], $style)
            . cell('C' . $excelRow, $row['company'], $style)
            . cell('D' . $excelRow, $row['role'], $style)
            . cell('E' . $excelRow, $row['status'], $statusStyle)
            . cell('F' . $excelRow, $row['companions'], $style, true)
            . cell('G' . $excelRow, $row['total'], $style, true)
            . cell('H' . $excelRow, $row['comments'], $style)
            . cell('I' . $excelRow, $row['submitted_at'], $style)
            . cell('J' . $excelRow, $row['id'], $style)
            . cell('K' . $excelRow, $row['source'], $style)
            . '</row>';
        $excelRow++;
    }
    $lastRow = max(9, $excelRow - 1);

    $worksheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="8" topLeftCell="C9" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>'
        . '<cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="27" customWidth="1"/><col min="3" max="4" width="30" customWidth="1"/><col min="5" max="5" width="16" customWidth="1"/><col min="6" max="7" width="15" customWidth="1"/><col min="8" max="8" width="38" customWidth="1"/><col min="9" max="9" width="27" customWidth="1"/><col min="10" max="10" width="21" customWidth="1"/><col min="11" max="11" width="17" customWidth="1"/></cols>'
        . '<sheetData>' . implode('', $sheetRows) . '</sheetData>'
        . '<mergeCells count="2"><mergeCell ref="A1:K1"/><mergeCell ref="A2:K2"/></mergeCells>'
        . '<autoFilter ref="A8:K' . $lastRow . '"/>'
        . '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'
        . '</worksheet>';

    $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<fonts count="4"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="11"/><color rgb="FF391F6F"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>'
        . '<fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF391F6F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4EADA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6E2CE0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8F2E8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF9F6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE8F1"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3CF"/><bgColor indexed="64"/></patternFill></fill></fills>'
        . '<borders count="2"><border/><border><left style="thin"><color rgb="FFD7CAE8"/></left><right style="thin"><color rgb="FFD7CAE8"/></right><top style="thin"><color rgb="FFD7CAE8"/></top><bottom style="thin"><color rgb="FFD7CAE8"/></bottom><diagonal/></border></borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="11">'
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        . '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'
        . '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'
        . '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>'
        . '<xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
        . '<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
        . '<xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '<xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '<xf numFmtId="0" fontId="2" fillId="8" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        . '</styleSheet>';

    $parts = [
        '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
        '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
        'docProps/core.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Confirmaciones Invitaciones Finados 2026</dc:title><dc:creator>Complejo Mushuc Runa</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' . gmdate('Y-m-d\TH:i:s\Z') . '</dcterms:created></cp:coreProperties>',
        'docProps/app.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Complejo Mushuc Runa</Application></Properties>',
        'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Confirmaciones" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        'xl/styles.xml' => $styles,
        'xl/worksheets/sheet1.xml' => $worksheet,
    ];

    $temporary = $xlsxPath . '.tmp-' . bin2hex(random_bytes(4));
    $zip = new ZipArchive();
    if ($zip->open($temporary, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('No se pudo crear el archivo Excel.');
    }
    foreach ($parts as $name => $contents) $zip->addFromString($name, $contents);
    $zip->close();
    if (!rename($temporary, $xlsxPath)) {
        @unlink($temporary);
        throw new RuntimeException('No se pudo actualizar el archivo Excel.');
    }
    @chmod($xlsxPath, 0600);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'HEAD') {
    $privateDirectory = dirname(__DIR__, 4) . DIRECTORY_SEPARATOR . 'private-data';
    $xlsxPath = $privateDirectory . DIRECTORY_SEPARATOR . 'confirmaciones-invitaciones-finados-2026.xlsx';
    $ready = class_exists('ZipArchive');
    if ($ready && !is_file($xlsxPath)) {
        try {
            if (!is_dir($privateDirectory) && !mkdir($privateDirectory, 0700, true) && !is_dir($privateDirectory)) {
                throw new RuntimeException('No se pudo preparar el almacenamiento.');
            }
            @chmod($privateDirectory, 0700);
            build_xlsx($xlsxPath, []);
        } catch (Throwable $error) {
            error_log('No se pudo preparar el Excel de invitaciones: ' . $error->getMessage());
            $ready = false;
        }
    }
    $payload = [
        'ok' => true,
        'ready' => $ready && is_file($xlsxPath),
        'workbook' => 'confirmaciones-invitaciones-finados-2026.xlsx',
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
if ($contentLength > 16384) {
    json_response(413, ['ok' => false, 'message' => 'El envío supera el tamaño permitido.']);
}

$allowedOrigins = ['https://complejomushucruna.com', 'https://www.complejomushucruna.com'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim((string) $_SERVER['HTTP_ORIGIN'], '/') : '';
if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    json_response(403, ['ok' => false, 'message' => 'Origen no permitido.']);
}

try {
    $raw = file_get_contents('php://input');
    $input = is_string($raw) ? json_decode($raw, true, 16, JSON_THROW_ON_ERROR) : null;
    if (!is_array($input)) throw new InvalidArgumentException('El envío no contiene información válida.');

    $slug = normalize_text($input['slug'] ?? '', 80);
    if ($slug !== '' && preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
        throw new InvalidArgumentException('La invitación no es válida.');
    }
    $name = normalize_text($input['name'] ?? '', 140, true);
    $company = normalize_text($input['company'] ?? '', 160);
    $role = normalize_text($input['role'] ?? '', 180);
    $attendance = normalize_text($input['asistencia'] ?? '', 2, true);
    if (!in_array($attendance, ['si', 'no'], true)) {
        throw new InvalidArgumentException('Selecciona una opción de asistencia válida.');
    }
    $companions = filter_var($input['acompanantes'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 4]]);
    if ($companions === false) throw new InvalidArgumentException('Selecciona una cantidad válida de acompañantes.');
    if ($attendance === 'no') $companions = 0;
    $comments = normalize_text($input['comentarios'] ?? '', 500);

    $privateDirectory = dirname(__DIR__, 4) . DIRECTORY_SEPARATOR . 'private-data';
    if (!is_dir($privateDirectory) && !mkdir($privateDirectory, 0700, true) && !is_dir($privateDirectory)) {
        throw new RuntimeException('No se pudo preparar el almacenamiento.');
    }
    @chmod($privateDirectory, 0700);
    register_rate_attempt($privateDirectory);

    $lockPath = $privateDirectory . DIRECTORY_SEPARATOR . 'confirmaciones-invitaciones.lock';
    $lock = fopen($lockPath, 'c+');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        throw new RuntimeException('No se pudo guardar la confirmación.');
    }

    $registrationId = bin2hex(random_bytes(8));
    $submittedAt = $now->format(DateTimeInterface::ATOM);
    $total = $attendance === 'si' ? $companions + 1 : 0;
    $csvPath = $privateDirectory . DIRECTORY_SEPARATOR . 'confirmaciones-invitaciones-finados-2026.csv';
    $xlsxPath = $privateDirectory . DIRECTORY_SEPARATOR . 'confirmaciones-invitaciones-finados-2026.xlsx';
    ensure_csv_schema($csvPath);
    $csv = fopen($csvPath, 'c+');
    if ($csv === false) {
        flock($lock, LOCK_UN);
        fclose($lock);
        throw new RuntimeException('No se pudo guardar la confirmación.');
    }
    $fileStats = fstat($csv);
    if (is_array($fileStats) && $fileStats['size'] === 0) {
        fwrite($csv, "\xEF\xBB\xBF");
        fputcsv($csv, invitations_csv_headers());
    }
    fseek($csv, 0, SEEK_END);
    fputcsv($csv, array_map('csv_safe', [
        $submittedAt,
        $registrationId,
        $slug,
        $name,
        $company,
        $role,
        $attendance,
        (string) $companions,
        (string) $total,
        $comments,
        'Formulario web',
    ]));
    fflush($csv);
    fclose($csv);
    @chmod($csvPath, 0600);

    build_xlsx($xlsxPath, read_submissions($csvPath));
    flock($lock, LOCK_UN);
    fclose($lock);
    @chmod($lockPath, 0600);

    $googleSheetsStatus = google_sheets_deliver($privateDirectory, 'brunch', [
        'submittedAt' => $submittedAt,
        'id' => $registrationId,
        'slug' => $slug,
        'name' => $name,
        'company' => $company,
        'role' => $role,
        'attendance' => $attendance,
        'companions' => $companions,
        'total' => $total,
        'comments' => $comments,
        'source' => 'Formulario web',
    ]);

    json_response(200, [
        'ok' => true,
        'registrationId' => $registrationId,
        'googleSheets' => $googleSheetsStatus,
        'message' => 'Confirmación registrada correctamente.',
    ]);
} catch (JsonException|InvalidArgumentException $error) {
    json_response(422, ['ok' => false, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Error interno en RSVP de invitaciones: ' . $error->getMessage());
    json_response(500, ['ok' => false, 'message' => 'No fue posible completar la confirmación. Inténtalo nuevamente.']);
}
