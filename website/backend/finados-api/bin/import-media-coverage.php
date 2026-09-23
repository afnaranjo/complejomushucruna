<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;
use Throwable;

require_once __DIR__ . '/operations.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Crypto.php';
require_once __DIR__ . '/../src/Audit.php';
require_once __DIR__ . '/../src/VocerosRepository.php';
require_once __DIR__ . '/../src/MediaRepository.php';

/**
 * Loads a coverage sheet (as exported from Google Sheets) into Medios without creating duplicates:
 * rows are linked to existing records by name, merged according to a mapping file, or created by
 * coordination; every row becomes a coverage entry of one event. Dry run by default.
 *
 *   php bin/import-media-coverage.php --csv cobertura.csv --mapping mapping.json --event "Lanzamiento Finados 2026" [--event-date 2026-09-17] [--actor admin] [--apply]
 */
final class ImportMediaCoverageCommand
{
    private const HEADER = ['MEDIO', 'TIPO', 'FRECUENCIA', 'PROGRAMA', 'Provincia', 'CONTRATO', 'N', 'REPRESENTANTE', 'link de publicación', 'SEGUIDORES'];
    private const CITY_PROVINCE = ['riobamba' => 'Chimborazo', 'alausi' => 'Chimborazo', 'alausí' => 'Chimborazo', 'ambato' => 'Tungurahua', 'pelileo' => 'Tungurahua', 'píllaro' => 'Tungurahua', 'pillaro' => 'Tungurahua',
        'quito' => 'Pichincha', 'guaranda' => 'Bolívar', 'guaranda- simiatug' => 'Bolívar', 'latacunga' => 'Cotopaxi', 'salcedo' => 'Cotopaxi', 'pujilí' => 'Cotopaxi', 'pujili' => 'Cotopaxi', 'puyo' => 'Pastaza', 'guayaquil' => 'Guayas'];
    private const TYPES = ['radio' => 'radio', 'tv' => 'tv', 'televisión' => 'tv', 'television' => 'tv', 'digital' => 'digital', 'prensa escrita' => 'prensa', 'prensa' => 'prensa', 'redes sociales' => 'redes', 'redes' => 'redes'];

    public static function run(array $arguments): int
    {
        try {
            // Optional valued arguments are taken out first; Operations::options only knows required ones.
            $optional = ['--event-date' => null, '--actor' => 'admin'];
            foreach (array_keys($optional) as $key) {
                $index = array_search($key, $arguments, true);
                if ($index === false) continue;
                if (!isset($arguments[$index + 1]) || str_starts_with($arguments[$index + 1], '--')) throw new RuntimeException('Invalid arguments.');
                $optional[$key] = $arguments[$index + 1];
                array_splice($arguments, $index, 2);
            }
            $options = Operations::options($arguments, ['--csv', '--mapping', '--event'], ['--apply', '--dry-run']);
            [$config] = Operations::configuration($options);
            $apply = isset($options['--apply']);
            $eventName = trim((string) $options['--event']);
            $eventDate = $optional['--event-date'];
            $actorName = (string) $optional['--actor'];
            $rows = self::rows(self::read($options['--csv']));
            $mapping = json_decode(self::read($options['--mapping']), true, 8, JSON_THROW_ON_ERROR);
            $link = array_change_key_case((array) ($mapping['link'] ?? []), CASE_LOWER);
            $merge = array_change_key_case((array) ($mapping['merge'] ?? []), CASE_LOWER);
            $extraRepresentatives = array_change_key_case((array) ($mapping['representative_of'] ?? []), CASE_LOWER);
            $rename = array_change_key_case((array) ($mapping['rename'] ?? []), CASE_LOWER);
            $pdo = Database::connect($config);
            $crypto = new Crypto($config);
            $repository = new MediaRepository($pdo, $crypto);
            $actor = $pdo->prepare('SELECT id FROM admin_users WHERE username = ? AND active = 1');
            $actor->execute([$actorName]);
            $actorId = $actor->fetchColumn();
            if ($actorId === false) throw new RuntimeException('Unknown administrative actor.');
            $actorId = (int) $actorId;
            $existing = [];
            foreach ($pdo->query("SELECT public_id, media_name FROM media_profiles WHERE status <> 'Eliminado'") as $row) $existing[mb_strtolower(trim($row['media_name']))] = ['public_id' => $row['public_id'], 'media_name' => $row['media_name']];

            // 1. Group sheet rows: merged rows collapse into their canonical row.
            $groups = [];
            foreach ($rows as $row) {
                $key = mb_strtolower($row['name']);
                $canonical = $rename[$key] ?? $merge[$key] ?? $row['name'];
                $groupKey = mb_strtolower($canonical);
                if (isset($extraRepresentatives[$key])) { $canonical = $extraRepresentatives[$key]; $groupKey = mb_strtolower($canonical); $row['representative_only'] = true; }
                $groups[$groupKey] ??= ['name' => $canonical, 'rows' => []];
                $groups[$groupKey]['rows'][] = $row;
            }
            $plan = []; $warnings = [];
            foreach ($groups as $groupKey => $group) {
                $merged = self::mergeRows($group['name'], $group['rows']);
                $target = $link[$groupKey] ?? null;
                $match = $target !== null ? ($existing[mb_strtolower($target)] ?? null) : ($existing[$groupKey] ?? null);
                if ($target !== null && $match === null) $warnings[] = "Mapeo sin destino en producción: {$group['name']} → {$target}";
                $plan[] = ['group' => $merged, 'action' => $match ? 'COMPLEMENTAR' : 'CREAR', 'match' => $match, 'sources' => array_map(static fn (array $row): string => $row['name'], $group['rows'])];
                foreach ($merged['warnings'] as $warning) $warnings[] = "{$group['name']}: {$warning}";
            }
            // 2. Report.
            $counts = ['CREAR' => 0, 'COMPLEMENTAR' => 0];
            foreach ($plan as $entry) {
                $counts[$entry['action']]++;
                $sources = count($entry['sources']) > 1 ? ' [fusiona: ' . implode(' + ', $entry['sources']) . ']' : '';
                $destination = $entry['match'] ? ' → ' . $entry['match']['media_name'] : '';
                fwrite(STDOUT, sprintf("%-12s %-45s contrato=%-4s resultado=%-15s links=%d seguidores=%s%s%s\n", $entry['action'], mb_substr($entry['group']['name'], 0, 45), $entry['group']['contracted'] ?? '—', $entry['group']['result'], count($entry['group']['links']), $entry['group']['followers'] ?? '—', $destination, $sources));
            }
            fwrite(STDOUT, "\nFilas de la hoja: " . count($rows) . " · Medios resultantes: " . count($plan) . " · Crear: {$counts['CREAR']} · Complementar existentes: {$counts['COMPLEMENTAR']}\n");
            foreach ($warnings as $warning) fwrite(STDOUT, "AVISO: {$warning}\n");
            if (!$apply) { fwrite(STDOUT, "\nSimulación: no se escribió nada. Añade --apply para ejecutar.\n"); return 0; }

            // 3. Apply.
            $events = array_column($repository->listEvents(), null, 'name');
            $event = $events[$eventName] ?? $repository->createEvent(['name' => $eventName, 'event_date' => $eventDate], $actorId, '127.0.0.1');
            $created = 0; $complemented = 0; $covered = 0;
            foreach ($plan as $entry) {
                $group = $entry['group'];
                if ($entry['match']) {
                    $publicId = $entry['match']['public_id'];
                    self::complement($pdo, $publicId, $group);
                    $complemented++;
                } else {
                    $detail = $repository->createByAdmin([
                        'media_name' => $group['name'], 'media_types' => $group['types'], 'frequency' => $group['frequency'], 'tv_channel' => $group['tv_channel'],
                        'province' => $group['province'], 'city' => $group['city'], 'program_name' => $group['program'], 'representatives' => $group['representatives'],
                        'channels' => [], 'followers_validated' => $group['followers'], 'paid_media' => 'no', 'contact_name' => '', 'phone' => '', 'contact_email' => '',
                    ], $actorId, '127.0.0.1');
                    $publicId = $detail['public_id'];
                    $created++;
                }
                $repository->upsertCoverage($event['public_id'], $publicId, ['contracted' => $group['contracted'], 'result' => $group['result'], 'people_count' => $group['people'], 'links' => $group['links'], 'note' => $group['note']], $actorId, '127.0.0.1');
                $covered++;
            }
            fwrite(STDOUT, "\nAplicado: creados {$created} · complementados {$complemented} · coberturas {$covered} en «{$event['name']}».\n");
            return 0;
        } catch (Throwable $error) {
            fwrite(STDERR, 'import-media-coverage: ' . $error->getMessage() . "\n");
            return 1;
        }
    }

    /** Existing records only receive what they lack; nothing the medium wrote is overwritten. */
    private static function complement(\PDO $pdo, string $publicId, array $group): void
    {
        $row = $pdo->prepare('SELECT id, program_name, representatives, followers_validated FROM media_profiles WHERE public_id = ?');
        $row->execute([$publicId]);
        $current = $row->fetch();
        if ($current === false) throw new RuntimeException('Record vanished during import.');
        $values = [];
        if (trim((string) $current['program_name']) === '' && $group['program'] !== '') $values['program_name'] = $group['program'];
        $representatives = json_decode((string) ($current['representatives'] ?? '') ?: '[]', true) ?: [];
        if ($representatives === [] && $group['representatives'] !== []) $values['representatives'] = json_encode($group['representatives'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if ($current['followers_validated'] === null && $group['followers'] !== null) $values['followers_validated'] = $group['followers'];
        if ($values === []) return;
        $values['updated_at'] = gmdate('Y-m-d H:i:s');
        $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($values)));
        $pdo->prepare('UPDATE media_profiles SET ' . $assignments . ' WHERE id = ?')->execute([...array_values($values), $current['id']]);
    }

    private static function mergeRows(string $name, array $rows): array
    {
        $group = ['name' => $name, 'types' => [], 'frequency' => '', 'tv_channel' => '', 'province' => '', 'city' => '', 'program' => '', 'representatives' => [], 'followers' => null,
            'contracted' => null, 'result' => 'pendiente', 'people' => 0, 'links' => [], 'note' => '', 'warnings' => []];
        $notes = [];
        foreach ($rows as $row) {
            if (empty($row['representative_only'])) {
                foreach ($row['types'] as $type) if (!in_array($type, $group['types'], true)) $group['types'][] = $type;
                if ($group['frequency'] === '' && in_array('radio', $row['types'], true)) $group['frequency'] = $row['frequency'];
                if ($group['tv_channel'] === '' && in_array('tv', $row['types'], true)) $group['tv_channel'] = $row['frequency'];
                if ($group['city'] === '') { $group['city'] = $row['city']; $group['province'] = $row['province']; }
                if ($group['program'] === '') $group['program'] = $row['program'];
                if ($group['followers'] === null) $group['followers'] = $row['followers'];
            }
            foreach ($row['representatives'] as $person) $group['representatives'][] = $person;
            if ($row['contracted'] === 'yes' || ($row['contracted'] === 'no' && $group['contracted'] === null)) $group['contracted'] = $row['contracted'];
            $group['people'] += $row['people'];
            foreach ($row['links'] as $url) if (!in_array($url, $group['links'], true)) $group['links'][] = $url;
            if ($row['note'] !== '') $notes[] = $row['note'];
            $group['result'] = self::strongerResult($group['result'], $row['result']);
            foreach ($row['warnings'] as $warning) $group['warnings'][] = $warning;
        }
        if ($group['types'] === []) { $group['types'] = ['digital']; $group['warnings'][] = 'tipo no indicado, se asume Medio digital'; }
        $group['note'] = mb_substr(implode(' | ', array_unique($notes)), 0, 2000);
        $group['people'] = min(200, $group['people']);
        return $group;
    }

    private static function strongerResult(string $current, string $candidate): string
    {
        $rank = ['pendiente' => 0, 'no_asistio' => 1, 'sin_publicacion' => 2, 'mencion' => 3, 'link' => 4];
        return $rank[$candidate] > $rank[$current] ? $candidate : $current;
    }

    private static function read(string $path): string
    {
        $content = @file_get_contents($path);
        if ($content === false) throw new RuntimeException('Cannot read ' . basename($path));
        return preg_replace('/^\xEF\xBB\xBF/', '', $content) ?? $content;
    }

    /** Google Sheets exports may start with blank rows; the header row is located by its first cell. */
    private static function rows(string $csv): array
    {
        $handle = fopen('php://temp', 'w+');
        fwrite($handle, $csv); rewind($handle);
        $header = null; $rows = [];
        while (($cells = fgetcsv($handle, 0, ',', '"', '')) !== false) {
            $cells = array_map(static fn (mixed $cell): string => trim((string) $cell), $cells);
            if ($header === null) { if (($cells[0] ?? '') === self::HEADER[0]) $header = $cells; continue; }
            if (($cells[0] ?? '') === '') continue;
            $cells = array_pad($cells, count(self::HEADER), '');
            $rows[] = self::row(array_combine(self::HEADER, array_slice($cells, 0, count(self::HEADER))));
        }
        fclose($handle);
        if ($header === null) throw new RuntimeException('Header row not found.');
        return $rows;
    }

    private static function row(array $cells): array
    {
        $warnings = [];
        $name = preg_replace('/\s+/u', ' ', $cells['MEDIO']) ?? $cells['MEDIO'];
        $type = self::TYPES[mb_strtolower(trim($cells['TIPO']))] ?? null;
        if ($type === null && $cells['TIPO'] !== '') $warnings[] = 'tipo desconocido: ' . $cells['TIPO'];
        if ($type === null && stripos($cells['FRECUENCIA'], 'canal') !== false) $type = 'tv';
        $city = trim($cells['Provincia']);
        $province = self::CITY_PROVINCE[mb_strtolower($city)] ?? '';
        if ($city !== '' && $province === '') $warnings[] = 'provincia no deducida para: ' . $city;
        $contractCell = mb_strtolower(trim($cells['CONTRATO']));
        $contracted = in_array($contractCell, ['sí', 'si'], true) ? 'yes' : ($contractCell === 'no' ? 'no' : null);
        $people = (int) filter_var($cells['N'], FILTER_SANITIZE_NUMBER_INT);
        $representatives = self::representatives($cells['REPRESENTANTE']);
        [$result, $links, $note] = self::publication($cells['link de publicación']);
        [$followers, $followersNote] = self::followers($cells['SEGUIDORES']);
        if ($followersNote !== '') { $warnings[] = 'seguidores no convertidos: ' . $cells['SEGUIDORES']; $note = trim($note . ' | Seguidores según hoja: ' . $followersNote, ' |'); }
        return ['name' => $name, 'types' => $type === null ? [] : [$type], 'frequency' => mb_substr($cells['FRECUENCIA'], 0, 120), 'city' => mb_substr(mb_convert_case($city, MB_CASE_TITLE), 0, 100), 'province' => $province,
            'program' => mb_substr($cells['PROGRAMA'], 0, 160), 'contracted' => $contracted, 'people' => max(0, min(200, $people)), 'representatives' => $representatives,
            'result' => $result, 'links' => $links, 'note' => $note, 'followers' => $followers, 'warnings' => $warnings];
    }

    /** Free text such as "1.- Nombre - Cargo 2.- Nombre - Cargo" or "Nombre Cargo Nombre Cargo": split what is separable, keep the rest intact. */
    private static function representatives(string $text): array
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
        if ($text === '') return [];
        $parts = preg_split('/\s*(?:^|\s)\d\.\-\s*/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [$text];
        $people = [];
        foreach ($parts as $part) {
            $pieces = preg_split('/\s+[-–—:]\s+/u', $part, 2) ?: [$part];
            $people[] = ['name' => mb_substr(trim($pieces[0]), 0, 160), 'role' => mb_substr(trim($pieces[1] ?? ''), 0, 120)];
        }
        return $people;
    }

    private static function publication(string $text): array
    {
        $text = trim($text);
        if ($text === '') return ['pendiente', [], ''];
        if (preg_match('~^https?://~i', $text)) { try { return ['link', [MediaRepository::link($text, 500)], '']; } catch (Throwable) { return ['pendiente', [], 'Link no válido en la hoja: ' . mb_substr($text, 0, 200)]; } }
        $upper = mb_strtoupper($text);
        if (str_contains($upper, 'NO ASIST')) return ['no_asistio', [], $text];
        if (preg_match('/MENCI|EN VIVO|ENTREVISTA|REPORTAJE|PUBLICA EN SUS|SI ASISTE/u', $upper)) return ['mencion', [], $text];
        if (str_contains($upper, 'NO ')) return ['sin_publicacion', [], $text];
        return ['pendiente', [], $text];
    }

    private static function followers(string $text): array
    {
        $upper = mb_strtoupper(trim($text));
        if ($upper === '') return [null, ''];
        if (preg_match('/^(\d+)\s*MIL(?:\s+(\d+))?/u', $upper, $parts)) return [(int) $parts[1] * 1000 + (int) ($parts[2] ?? 0), ''];
        if (preg_match('/^(\d{1,7})(?:\s|$)/u', $upper, $parts)) return [(int) $parts[1], ''];
        return [null, trim($text)];
    }
}

if (PHP_SAPI !== 'cli' || realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) { http_response_code(404); exit(1); }
exit(ImportMediaCoverageCommand::run(array_slice($argv, 1)));
