<?php

declare(strict_types=1);

namespace Finados;

use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/operations.php';
require_once __DIR__ . '/../src/Crypto.php';
require_once __DIR__ . '/../src/Audit.php';
require_once __DIR__ . '/../src/VocerosRepository.php';

final class HistoricalCsvError extends RuntimeException
{
    public function __construct(public readonly string $source, public readonly int $csvLine, string $code)
    { parent::__construct($code); }
}

final class ImportVocerosCommand
{
    private const HEADER = ['Fecha de envío', 'ID', 'Estado', 'Nombre completo', 'Cédula', 'Fecha de nacimiento', 'Edad',
        'WhatsApp', 'Correo', 'Ciudad', 'TikTok', 'Instagram', 'Facebook', 'Red principal',
        'Vocero anterior', 'Cómo se enteró', 'Retiro del kit', 'Representante', 'Cédula representante',
        'Teléfono representante', 'Correo representante', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term'];
    private const CONSENT_HEADER = ['Tipo', 'Aceptado', 'Versión', 'SHA-256', 'Fecha y hora', 'IP', 'Navegador', 'URL', 'Método', 'ID de registro'];
    private const FIELDS = ['submitted_at', 'submission_id', 'status', 'full_name', 'cedula', 'birth_date', 'age_at_submission',
        'whatsapp', 'email', 'city', 'tiktok', 'instagram', 'facebook', 'main_network', 'previous_participation',
        'community_source', 'kit_pickup', 'representative_name', 'representative_cedula', 'representative_phone',
        'representative_email', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

    public static function run(array $arguments): int
    {
        $pdo = null; $locked = false; $line = 0;
        $counts = ['inserted' => 0, 'skipped' => 0, 'errors' => 0];
        try {
            $options = Operations::options($arguments, ['--voceros', '--consents'], ['--dry-run']);
            [$config, $publicRoots] = Operations::configuration($options);
            $vocerosBytes = self::snapshot($options['--voceros']);
            $consentsBytes = self::snapshot($options['--consents']);
            $voceros = self::csv($vocerosBytes, self::HEADER, 'voceros');
            $consentRows = self::csv($consentsBytes, self::CONSENT_HEADER, 'consents');
            $records = []; $consents = [];
            foreach ($voceros as [$line, $row]) {
                $record = array_combine(self::FIELDS, $row);
                $id = strtolower($record['submission_id']);
                if (!preg_match('/^[a-f0-9]{32}$/D', $id) || isset($records[$id])) self::invalid('voceros', $line, 'invalid_or_duplicate_id');
                $record['submission_id'] = $id;
                $record['status'] = match ($record['status']) {
                    'Registrado' => 'Nuevo',
                    'Pendiente de autorización del representante' => 'Pendiente de autorización',
                    default => throw new HistoricalCsvError('voceros', $line, 'unknown_status'),
                };
                $record['submitted_at'] = self::timestamp($record['submitted_at'], 'voceros', $line);
                if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $record['birth_date'])
                    || !self::validDate($record['birth_date'])) self::invalid('voceros', $line, 'invalid_birth_date');
                if (!ctype_digit($record['age_at_submission']) || (int) $record['age_at_submission'] < 16
                    || (int) $record['age_at_submission'] > 120) self::invalid('voceros', $line, 'invalid_age');
                $record['age_at_submission'] = (int) $record['age_at_submission'];
                foreach (['full_name' => 160, 'city' => 100, 'main_network' => 20, 'previous_participation' => 60,
                    'community_source' => 80, 'kit_pickup' => 80, 'email' => 180, 'tiktok' => 300, 'instagram' => 300, 'facebook' => 300,
                    'utm_source' => 180, 'utm_medium' => 180, 'utm_campaign' => 180, 'utm_content' => 180, 'utm_term' => 180] as $field => $max) {
                    if (preg_match_all('/./us', $record[$field]) > $max) self::invalid('voceros', $line, 'field_too_long');
                }
                foreach (['full_name', 'city', 'main_network', 'previous_participation', 'community_source', 'kit_pickup'] as $field) {
                    if (trim($record[$field]) === '') self::invalid('voceros', $line, 'missing_field');
                }
                if (!preg_match('/^\d{10}$/D', $record['cedula']) || !preg_match('/^09\d{8}$/D', $record['whatsapp'])
                    || !filter_var($record['email'], FILTER_VALIDATE_EMAIL)) self::invalid('voceros', $line, 'invalid_contact');
                foreach (['representative_name', 'representative_cedula', 'representative_phone', 'representative_email'] as $field) {
                    if ($record[$field] === '') $record[$field] = null;
                }
                $records[$id] = ['line' => $line, 'record' => $record];
            }
            foreach ($consentRows as [$line, $row]) {
                [$type, $accepted, $version, $hash, $at, $ip, $agent, $url, $method, $id] = $row;
                $id = strtolower($id);
                if (!preg_match('/^[a-f0-9]{32}$/D', $id) || !isset($records[$id])) self::invalid('consents', $line, 'orphan_or_invalid_id');
                if (!in_array($type, ['politicas', 'imagen', 'datos'], true) || isset($consents[$id][$type])) self::invalid('consents', $line, 'invalid_or_duplicate_type');
                if ($accepted !== 'true' || !preg_match('/^[a-fA-F0-9]{64}$/D', $hash) || $version === '' || $method !== 'formulario_web'
                    || preg_match_all('/./us', $version) > 80 || preg_match_all('/./us', $agent) > 500 || preg_match_all('/./us', $url) > 500
                    || ($ip !== '' && !filter_var($ip, FILTER_VALIDATE_IP))) self::invalid('consents', $line, 'invalid_evidence');
                $consents[$id][$type] = ['consent_type' => $type, 'accepted' => 1, 'text_version' => $version,
                    'text_hash' => strtolower($hash), 'accepted_at' => self::timestamp($at, 'consents', $line),
                    'ip' => $ip, 'user_agent' => $agent, 'source_url' => $url, 'method' => $method];
            }
            foreach ($records as $id => $entry) {
                if (count($consents[$id] ?? []) !== 3) self::invalid('voceros', $entry['line'], 'requires_three_consents');
            }
            if (isset($options['--dry-run'])) {
                fwrite(STDOUT, json_encode($counts + ['validated' => count($records), 'dry_run' => true]) . "\n");
                return 0;
            }
            // Back up the immutable, validated snapshots, not files that could change after validation.
            $directory = Operations::datedDirectory(Operations::configDirectory($options) . '/imports', $publicRoots);
            Operations::writeExclusive($directory . '/voceros.csv', $vocerosBytes);
            Operations::writeExclusive($directory . '/consents.csv', $consentsBytes);
            $pdo = Database::connect($config);
            if ($pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql') {
                $lock = $pdo->query("SELECT GET_LOCK('finados.voceros.import', 10)")->fetchColumn();
                if ((int) $lock !== 1) throw new RuntimeException('Import busy.');
                $locked = true;
            }
            $pdo->beginTransaction();
            if ($pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'sqlite') $pdo->exec('UPDATE schema_migrations SET applied_at = applied_at WHERE 1 = 0');
            $repository = new VocerosRepository($pdo, new Crypto($config));
            $existing = $pdo->prepare('SELECT id FROM voceros WHERE submission_id = ?');
            foreach ($records as $id => $entry) {
                $line = $entry['line'];
                $existing->execute([$id]);
                if ($existing->fetchColumn() !== false) { $counts['skipped']++; continue; }
                $repository->create($entry['record'], array_values($consents[$id]));
                $counts['inserted']++;
            }
            $pdo->commit();
            fwrite(STDOUT, json_encode($counts) . "\n");
            return 0;
        } catch (Throwable $error) {
            if ($pdo !== null && $pdo->inTransaction()) $pdo->rollBack();
            fwrite(STDOUT, json_encode(['inserted' => 0, 'skipped' => 0, 'errors' => 1]) . "\n");
            $diagnostic = $error instanceof HistoricalCsvError
                ? ['source' => $error->source, 'line' => $error->csvLine, 'error' => $error->getMessage()]
                : ['line' => $line, 'error' => 'import_failed'];
            fwrite(STDERR, json_encode($diagnostic) . "\n");
            return 1;
        } finally {
            if ($locked) {
                try { $pdo->query("SELECT RELEASE_LOCK('finados.voceros.import')"); } catch (Throwable) { /* Connection close releases lock. */ }
            }
        }
    }

    private static function snapshot(string $path): string
    {
        $stream = fopen($path, 'rb');
        if ($stream === false) throw new RuntimeException('CSV unavailable.');
        try {
            if (!flock($stream, LOCK_SH)) throw new RuntimeException('CSV unavailable.');
            $bytes = stream_get_contents($stream);
            if ($bytes === false) throw new RuntimeException('CSV unavailable.');
            return $bytes;
        } finally { flock($stream, LOCK_UN); fclose($stream); }
    }

    private static function csv(string $bytes, array $header, string $source): array
    {
        foreach (explode("\n", $bytes) as $line => $value) {
            if (preg_match('//u', $value) !== 1 || str_contains($value, "\0")) self::invalid($source, $line + 1, 'invalid_utf8');
        }
        if (str_starts_with($bytes, "\xEF\xBB\xBF")) $bytes = substr($bytes, 3);
        $stream = fopen('php://memory', 'w+');
        fwrite($stream, $bytes); rewind($stream);
        try {
            $rows = []; $line = 1; $headerRead = false;
            while (!feof($stream)) {
                $offset = ftell($stream);
                $row = fgetcsv($stream, null, ',', '"', '\\');
                if ($row === false) break;
                $original = substr($bytes, $offset, ftell($stream) - $offset);
                self::verifyHistoricalEncoding($original, $row, $source, $line);
                if (!$headerRead) {
                    if ($row !== $header) self::invalid($source, 1, 'invalid_header');
                    $headerRead = true;
                    $line += substr_count($original, "\n");
                    continue;
                }
                if (count($row) !== count($header) || in_array(null, $row, true)) self::invalid($source, $line, 'invalid_columns');
                // Historical writer prefixes spreadsheet formula triggers with one apostrophe.
                $row = array_map(static fn (string $value): string => preg_match('/^\x27[=+\-@\t\r\n]/', $value) ? substr($value, 1) : $value, $row);
                $rows[] = [$line, $row];
                $line += substr_count($original, "\n");
            }
            if (!$headerRead) self::invalid($source, 1, 'invalid_header');
            return $rows;
        } finally { fclose($stream); }
    }

    private static function timestamp(string $value, string $source, int $line): string
    {
        $date = DateTimeImmutable::createFromFormat('Y-m-d\TH:i:sP', $value);
        if ($date === false || $date->format('Y-m-d\TH:i:sP') !== $value) self::invalid($source, $line, 'invalid_timestamp');
        return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    /**
     * Use one reader and the exact historical writer to prove the encoding is reversible.
     * PHP's backslash CSV extension is not reversible for every string. A record that does
     * not re-encode byte-for-byte is ambiguous/nonhistorical and must never be imported.
     * Only the record terminator may differ (LF, CRLF, or EOF); field bytes remain exact.
     */
    private static function verifyHistoricalEncoding(string $original, array $row, string $source, int $line): void
    {
        $writer = fopen('php://memory', 'w+');
        try {
            fputcsv($writer, $row, ',', '"', '\\');
            rewind($writer);
            $encoded = stream_get_contents($writer);
            $record = preg_replace('/(?:\r\n|\n|\r)$/D', '', $original);
            if ($record !== substr($encoded, 0, -1)) self::invalid($source, $line, 'ambiguous_csv_encoding');
        } finally { fclose($writer); }
    }

    private static function validDate(string $value): bool
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value;
    }

    private static function invalid(string $source, int $line, string $code): never
    { throw new HistoricalCsvError($source, $line, $code); }
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    ini_set('display_errors', '0'); ini_set('log_errors', '0'); umask(0077);
    set_error_handler(static function (): never { throw new RuntimeException('Operation failed.'); });
    exit(ImportVocerosCommand::run(array_slice($argv, 1)));
}
