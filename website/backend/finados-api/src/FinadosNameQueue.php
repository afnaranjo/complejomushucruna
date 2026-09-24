<?php
declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use PDO;

final class FinadosNameQueue
{
    public function __construct(private readonly PDO $pdo) {}

    public function enqueue(string $displayName, bool $consent): array
    {
        $displayName = trim(preg_replace('/\s+/u', ' ', $displayName) ?? '');
        if ($displayName === '' || mb_strlen($displayName, 'UTF-8') > 60 || !$consent) {
            throw new InvalidArgumentException('Invalid public name.');
        }
        $now = gmdate('Y-m-d H:i:s');
        $recent = $this->pdo->prepare('SELECT public_id, display_name, created_at FROM finados_name_queue WHERE display_name = ? AND created_at >= ? AND expires_at > ? ORDER BY id DESC LIMIT 1');
        $recent->execute([$displayName, gmdate('Y-m-d H:i:s', time() - 10), $now]);
        $existing = $recent->fetch();
        if (is_array($existing)) return ['public_id' => (string) $existing['public_id'], 'display_name' => $this->safe((string) $existing['display_name']), 'created_at' => (string) $existing['created_at'], 'queued' => true];

        $recentCount = $this->pdo->prepare('SELECT COUNT(*) FROM finados_name_queue WHERE created_at >= ?');
        $recentCount->execute([gmdate('Y-m-d H:i:s', time() - 60)]);
        if ((int) $recentCount->fetchColumn() >= 30) throw new RateLimitException();

        $publicId = bin2hex(random_bytes(16));
        $expires = gmdate('Y-m-d H:i:s', time() + 86400);
        $insert = $this->pdo->prepare('INSERT INTO finados_name_queue (public_id, display_name, consent_given, created_at, expires_at) VALUES (?, ?, 1, ?, ?)');
        $insert->execute([$publicId, $displayName, $now, $expires]);
        return ['public_id' => $publicId, 'display_name' => $this->safe($displayName), 'created_at' => $now, 'queued' => true];
    }

    public function pending(int $limit = 20): array
    {
        $limit = max(1, min(20, $limit));
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('DELETE FROM finados_name_queue WHERE expires_at <= ?')->execute([$now]);
        $statement = $this->pdo->prepare('SELECT public_id, display_name, created_at FROM finados_name_queue WHERE expires_at > ? ORDER BY created_at ASC, id ASC LIMIT ' . $limit);
        $statement->execute([$now]);
        return array_map(fn (array $row): array => [
            'public_id' => (string) $row['public_id'],
            'display_name' => $this->safe((string) $row['display_name']),
            'created_at' => (string) $row['created_at'],
        ], $statement->fetchAll());
    }

    private function safe(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

final class RateLimitException extends \RuntimeException {}
