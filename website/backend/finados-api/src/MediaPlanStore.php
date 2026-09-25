<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use PDO;

/** Se guardó otra versión antes que esta: hay que recargar para no pisar el trabajo ajeno. */
final class MediaPlanConflict extends \RuntimeException {}

/**
 * Calendario estratégico de comunicación de Medios: spots, pautas por semana,
 * medios de pauta y plan de medios. Es un solo documento compartido por el equipo,
 * con número de versión para que dos personas no se pisen los cambios.
 */
final class MediaPlanStore
{
    public const MAX_BYTES = 512 * 1024;
    public const CAMPAIGN_START = '2026-09-21';
    public const CAMPAIGN_END = '2026-11-05';
    public const WEEKS = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];
    public const MEDIA_TYPES = ['Radio', 'Televisión', 'Digital', 'Prensa', 'Influencer', 'Otro'];
    public const COVERAGES = ['Nacional', 'Regional', 'Local'];

    public function __construct(private readonly PDO $pdo, private readonly Audit $audit) {}

    public function get(): array
    {
        $row = $this->pdo->query('SELECT data_json, version, updated_at FROM media_plan WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        if (!$row) return ['data' => null, 'version' => 0, 'updated_at' => null];
        return ['data' => json_decode($row['data_json'], true, 64, JSON_THROW_ON_ERROR), 'version' => (int) $row['version'], 'updated_at' => $row['updated_at']];
    }

    public function save(mixed $data, mixed $version, int $actorId, string $ip): array
    {
        if (!is_int($version) || $version < 0) throw new InvalidArgumentException();
        $clean = self::validate($data);
        $json = json_encode($clean, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($json) > self::MAX_BYTES) throw new InvalidArgumentException();
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->beginTransaction();
        try {
            $current = $this->pdo->query('SELECT version FROM media_plan WHERE id = 1')->fetchColumn();
            $current = $current === false ? 0 : (int) $current;
            if ($current !== $version) throw new MediaPlanConflict();
            if ($current === 0) {
                $this->pdo->prepare('INSERT INTO media_plan (id, data_json, version, updated_by, updated_at) VALUES (1, ?, 1, ?, ?)')->execute([$json, $actorId, $now]);
            } else {
                $update = $this->pdo->prepare('UPDATE media_plan SET data_json = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = 1 AND version = ?');
                $update->execute([$json, $actorId, $now, $version]);
                if ($update->rowCount() !== 1) throw new MediaPlanConflict();
            }
            $this->audit->log('media.plan_saved', $actorId, 'media_plan', null, ['count' => $version + 1], $ip);
            $this->pdo->commit();
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
        return ['data' => $clean, 'version' => $version + 1, 'updated_at' => $now];
    }

    /** Solo pasa lo que la herramienta usa, con tipos y largos acotados. */
    public static function validate(mixed $data): array
    {
        if (!is_array($data) || array_is_list($data) || array_diff(array_keys($data), ['spots', 'assignments', 'media', 'plans']) !== []) throw new InvalidArgumentException();
        $spots = self::items($data['spots'] ?? [], 50, static fn (array $item): array => [
            'id' => self::id($item['id'] ?? null),
            'qty' => self::int($item['qty'] ?? 1, 1, 999),
            'name' => self::text($item['name'] ?? null, 120, true),
            'desc' => self::text($item['desc'] ?? '', 300),
            'color' => self::color($item['color'] ?? null),
            'national' => (bool) ($item['national'] ?? false),
            'regional' => (bool) ($item['regional'] ?? false),
            'local' => (bool) ($item['local'] ?? false),
        ]);
        $spotIds = array_column($spots, 'id');
        $assignments = self::items($data['assignments'] ?? [], 500, static function (array $item) use ($spotIds): array {
            [$start, $end] = self::range($item['start'] ?? null, $item['end'] ?? null);
            $spot = self::id($item['spotId'] ?? null);
            if (!in_array($spot, $spotIds, true) || !in_array($item['weekId'] ?? null, self::WEEKS, true)) throw new InvalidArgumentException();
            return ['id' => self::id($item['id'] ?? null), 'spotId' => $spot, 'weekId' => $item['weekId'], 'start' => $start, 'end' => $end, 'note' => self::text($item['note'] ?? '', 500)];
        });
        $media = self::items($data['media'] ?? [], 500, static function (array $item): array {
            if (!in_array($item['type'] ?? null, self::MEDIA_TYPES, true) || !in_array($item['coverage'] ?? null, self::COVERAGES, true)
                || !in_array($item['status'] ?? null, ['active', 'pending'], true)) throw new InvalidArgumentException();
            $source = $item['sourceId'] ?? '';
            if ($source !== '' && (!is_string($source) || preg_match('/^[a-f0-9]{32}$/D', $source) !== 1)) throw new InvalidArgumentException();
            return [
                'id' => self::id($item['id'] ?? null), 'name' => self::text($item['name'] ?? null, 160, true), 'type' => $item['type'], 'coverage' => $item['coverage'],
                'city' => self::text($item['city'] ?? '', 160), 'program' => self::text($item['program'] ?? '', 160), 'contact' => self::text($item['contact'] ?? '', 160),
                'rate' => self::money($item['rate'] ?? 0), 'status' => $item['status'], 'notes' => self::text($item['notes'] ?? '', 1000), 'sourceId' => $source,
            ];
        });
        $mediaIds = array_column($media, 'id');
        $plans = self::items($data['plans'] ?? [], 1000, static function (array $item) use ($spotIds, $mediaIds): array {
            [$start, $end] = self::range($item['start'] ?? null, $item['end'] ?? null);
            $mediaId = self::id($item['mediaId'] ?? null);
            $spotId = self::id($item['spotId'] ?? null);
            if (!in_array($mediaId, $mediaIds, true) || !in_array($spotId, $spotIds, true)) throw new InvalidArgumentException();
            return ['id' => self::id($item['id'] ?? null), 'mediaId' => $mediaId, 'spotId' => $spotId, 'start' => $start, 'end' => $end,
                'freq' => self::int($item['freq'] ?? 1, 1, 500), 'cost' => self::money($item['cost'] ?? 0), 'objective' => self::text($item['objective'] ?? '', 500)];
        });
        return ['spots' => $spots, 'assignments' => $assignments, 'media' => $media, 'plans' => $plans];
    }

    private static function items(mixed $list, int $max, callable $map): array
    {
        if (!is_array($list) || !array_is_list($list) || count($list) > $max) throw new InvalidArgumentException();
        $out = [];
        $ids = [];
        foreach ($list as $item) {
            if (!is_array($item) || array_is_list($item)) throw new InvalidArgumentException();
            $clean = $map($item);
            if (isset($ids[$clean['id']])) throw new InvalidArgumentException();
            $ids[$clean['id']] = true;
            $out[] = $clean;
        }
        return $out;
    }

    private static function id(mixed $value): string
    {
        if (!is_string($value) || preg_match('/^[A-Za-z0-9_-]{1,48}$/D', $value) !== 1) throw new InvalidArgumentException();
        return $value;
    }

    private static function text(mixed $value, int $max, bool $required = false): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $value = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '');
        if (($required && $value === '') || mb_strlen($value) > $max) throw new InvalidArgumentException();
        return $value;
    }

    private static function int(mixed $value, int $min, int $max): int
    {
        if (!is_int($value) || $value < $min || $value > $max) throw new InvalidArgumentException();
        return $value;
    }

    private static function money(mixed $value): float
    {
        if ((!is_int($value) && !is_float($value)) || $value < 0 || $value > 1000000) throw new InvalidArgumentException();
        return round((float) $value, 2);
    }

    private static function color(mixed $value): string
    {
        if (!is_string($value) || preg_match('/^#[0-9a-fA-F]{6}$/D', $value) !== 1) throw new InvalidArgumentException();
        return strtolower($value);
    }

    private static function range(mixed $start, mixed $end): array
    {
        foreach ([$start, $end] as $date) {
            if (!is_string($date) || preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date) !== 1 || !checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4))) throw new InvalidArgumentException();
        }
        if ($start > $end || $start < self::CAMPAIGN_START || $end > self::CAMPAIGN_END) throw new InvalidArgumentException();
        return [$start, $end];
    }
}
