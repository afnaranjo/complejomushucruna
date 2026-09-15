<?php

declare(strict_types=1);

require_once __DIR__ . '/Test.php';

function operations_fixture(array $overrides = []): array
{
    $root = sys_get_temp_dir() . '/finados-operations-' . bin2hex(random_bytes(8));
    mkdir($root, 0700);
    register_shutdown_function(static function () use ($root): void {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $entry) {
            if ($entry->isDir() && !$entry->isLink()) rmdir($entry->getPathname());
            else unlink($entry->getPathname());
        }
        rmdir($root);
    });
    $values = array_replace([
        'environment' => 'test', 'databaseDsn' => 'sqlite:' . $root . '/database.sqlite',
        'databaseUser' => '', 'databasePassword' => '', 'allowedOrigin' => 'http://127.0.0.1:4173',
        'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], $overrides);
    file_put_contents($root . '/config.json', json_encode($values, JSON_THROW_ON_ERROR));
    $pdo = new PDO('sqlite:' . $root . '/database.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
    return [$root, $pdo];
}

function operations_cli(string $name, array $arguments, ?array $environment = null): array
{
    $process = proc_open([PHP_BINARY, __DIR__ . '/../bin/' . $name . '.php', ...$arguments],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $environment);
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    return ['code' => proc_close($process), 'out' => $out, 'err' => $err];
}

function historical_csv(array $rows, bool $bom = true): string
{
    $stream = fopen('php://memory', 'w+');
    if ($bom) fwrite($stream, "\xEF\xBB\xBF");
    foreach ($rows as $row) fputcsv($stream, $row, ',', '"', '');
    rewind($stream);
    $contents = stream_get_contents($stream);
    fclose($stream);
    return $contents;
}

function historical_rows(): array
{
    $header = ['Fecha de envío', 'ID', 'Estado', 'Nombre completo', 'Cédula', 'Fecha de nacimiento', 'Edad',
        'WhatsApp', 'Correo', 'Ciudad', 'TikTok', 'Instagram', 'Facebook', 'Red principal',
        'Vocero anterior', 'Cómo se enteró', 'Retiro del kit', 'Representante', 'Cédula representante',
        'Teléfono representante', 'Correo representante', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term'];
    $row = ['2026-09-13T14:15:16-05:00', str_repeat('a', 32), 'Registrado', 'Persona Sintética A',
        '1800000001', '2000-01-02', '26', '0990000001', 'synthetic-a@example.invalid', 'Ciudad Sintética',
        "'@synthetic", '', '', 'TikTok', 'No, es mi primera vez', 'Otro', 'En la oficina', '', '', '', '', '', '', '', '', ''];
    $second = $row;
    $second[1] = str_repeat('b', 32); $second[2] = 'Pendiente de autorización del representante';
    $second[3] = 'Persona Sintética B'; $second[4] = '1800000002'; $second[5] = '2009-01-02'; $second[6] = '17';
    $second[7] = '0990000002'; $second[8] = 'synthetic-b@example.invalid';
    $second[17] = 'Representante Sintético'; $second[18] = '1800000003';
    $second[19] = '0990000003'; $second[20] = 'synthetic-rep@example.invalid';
    $consents = [['Tipo', 'Aceptado', 'Versión', 'SHA-256', 'Fecha y hora', 'IP', 'Navegador', 'URL', 'Método', 'ID de registro']];
    foreach ([$row[1], $second[1]] as $id) {
        foreach (['politicas', 'imagen', 'datos'] as $type) {
            $consents[] = [$type, 'true', 'synthetic-v1', str_repeat('c', 64), $row[0], '192.0.2.15', 'Synthetic browser', 'https://example.invalid/voceros/', 'formulario_web', $id];
        }
    }
    return [[$header, $row, $second], $consents];
}

function import_arguments(string $root, bool $dryRun = false): array
{
    return ['--config', $root . '/config.json', '--voceros', $root . '/voceros.csv',
        '--consents', $root . '/consents.csv', ...($dryRun ? ['--dry-run'] : [])];
}

function write_historical_files(string $root, array $voceros, array $consents): void
{
    file_put_contents($root . '/voceros.csv', historical_csv($voceros));
    file_put_contents($root . '/consents.csv', historical_csv($consents));
}
