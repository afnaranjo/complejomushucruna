<?php

declare(strict_types=1);

namespace Finados;

use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;

/**
 * Venta de entradas del Panel, leída de Ticketstar365 en solo lectura.
 *
 * El correo y la contraseña del empresario viven en `ticketstar-config.json`, junto a la
 * configuración privada del backend, nunca en Git ni en el navegador. El servidor inicia
 * sesión, guarda el JWT (vence en una hora) en un archivo privado y lo reutiliza; si
 * Ticketstar lo rechaza, vuelve a iniciar sesión una sola vez.
 *
 * Ticketstar solo lee el encabezado Authorization por HTTP/1.1: por HTTP/2 responde 401
 * aunque el token sea válido. Por eso cada llamada fuerza HTTP/1.1.
 */
final class TicketSales
{
    private const API = 'https://www.ticketstar365.com/api/public';
    private const TIMEZONE = 'America/Guayaquil';
    private const CACHE_SECONDS = 300;
    /** Margen antes del vencimiento del JWT para no usar uno a punto de caducar. */
    private const TOKEN_MARGIN = 120;

    /** @param null|callable(string, string, array<string,string>, ?string): array{0:int,1:string|false} $http */
    public function __construct(private readonly string $privateDirectory, private readonly mixed $http = null, private readonly ?DateTimeImmutable $now = null) {}

    public function report(bool $refresh = false): array
    {
        $config = $this->config();
        if ($config === null) return ['configured' => false];
        $cacheFile = $this->directory() . '/report.json';
        if (!$refresh && is_file($cacheFile) && filemtime($cacheFile) > time() - self::CACHE_SECONDS) {
            $cached = json_decode((string) file_get_contents($cacheFile), true);
            if (is_array($cached)) return [...$cached, 'cached' => true];
        }

        $token = $this->storedToken() ?? $this->login($config);
        [$status, $body] = $this->sales($token);
        if ($status === 401) [$status, $body] = $this->sales($this->login($config));
        if ($status !== 200 || !is_string($body)) throw new RuntimeException('Ticketstar no entregó las ventas.');
        $data = json_decode($body, true);
        if (!is_array($data) || ($data['success'] ?? null) !== true || !is_array($data['eventos'] ?? null)) throw new RuntimeException('Respuesta de Ticketstar no válida.');

        $report = ['configured' => true, 'generated_at' => $this->clock()->format(DATE_ATOM)] + self::normalize($data['eventos']);
        $this->write($cacheFile, json_encode($report, JSON_THROW_ON_ERROR));
        return [...$report, 'cached' => false];
    }

    /** Convierte la respuesta en eventos ordenados por fecha, con totales recalculados y comprobados. */
    public static function normalize(array $events): array
    {
        $out = [];
        $tickets = 0;
        $revenue = 0.0;
        foreach ($events as $event) {
            if (!is_array($event)) continue;
            $localities = [];
            foreach (is_array($event['localidades'] ?? null) ? $event['localidades'] : [] as $locality) {
                if (!is_array($locality)) continue;
                $prices = [];
                foreach (is_array($locality['precios'] ?? null) ? $locality['precios'] : [] as $price) {
                    if (!is_array($price)) continue;
                    $prices[] = [
                        'discount_id' => (int) ($price['id_descuento'] ?? 0),
                        'label' => trim((string) ($price['tipo_precio'] ?? '')) ?: 'PRECIO NORMAL',
                        'price' => round((float) ($price['precio'] ?? 0), 2),
                        'sold' => max(0, (int) ($price['cantidad_vendida'] ?? 0)),
                        'revenue' => round((float) ($price['total_vendido'] ?? 0), 2),
                    ];
                }
                $localities[] = [
                    'id' => (int) ($locality['id_localidad'] ?? 0),
                    'name' => trim((string) ($locality['localidad'] ?? '')) ?: 'Sin nombre',
                    'sold' => max(0, (int) ($locality['cantidad_vendida'] ?? 0)),
                    'revenue' => round((float) ($locality['total_vendido'] ?? 0), 2),
                    'prices' => $prices,
                ];
            }
            $name = trim((string) ($event['evento'] ?? '')) ?: 'Evento sin nombre';
            $totals = is_array($event['totales'] ?? null) ? $event['totales'] : [];
            $sold = max(0, (int) ($totals['cantidad_vendida'] ?? array_sum(array_column($localities, 'sold'))));
            $money = round((float) ($totals['total_vendido'] ?? array_sum(array_column($localities, 'revenue'))), 2);
            $out[] = [
                'id' => (int) ($event['id_evento'] ?? 0),
                'name' => $name,
                'date' => self::eventDate($name),
                'sold' => $sold,
                'revenue' => $money,
                // Si la suma de localidades no cuadra con el total de Ticketstar, el Panel lo avisa.
                'consistent' => $sold === array_sum(array_column($localities, 'sold')) && abs($money - array_sum(array_column($localities, 'revenue'))) < 0.01,
                'localities' => $localities,
            ];
            $tickets += $sold;
            $revenue += $money;
        }
        usort($out, static fn (array $a, array $b): int => [$a['date'] ?? '9999-99-99', $a['id']] <=> [$b['date'] ?? '9999-99-99', $b['id']]);
        return ['events' => $out, 'totals' => ['sold' => $tickets, 'revenue' => round($revenue, 2), 'events' => count($out)]];
    }

    /** «FERIA FINADOS 3-11-2026» → 2026-11-03; sin fecha reconocible, null. */
    public static function eventDate(string $name): ?string
    {
        if (preg_match('/(\d{1,2})-(\d{1,2})-(\d{4})/', $name, $match) !== 1) return null;
        return checkdate((int) $match[2], (int) $match[1], (int) $match[3]) ? sprintf('%04d-%02d-%02d', $match[3], $match[2], $match[1]) : null;
    }

    private function config(): ?array
    {
        $path = $this->privateDirectory . '/ticketstar-config.json';
        if (!is_file($path)) return null;
        $values = json_decode((string) file_get_contents($path), true);
        if (!is_array($values) || !is_string($values['email'] ?? null) || filter_var($values['email'], FILTER_VALIDATE_EMAIL) === false
            || !is_string($values['password'] ?? null) || $values['password'] === '' || strlen($values['password']) > 200) {
            throw new RuntimeException('La configuración de Ticketstar no es válida.');
        }
        return ['email' => $values['email'], 'password' => $values['password']];
    }

    private function login(array $config): string
    {
        [$status, $body] = $this->call('POST', '/ventas-auth/login', ['Content-Type: application/json', 'Accept: application/json'], json_encode($config, JSON_THROW_ON_ERROR));
        $data = is_string($body) ? json_decode($body, true) : null;
        $token = is_array($data) ? ($data['token'] ?? null) : null;
        if ($status !== 200 || !is_string($token) || preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $token) !== 1) {
            throw new RuntimeException('No se pudo iniciar sesión en Ticketstar.');
        }
        $lifetime = max(60, min(86400, (int) ($data['expires_in'] ?? 3600)));
        $this->write($this->directory() . '/token.json', json_encode(['token' => $token, 'expires_at' => $this->time() + $lifetime], JSON_THROW_ON_ERROR));
        return $token;
    }

    private function storedToken(): ?string
    {
        $path = $this->directory() . '/token.json';
        if (!is_file($path)) return null;
        $data = json_decode((string) file_get_contents($path), true);
        if (!is_array($data) || !is_string($data['token'] ?? null) || !is_int($data['expires_at'] ?? null)) return null;
        return $data['expires_at'] - self::TOKEN_MARGIN > $this->time() ? $data['token'] : null;
    }

    private function sales(string $token): array
    {
        return $this->call('GET', '/ventas-empresario', ['Authorization: Bearer ' . $token, 'Accept: application/json'], null);
    }

    private function call(string $method, string $path, array $headers, ?string $body): array
    {
        if ($this->http !== null) return ($this->http)($method, $path, $headers, $body);
        $handle = curl_init(self::API . $path);
        curl_setopt_array($handle, [
            CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 40, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        ] + ($body !== null ? [CURLOPT_POSTFIELDS => $body] : []));
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        return [$status, $response];
    }

    private function clock(): DateTimeImmutable
    {
        return ($this->now ?? new DateTimeImmutable('now'))->setTimezone(new DateTimeZone(self::TIMEZONE));
    }

    private function time(): int
    {
        return $this->clock()->getTimestamp();
    }

    private function directory(): string
    {
        $directory = $this->privateDirectory . '/ticketstar-cache';
        if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('No se pudo preparar la caché.');
        return $directory;
    }

    private function write(string $file, string $contents): void
    {
        $temporary = $file . '.' . bin2hex(random_bytes(6)) . '.tmp';
        if (@file_put_contents($temporary, $contents) === false) return;
        @chmod($temporary, 0600);
        if (!@rename($temporary, $file)) @unlink($temporary);
    }
}
