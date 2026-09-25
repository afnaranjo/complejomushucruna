<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;

/**
 * Producción: tres tableros independientes (Activaciones, Cronograma Sol y Cronograma Luna).
 * Cada uno tiene su biblioteca de piezas (shows, activaciones) y sus bloques en el calendario,
 * con día y hora. Nada se mezcla entre tableros y nada se borra: se archiva o se quita.
 */
final class ProductionRepository
{
    public const BOARDS = ['activaciones' => 'Activaciones', 'sol' => 'Cronograma Sol', 'luna' => 'Cronograma Luna'];
    public const STATUSES = ['planificado' => 'Planificado', 'confirmado' => 'Confirmado', 'realizado' => 'Realizado', 'no_se_hizo' => 'No se hizo'];
    private const MAX_RANGE_DAYS = 62;

    public function __construct(private readonly PDO $pdo, private readonly Audit $audit) {}

    public static function board(string $board): string
    {
        if (!isset(self::BOARDS[$board])) throw new OutOfBoundsException();
        return $board;
    }

    public function calendar(string $board, string $from, string $to): array
    {
        $board = self::board($board);
        [$from, $to] = self::range($from, $to);
        $entries = $this->pdo->prepare('SELECT e.*, i.public_id AS item_public_id FROM production_entries e LEFT JOIN production_items i ON i.id = e.item_id WHERE e.board = ? AND e.canceled_at IS NULL AND e.starts_at >= ? AND e.starts_at < ? ORDER BY e.starts_at, e.id');
        $entries->execute([$board, $from . ' 00:00:00', $to . ' 00:00:00']);
        $count = function (string $where) use ($board): int {
            $query = $this->pdo->prepare('SELECT COUNT(*) FROM production_entries WHERE board = ? AND canceled_at IS NULL' . $where);
            $query->execute([$board]);
            return (int) $query->fetchColumn();
        };
        $items = $this->items($board);
        return [
            'board' => $board, 'label' => self::BOARDS[$board],
            'items' => $items,
            'entries' => array_map(fn (array $row): array => $this->entryProjection($row), $entries->fetchAll(PDO::FETCH_ASSOC)),
            'statuses' => self::STATUSES,
            'totals' => ['items' => count($items), 'entries' => $count(''), 'confirmed' => $count(" AND status = 'confirmado'"), 'done' => $count(" AND status = 'realizado'")],
        ];
    }

    private function items(string $board): array
    {
        $query = $this->pdo->prepare('SELECT i.*, (SELECT COUNT(*) FROM production_entries e WHERE e.item_id = i.id AND e.canceled_at IS NULL) AS uses FROM production_items i WHERE i.board = ? AND i.archived_at IS NULL ORDER BY i.name');
        $query->execute([$board]);
        return array_map(static fn (array $row): array => [
            'public_id' => $row['public_id'], 'name' => $row['name'], 'description' => $row['description'], 'color' => $row['color'],
            'duration_minutes' => (int) $row['duration_minutes'], 'uses' => (int) $row['uses'],
        ], $query->fetchAll(PDO::FETCH_ASSOC));
    }

    public function createItem(string $board, array $input, int $actorId, string $ip): array
    {
        $board = self::board($board);
        $data = self::itemData($input);
        $publicId = bin2hex(random_bytes(16));
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('INSERT INTO production_items (public_id, board, name, description, color, duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $board, $data['name'], $data['description'], $data['color'], $data['duration_minutes'], $now, $now]);
        $this->audit->log('production.item_created', $actorId, 'production_item', $publicId, [], $ip);
        return $this->item($board, $publicId);
    }

    public function updateItem(string $board, string $publicId, array $input, int $actorId, string $ip): array
    {
        $board = self::board($board);
        $this->itemRow($board, $publicId);
        $data = self::itemData($input);
        $this->pdo->prepare('UPDATE production_items SET name = ?, description = ?, color = ?, duration_minutes = ?, updated_at = ? WHERE public_id = ? AND board = ?')
            ->execute([$data['name'], $data['description'], $data['color'], $data['duration_minutes'], gmdate('Y-m-d H:i:s'), $publicId, $board]);
        $this->audit->log('production.item_updated', $actorId, 'production_item', $publicId, [], $ip);
        return $this->item($board, $publicId);
    }

    /** Archivar una pieza la saca de la biblioteca; los bloques ya agendados se conservan. */
    public function archiveItem(string $board, string $publicId, int $actorId, string $ip): void
    {
        $board = self::board($board);
        $this->itemRow($board, $publicId);
        $this->pdo->prepare('UPDATE production_items SET archived_at = ?, updated_at = ? WHERE public_id = ? AND board = ?')->execute([gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'), $publicId, $board]);
        $this->audit->log('production.item_archived', $actorId, 'production_item', $publicId, [], $ip);
    }

    public function createEntry(string $board, array $input, int $actorId, string $ip): array
    {
        $board = self::board($board);
        $item = null;
        if (($input['item'] ?? '') !== '') $item = $this->itemRow($board, is_string($input['item']) ? $input['item'] : '');
        // Desde una pieza, el bloque toma su nombre y su color si no se escriben otros.
        $data = self::entryData([
            ...$input,
            'title' => ($input['title'] ?? '') !== '' ? $input['title'] : ($item['name'] ?? ''),
            'color' => $input['color'] ?? ($item['color'] ?? '#94165e'),
        ]);
        $publicId = bin2hex(random_bytes(16));
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('INSERT INTO production_entries (public_id, board, item_id, title, color, starts_at, ends_at, status, owner, place, note, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $board, $item === null ? null : (int) $item['id'], $data['title'], $data['color'], $data['starts_at'], $data['ends_at'], $data['status'], $data['owner'], $data['place'], $data['note'], $actorId, $now, $now]);
        $this->audit->log('production.entry_created', $actorId, 'production_entry', $publicId, [], $ip);
        return $this->entry($board, $publicId);
    }

    /** Cambio parcial: mover, estirar, o editar título, estado, responsable, lugar, nota o color. */
    public function updateEntry(string $board, string $publicId, array $input, int $actorId, string $ip): array
    {
        $board = self::board($board);
        $row = $this->entryRow($board, $publicId);
        $data = self::entryData([
            'title' => $input['title'] ?? $row['title'], 'color' => $input['color'] ?? $row['color'],
            'starts_at' => $input['starts_at'] ?? substr((string) $row['starts_at'], 0, 16), 'ends_at' => $input['ends_at'] ?? substr((string) $row['ends_at'], 0, 16),
            'status' => $input['status'] ?? $row['status'], 'owner' => $input['owner'] ?? $row['owner'], 'place' => $input['place'] ?? $row['place'], 'note' => $input['note'] ?? $row['note'],
        ]);
        $this->pdo->prepare('UPDATE production_entries SET title = ?, color = ?, starts_at = ?, ends_at = ?, status = ?, owner = ?, place = ?, note = ?, updated_at = ? WHERE id = ?')
            ->execute([$data['title'], $data['color'], $data['starts_at'], $data['ends_at'], $data['status'], $data['owner'], $data['place'], $data['note'], gmdate('Y-m-d H:i:s'), (int) $row['id']]);
        $this->audit->log('production.entry_updated', $actorId, 'production_entry', $publicId, [], $ip);
        return $this->entry($board, $publicId);
    }

    public function cancelEntry(string $board, string $publicId, int $actorId, string $ip): void
    {
        $board = self::board($board);
        $this->entryRow($board, $publicId);
        $this->pdo->prepare('UPDATE production_entries SET canceled_at = ?, updated_at = ? WHERE public_id = ? AND board = ?')->execute([gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'), $publicId, $board]);
        $this->audit->log('production.entry_canceled', $actorId, 'production_entry', $publicId, [], $ip);
    }

    private function item(string $board, string $publicId): array
    {
        foreach ($this->items($board) as $item) if ($item['public_id'] === $publicId) return $item;
        throw new OutOfBoundsException();
    }

    private function itemRow(string $board, string $publicId): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new OutOfBoundsException();
        $query = $this->pdo->prepare('SELECT * FROM production_items WHERE public_id = ? AND board = ? AND archived_at IS NULL');
        $query->execute([$publicId, $board]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new OutOfBoundsException();
        return $row;
    }

    private function entry(string $board, string $publicId): array
    {
        $query = $this->pdo->prepare('SELECT e.*, i.public_id AS item_public_id FROM production_entries e LEFT JOIN production_items i ON i.id = e.item_id WHERE e.public_id = ? AND e.board = ? AND e.canceled_at IS NULL');
        $query->execute([$publicId, $board]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new OutOfBoundsException();
        return $this->entryProjection($row);
    }

    private function entryRow(string $board, string $publicId): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new OutOfBoundsException();
        $query = $this->pdo->prepare('SELECT * FROM production_entries WHERE public_id = ? AND board = ? AND canceled_at IS NULL');
        $query->execute([$publicId, $board]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new OutOfBoundsException();
        return $row;
    }

    private function entryProjection(array $row): array
    {
        return [
            'public_id' => $row['public_id'], 'item' => $row['item_public_id'] ?? null, 'title' => $row['title'], 'color' => $row['color'],
            'starts_at' => substr((string) $row['starts_at'], 0, 16), 'ends_at' => substr((string) $row['ends_at'], 0, 16),
            'status' => $row['status'], 'owner' => $row['owner'], 'place' => $row['place'], 'note' => $row['note'],
        ];
    }

    private static function itemData(array $input): array
    {
        $name = self::text($input['name'] ?? null, 160);
        if ($name === '') throw new InvalidArgumentException();
        $duration = $input['duration_minutes'] ?? 60;
        if (!is_int($duration) || $duration < 15 || $duration > 720 || $duration % 15 !== 0) throw new InvalidArgumentException();
        return ['name' => $name, 'description' => self::text($input['description'] ?? '', 1000), 'color' => self::color($input['color'] ?? '#94165e'), 'duration_minutes' => $duration];
    }

    private static function entryData(array $input): array
    {
        $title = self::text($input['title'] ?? null, 160);
        if ($title === '') throw new InvalidArgumentException();
        $starts = self::moment($input['starts_at'] ?? null);
        $ends = self::moment($input['ends_at'] ?? null);
        if (substr($starts, 0, 10) !== substr($ends, 0, 10) || $ends <= $starts || (strtotime($ends) - strtotime($starts)) < 15 * 60) throw new InvalidArgumentException();
        $status = $input['status'] ?? 'planificado';
        if (!is_string($status) || !isset(self::STATUSES[$status])) throw new InvalidArgumentException();
        return ['title' => $title, 'color' => self::color($input['color'] ?? '#94165e'), 'starts_at' => $starts, 'ends_at' => $ends, 'status' => $status,
            'owner' => self::text($input['owner'] ?? '', 160), 'place' => self::text($input['place'] ?? '', 160), 'note' => self::text($input['note'] ?? '', 1000)];
    }

    private static function color(mixed $value): string
    {
        if (!is_string($value) || preg_match('/^#[0-9a-fA-F]{6}$/D', $value) !== 1) throw new InvalidArgumentException();
        return strtolower($value);
    }

    /** «2026-10-30 19:00», en hora de Ecuador y sin conversión, como el resto de calendarios. */
    private static function moment(mixed $value): string
    {
        if (!is_string($value) || preg_match('/^(\d{4})-(\d{2})-(\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)$/D', $value, $m) !== 1 || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) throw new InvalidArgumentException();
        return sprintf('%s-%s-%s %s:%s:00', $m[1], $m[2], $m[3], $m[4], $m[5]);
    }

    private static function range(string $from, string $to): array
    {
        foreach ([$from, $to] as $day) {
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/D', $day) !== 1 || !checkdate((int) substr($day, 5, 2), (int) substr($day, 8, 2), (int) substr($day, 0, 4))) throw new InvalidArgumentException();
        }
        if ($to <= $from || (strtotime($to) - strtotime($from)) / 86400 > self::MAX_RANGE_DAYS) throw new InvalidArgumentException();
        return [$from, $to];
    }

    private static function text(mixed $value, int $max): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $value = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '');
        if (mb_strlen($value) > $max) throw new InvalidArgumentException();
        return $value;
    }
}
