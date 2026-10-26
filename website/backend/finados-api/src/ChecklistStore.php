<?php
declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use PDO;

/**
 * Marcas del checklist público de coordinación. Cualquiera con el enlace puede marcar (decisión de Alex,
 * 2026-10-26), así que solo se aceptan claves conocidas por forma, textos cortos y un tope de escrituras.
 */
final class ChecklistStore
{
    public const BOARDS = ['inauguracion-2026'];
    private const KEY = '/^(?:c|r|o|g|k)__[a-z0-9-]{1,40}$/D';
    private const MAX_VALUE = 300;
    private const MAX_ITEMS = 300;
    private const WRITES_PER_MINUTE = 240;

    public function __construct(private readonly PDO $pdo) {}

    public function get(string $board): array
    {
        $this->board($board);
        $statement = $this->pdo->prepare('SELECT item_key, value, updated_at FROM checklist_marks WHERE board = ? ORDER BY item_key');
        $statement->execute([$board]);
        $items = [];
        $updated = null;
        foreach ($statement->fetchAll() as $row) {
            $items[(string) $row['item_key']] = (string) $row['value'];
            if ($updated === null || $row['updated_at'] > $updated) $updated = (string) $row['updated_at'];
        }
        return ['items' => $items, 'updated_at' => $updated];
    }

    /** Guarda una marca; un valor vacío la quita. */
    public function set(string $board, mixed $key, mixed $value): array
    {
        $this->board($board);
        if (!is_string($key) || preg_match(self::KEY, $key) !== 1) throw new InvalidArgumentException('Invalid checklist key.');
        if (!is_string($value) || mb_strlen($value, 'UTF-8') > self::MAX_VALUE || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $value) === 1) {
            throw new InvalidArgumentException('Invalid checklist value.');
        }
        $value = trim($value);
        $now = gmdate('Y-m-d H:i:s');
        $recent = $this->pdo->prepare('SELECT COUNT(*) FROM checklist_marks WHERE board = ? AND updated_at >= ?');
        $recent->execute([$board, gmdate('Y-m-d H:i:s', time() - 60)]);
        if ((int) $recent->fetchColumn() >= self::WRITES_PER_MINUTE) throw new RateLimitException();
        if ($value === '') {
            $this->pdo->prepare('DELETE FROM checklist_marks WHERE board = ? AND item_key = ?')->execute([$board, $key]);
            return $this->get($board);
        }
        $exists = $this->pdo->prepare('SELECT COUNT(*) FROM checklist_marks WHERE board = ? AND item_key = ?');
        $exists->execute([$board, $key]);
        if ((int) $exists->fetchColumn() > 0) {
            $this->pdo->prepare('UPDATE checklist_marks SET value = ?, updated_at = ? WHERE board = ? AND item_key = ?')->execute([$value, $now, $board, $key]);
        } else {
            $count = $this->pdo->prepare('SELECT COUNT(*) FROM checklist_marks WHERE board = ?');
            $count->execute([$board]);
            if ((int) $count->fetchColumn() >= self::MAX_ITEMS) throw new InvalidArgumentException('Checklist is full.');
            $this->pdo->prepare('INSERT INTO checklist_marks (board, item_key, value, updated_at) VALUES (?, ?, ?, ?)')->execute([$board, $key, $value, $now]);
        }
        return $this->get($board);
    }

    private function board(string $board): void
    {
        if (!in_array($board, self::BOARDS, true)) throw new \OutOfBoundsException();
    }
}
