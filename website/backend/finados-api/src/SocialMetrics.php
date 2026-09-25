<?php

declare(strict_types=1);

namespace Finados;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use RuntimeException;

/**
 * Redes sociales del Panel, leídas de Metricool en solo lectura.
 *
 * Solo consulta la marca «Finados Mushuc Runa»: el identificador está fijo aquí y
 * cualquier otro valor en la configuración privada se rechaza. El token vive en
 * `metricool-config.json`, junto a la configuración privada del backend, nunca en Git.
 */
final class SocialMetrics
{
    public const FINADOS_BLOG_ID = 5238051;
    private const API = 'https://app.metricool.com/api/v2/analytics/timelines';
    private const TIMEZONE = 'America/Guayaquil';
    private const CACHE_SECONDS = 1800;
    private const MAX_DAYS = 366;
    private const BATCH = 6;

    /** [red, métrica de Metricool, clave interna, tipo]: `level` es un total del día, `sum` un flujo diario. */
    private const METRICS = [
        ['facebook', 'pageFollows', 'followers', 'level'],
        ['facebook', 'page_daily_follows_unique', 'gained', 'sum'],
        ['facebook', 'page_daily_unfollows_unique', 'lost', 'sum'],
        ['facebook', 'page_media_view', 'views', 'sum'],
        ['facebook', 'pageViews', 'profile_views', 'sum'],
        ['facebook', 'postsInteractions', 'interactions', 'sum'],
        ['facebook', 'postsCount', 'posts', 'sum'],
        ['instagram', 'Followers', 'followers', 'level'],
        ['instagram', 'followers_gained', 'gained', 'sum'],
        ['instagram', 'followers_lost', 'lost', 'sum'],
        ['instagram', 'reach', 'reach', 'sum'],
        ['instagram', 'views', 'views', 'sum'],
        ['instagram', 'accounts_engaged', 'accounts_engaged', 'sum'],
        ['instagram', 'postsInteractions', 'interactions', 'sum'],
        ['instagram', 'postsCount', 'posts', 'sum'],
        ['tiktok', 'followers_count', 'followers', 'level'],
        ['tiktok', 'video_views', 'views', 'sum'],
        ['tiktok', 'profile_views', 'profile_views', 'sum'],
        ['tiktok', 'likes', 'likes', 'sum'],
        ['tiktok', 'comments', 'comments', 'sum'],
        ['tiktok', 'shares', 'shares', 'sum'],
        ['youtube', 'totalSubscribers', 'followers', 'level'],
        ['youtube', 'subscribersGained', 'gained', 'sum'],
        ['youtube', 'subscribersLost', 'lost', 'sum'],
        ['youtube', 'views', 'views', 'sum'],
        ['facebookAds', 'spend', 'spend', 'sum'],
        ['facebookAds', 'impressions', 'impressions', 'sum'],
        ['facebookAds', 'reach', 'reach', 'sum'],
        ['facebookAds', 'clicks', 'clicks', 'sum'],
    ];

    private const NETWORKS = ['facebook' => 'Facebook', 'instagram' => 'Instagram', 'tiktok' => 'TikTok', 'youtube' => 'YouTube'];

    /** @param null|callable(list<string>, string): list<array{0:int,1:string|false}> $http */
    public function __construct(private readonly string $privateDirectory, private readonly mixed $http = null, private readonly ?DateTimeImmutable $now = null) {}

    public function report(string $from, string $to, bool $refresh = false): array
    {
        $config = $this->config();
        if ($config === null) return ['configured' => false];
        $zone = new DateTimeZone(self::TIMEZONE);
        $today = ($this->now ?? new DateTimeImmutable('now', $zone))->setTimezone($zone)->setTime(0, 0);
        $start = self::date($from, $zone);
        $end = self::date($to, $zone);
        if ($start > $end || $end > $today) throw new InvalidArgumentException();
        $days = (int) $start->diff($end)->days + 1;
        if ($days > self::MAX_DAYS) throw new InvalidArgumentException();
        $previousEnd = $start->modify('-1 day');
        $previousStart = $previousEnd->modify('-' . ($days - 1) . ' days');

        $cacheFile = $this->cacheDirectory() . '/' . hash('sha256', $start->format('Y-m-d') . '|' . $end->format('Y-m-d')) . '.json';
        if (!$refresh && is_file($cacheFile) && filemtime($cacheFile) > time() - self::CACHE_SECONDS) {
            $cached = json_decode((string) file_get_contents($cacheFile), true);
            if (is_array($cached)) return [...$cached, 'cached' => true];
        }

        // Una sola consulta por métrica cubre el periodo anterior y el actual, y se reparte después.
        $urls = [];
        foreach (self::METRICS as [$network, $metric]) {
            $urls[] = self::API . '?' . http_build_query([
                'userId' => $config['userId'], 'blogId' => self::FINADOS_BLOG_ID,
                'from' => $previousStart->format('Y-m-d') . 'T00:00:00', 'to' => $end->format('Y-m-d') . 'T23:59:59',
                'timezone' => self::TIMEZONE, 'network' => $network, 'subject' => 'account', 'metric' => $metric,
            ]);
        }
        $responses = ($this->http ?? self::request(...))($urls, $config['token']);
        $series = [];
        $failed = 0;
        foreach (self::METRICS as $index => [$network, , $key]) {
            [$status, $body] = $responses[$index] ?? [0, false];
            $values = $status === 200 && is_string($body) ? self::values($body) : null;
            if ($values === null) $failed++;
            $series[$network][$key] = $values;
        }
        if ($failed === count(self::METRICS)) throw new RuntimeException('Metricool no respondió.');

        $range = [$start->format('Y-m-d'), $end->format('Y-m-d')];
        $previous = [$previousStart->format('Y-m-d'), $previousEnd->format('Y-m-d')];
        $report = [
            'configured' => true,
            'brand' => 'Finados Mushuc Runa',
            'range' => ['from' => $range[0], 'to' => $range[1], 'days' => $days],
            'previous' => ['from' => $previous[0], 'to' => $previous[1]],
            'generated_at' => ($this->now ?? new DateTimeImmutable('now', $zone))->setTimezone($zone)->format(DATE_ATOM),
            'incomplete' => $failed > 0,
            'networks' => [],
            'ads' => self::ads($series['facebookAds'] ?? [], $range, $previous),
        ];
        foreach (self::NETWORKS as $network => $label) {
            $report['networks'][] = self::network($network, $label, $series[$network] ?? [], $range, $previous);
        }
        $report['totals'] = self::totals($report['networks'], $report['ads']);
        $this->store($cacheFile, $report);
        return [...$report, 'cached' => false];
    }

    private function config(): ?array
    {
        $path = $this->privateDirectory . '/metricool-config.json';
        if (!is_file($path)) return null;
        $values = json_decode((string) file_get_contents($path), true);
        if (!is_array($values) || !is_string($values['token'] ?? null) || preg_match('/^[A-Za-z0-9]{32,128}$/D', $values['token']) !== 1
            || !is_int($values['userId'] ?? null) || $values['userId'] < 1
            || ($values['blogId'] ?? null) !== self::FINADOS_BLOG_ID) {
            throw new RuntimeException('La configuración de Metricool no es válida.');
        }
        return $values;
    }

    private static function date(string $value, DateTimeZone $zone): DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $zone);
        if ($date === false || $date->format('Y-m-d') !== $value) throw new InvalidArgumentException();
        return $date;
    }

    /** @return array<string,float>|null fecha => valor, ordenado */
    private static function values(string $body): ?array
    {
        $data = json_decode($body, true);
        if (!is_array($data) || !is_array($data['data'] ?? null)) return null;
        $values = [];
        foreach ($data['data'][0]['values'] ?? [] as $point) {
            $date = substr((string) ($point['dateTime'] ?? ''), 0, 10);
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date) !== 1 || !is_numeric($point['value'] ?? null)) continue;
            $values[$date] = (float) $point['value'];
        }
        ksort($values);
        return $values;
    }

    private static function sum(?array $values, array $range): ?float
    {
        if ($values === null) return null;
        $total = null;
        // Sin ningún día con dato en el rango no hay cifra: no es lo mismo que cero (TikTok solo guarda unas semanas).
        foreach ($values as $date => $value) if ($date >= $range[0] && $date <= $range[1]) $total = ($total ?? 0.0) + $value;
        return $total === null ? null : round($total, 2);
    }

    /** El último total conocido hasta la fecha dada. */
    private static function levelAt(?array $values, string $date): ?float
    {
        $found = null;
        foreach ($values ?? [] as $day => $value) { if ($day > $date) break; $found = $value; }
        return $found;
    }

    private static function inRange(?array $values, array $range): array
    {
        $points = [];
        foreach ($values ?? [] as $date => $value) if ($date >= $range[0] && $date <= $range[1]) $points[] = [$date, $value];
        return $points;
    }

    private static function network(string $key, string $label, array $series, array $range, array $previous): array
    {
        $followers = $series['followers'] ?? null;
        $end = self::levelAt($followers, $range[1]);
        $startLevel = self::levelAt($followers, $previous[1]) ?? (self::inRange($followers, $range)[0][1] ?? null);
        $previousStart = self::levelAt($followers, date('Y-m-d', strtotime($previous[0] . ' -1 day'))) ?? (self::inRange($followers, $previous)[0][1] ?? null);
        $net = $end !== null && $startLevel !== null ? $end - $startLevel : null;
        $previousNet = $startLevel !== null && $previousStart !== null ? $startLevel - $previousStart : null;

        $pair = static fn (string $metric): array => ['current' => self::sum($series[$metric] ?? null, $range), 'previous' => self::sum($series[$metric] ?? null, $previous)];
        $metrics = [];
        foreach (['gained', 'lost', 'reach', 'views', 'profile_views', 'accounts_engaged', 'interactions', 'posts'] as $metric) {
            if (array_key_exists($metric, $series)) $metrics[$metric] = $pair($metric);
        }
        if ($key === 'tiktok') {
            $current = $previousValue = null;
            foreach (['likes', 'comments', 'shares'] as $part) {
                [$c, $p] = [self::sum($series[$part] ?? null, $range), self::sum($series[$part] ?? null, $previous)];
                if ($c !== null) $current = ($current ?? 0) + $c;
                if ($p !== null) $previousValue = ($previousValue ?? 0) + $p;
            }
            $metrics['interactions'] = ['current' => $current, 'previous' => $previousValue];
        }
        // Interacción sobre vistas: cuánta gente que vio el contenido hizo algo con él.
        $rate = static fn (?float $interactions, ?float $views): ?float => $interactions !== null && $views ? round($interactions / $views * 100, 2) : null;
        $metrics['engagement_rate'] = [
            'current' => $rate($metrics['interactions']['current'] ?? null, $metrics['views']['current'] ?? null),
            'previous' => $rate($metrics['interactions']['previous'] ?? null, $metrics['views']['previous'] ?? null),
        ];
        return [
            'key' => $key, 'label' => $label,
            'available' => $followers !== null || array_filter($series, static fn ($values) => $values !== null) !== [],
            'followers' => [
                'end' => $end, 'start' => $startLevel, 'net' => $net, 'previous_net' => $previousNet,
                'growth_pct' => $net !== null && $startLevel ? round($net / $startLevel * 100, 2) : null,
            ],
            'metrics' => $metrics,
            'series' => ['followers' => self::inRange($followers, $range), 'views' => self::inRange($series['views'] ?? null, $range)],
        ];
    }

    private static function ads(array $series, array $range, array $previous): array
    {
        $period = static function (array $bounds) use ($series): array {
            $spend = self::sum($series['spend'] ?? null, $bounds);
            $impressions = self::sum($series['impressions'] ?? null, $bounds);
            $clicks = self::sum($series['clicks'] ?? null, $bounds);
            return [
                'spend' => $spend, 'impressions' => $impressions, 'reach' => self::sum($series['reach'] ?? null, $bounds), 'clicks' => $clicks,
                'ctr' => $clicks !== null && $impressions ? round($clicks / $impressions * 100, 2) : null,
                'cpc' => $spend !== null && $clicks ? round($spend / $clicks, 3) : null,
                'cpm' => $spend !== null && $impressions ? round($spend / $impressions * 1000, 2) : null,
            ];
        };
        return ['current' => $period($range), 'previous' => $period($previous), 'series' => ['spend' => self::inRange($series['spend'] ?? null, $range)]];
    }

    private static function totals(array $networks, array $ads): array
    {
        $add = static function (array $values): ?float { $values = array_filter($values, static fn ($v) => $v !== null); return $values === [] ? null : round(array_sum($values), 2); };
        $followers = $add(array_map(static fn ($n) => $n['followers']['end'], $networks));
        $net = $add(array_map(static fn ($n) => $n['followers']['net'], $networks));
        $previousNet = $add(array_map(static fn ($n) => $n['followers']['previous_net'], $networks));
        $metric = static fn (string $key, string $period) => $add(array_map(static fn ($n) => $n['metrics'][$key][$period] ?? null, $networks));
        $spend = $ads['current']['spend'];
        $previousSpend = $ads['previous']['spend'];
        return [
            'followers' => $followers,
            'followers_net' => ['current' => $net, 'previous' => $previousNet],
            'views' => ['current' => $metric('views', 'current'), 'previous' => $metric('views', 'previous')],
            'interactions' => ['current' => $metric('interactions', 'current'), 'previous' => $metric('interactions', 'previous')],
            'posts' => ['current' => $metric('posts', 'current'), 'previous' => $metric('posts', 'previous')],
            'spend' => ['current' => $spend, 'previous' => $previousSpend],
            // Aproximado: incluye seguidores orgánicos, sirve para ver la tendencia del costo.
            'cost_per_follower' => [
                'current' => $spend !== null && $net > 0 ? round($spend / $net, 3) : null,
                'previous' => $previousSpend !== null && $previousNet > 0 ? round($previousSpend / $previousNet, 3) : null,
            ],
        ];
    }

    private function cacheDirectory(): string
    {
        $directory = $this->privateDirectory . '/metricool-cache';
        if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('No se pudo preparar la caché.');
        return $directory;
    }

    private function store(string $file, array $report): void
    {
        $temporary = $file . '.' . bin2hex(random_bytes(6)) . '.tmp';
        if (@file_put_contents($temporary, json_encode($report, JSON_THROW_ON_ERROR)) === false) return;
        @chmod($temporary, 0600);
        if (!@rename($temporary, $file)) @unlink($temporary);
    }

    /** Consultas GET en paralelo, por tandas, con el token en cabecera y nunca en la URL. */
    private static function request(array $urls, string $token): array
    {
        $results = [];
        foreach (array_chunk($urls, self::BATCH, true) as $batch) {
            $multi = curl_multi_init();
            $handles = [];
            foreach ($batch as $index => $url) {
                $handle = curl_init($url);
                curl_setopt_array($handle, [CURLOPT_HTTPHEADER => ['X-Mc-Auth: ' . $token, 'Accept: application/json'],
                    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 40,
                    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS]);
                curl_multi_add_handle($multi, $handle);
                $handles[$index] = $handle;
            }
            do {
                $status = curl_multi_exec($multi, $running);
                if ($running) curl_multi_select($multi, 1.0);
            } while ($running && $status === CURLM_OK);
            foreach ($handles as $index => $handle) {
                $results[$index] = [(int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE), curl_multi_getcontent($handle)];
                curl_multi_remove_handle($multi, $handle);
            }
            curl_multi_close($multi);
        }
        ksort($results);
        return array_values($results);
    }
}
