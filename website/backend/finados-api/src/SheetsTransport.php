<?php
declare(strict_types=1);

namespace Finados;

/** Voceros-only transport: never writes the legacy shared JSONL queue. */
final class SheetsTransport
{
    public static function deliver(string $privateDirectory, array $record, ?callable $http = null): string
    {
        $path = $privateDirectory . '/google-sheets-config.json';
        if (!is_file($path)) return 'queued';
        $config = json_decode(file_get_contents($path), true);
        if (!is_array($config) || !is_string($config['webAppUrl'] ?? null) || !is_string($config['token'] ?? null)
            || preg_match('#^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$#D', $config['webAppUrl']) !== 1
            || strlen($config['token']) < 32) return 'queued';
        $encoded = json_encode(['token' => $config['token'], 'kind' => 'voceros', 'record' => $record], JSON_THROW_ON_ERROR);
        [$status, $body] = ($http ?? self::request(...))($config['webAppUrl'], $encoded);
        if ($status < 200 || $status >= 300 || !is_string($body)) return 'queued';
        $response = json_decode($body, true);
        // Generic ok is insufficient: only the receiver's durable receipt for this submission acknowledges work.
        return is_array($response) && ($response['ok'] ?? false) === true
            && ($response['submission_id'] ?? null) === $record['submission_id'] ? 'synced' : 'queued';
    }

    private static function request(string $url, string $encoded): array
    {
        if (function_exists('curl_init')) {
            $request = curl_init($url);
            if ($request === false) return [0, false];
            curl_setopt_array($request, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $encoded,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 10,
                CURLOPT_MAXREDIRS => 3, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS]);
            $body = curl_exec($request);
            $status = (int) curl_getinfo($request, CURLINFO_RESPONSE_CODE);
            curl_close($request);
            return [$status, $body];
        }
        $context = stream_context_create(['http' => ['method' => 'POST',
            'header' => "Content-Type: application/json\r\n", 'content' => $encoded,
            'ignore_errors' => true, 'timeout' => 10, 'max_redirects' => 3]]);
        $body = @file_get_contents($url, false, $context);
        $status = 0;
        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('/^HTTP\/\S+ (\d{3})/', $header, $matches)) $status = (int) $matches[1];
        }
        return [$status, $body];
    }
}
