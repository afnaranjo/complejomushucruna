<?php
declare(strict_types=1);

if (!defined('MUSHUC_API_ENTRY')) {
    http_response_code(404);
    exit;
}

function google_sheets_config(string $privateDirectory): ?array
{
    $path = $privateDirectory . DIRECTORY_SEPARATOR . 'google-sheets-config.json';
    if (!is_file($path)) return null;
    $contents = file_get_contents($path);
    $config = is_string($contents) ? json_decode($contents, true) : null;
    if (!is_array($config)) return null;
    $url = isset($config['webAppUrl']) && is_string($config['webAppUrl']) ? trim($config['webAppUrl']) : '';
    $token = isset($config['token']) && is_string($config['token']) ? trim($config['token']) : '';
    if (preg_match('#^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$#', $url) !== 1 || strlen($token) < 32) {
        return null;
    }
    return ['webAppUrl' => $url, 'token' => $token];
}

function google_sheets_send(array $config, string $kind, array $record): bool
{
    $encoded = json_encode([
        'token' => $config['token'],
        'kind' => $kind,
        'record' => $record,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) return false;

    $body = false;
    $status = 0;
    if (function_exists('curl_init')) {
        $request = curl_init($config['webAppUrl']);
        if ($request === false) return false;
        curl_setopt_array($request, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $encoded,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_MAXREDIRS => 3,
        ]);
        $body = curl_exec($request);
        $status = (int) curl_getinfo($request, CURLINFO_RESPONSE_CODE);
        curl_close($request);
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $encoded,
                'ignore_errors' => true,
                'timeout' => 10,
            ],
        ]);
        $body = @file_get_contents($config['webAppUrl'], false, $context);
        $status = is_array($http_response_header ?? null) && preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $matches) === 1
            ? (int) $matches[1]
            : 0;
    }

    if ($status < 200 || $status >= 300 || !is_string($body)) return false;
    $response = json_decode($body, true);
    return is_array($response) && ($response['ok'] ?? false) === true;
}

function google_sheets_queue_path(string $privateDirectory): string
{
    return $privateDirectory . DIRECTORY_SEPARATOR . 'google-sheets-pending.jsonl';
}

function google_sheets_enqueue(string $privateDirectory, string $kind, array $record): void
{
    $line = json_encode(['kind' => $kind, 'record' => $record], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($line)) return;
    $path = google_sheets_queue_path($privateDirectory);
    $handle = fopen($path, 'ab');
    if ($handle === false) return;
    if (flock($handle, LOCK_EX)) {
        fwrite($handle, $line . "\n");
        fflush($handle);
        flock($handle, LOCK_UN);
    }
    fclose($handle);
    @chmod($path, 0600);
}

function google_sheets_flush_queue(string $privateDirectory, array $config, int $maximum = 3): void
{
    $path = google_sheets_queue_path($privateDirectory);
    if (!is_file($path)) return;
    $handle = fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX | LOCK_NB)) {
        if (is_resource($handle)) fclose($handle);
        return;
    }

    $contents = stream_get_contents($handle);
    $lines = is_string($contents) ? preg_split('/\R/', trim($contents)) : [];
    $remaining = [];
    $attempted = 0;
    foreach (is_array($lines) ? $lines : [] as $line) {
        if ($line === '') continue;
        $item = json_decode($line, true);
        if (!is_array($item) || !is_string($item['kind'] ?? null) || !is_array($item['record'] ?? null)) continue;
        if ($attempted < $maximum && google_sheets_send($config, $item['kind'], $item['record'])) {
            $attempted++;
            continue;
        }
        $remaining[] = $line;
        $attempted++;
    }

    rewind($handle);
    ftruncate($handle, 0);
    if ($remaining) fwrite($handle, implode("\n", $remaining) . "\n");
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    @chmod($path, 0600);
}

function google_sheets_deliver(string $privateDirectory, string $kind, array $record): string
{
    $config = google_sheets_config($privateDirectory);
    if ($config === null) {
        google_sheets_enqueue($privateDirectory, $kind, $record);
        return 'queued';
    }
    google_sheets_flush_queue($privateDirectory, $config);
    if (google_sheets_send($config, $kind, $record)) return 'synced';
    google_sheets_enqueue($privateDirectory, $kind, $record);
    return 'queued';
}
