<?php

declare(strict_types=1);

namespace Finados;

use PDO;
use InvalidArgumentException;

final class Audit
{
    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto)
    {
    }

    public function log(string $eventType, ?int $actorId, string $subjectType, ?string $publicId, array $metadata = [], string $ip = ''): void
    {
        if (preg_match('/^[a-z][a-z0-9_.]{0,79}$/D', $eventType) !== 1
            || preg_match('/^[a-z][a-z0-9_]{0,39}$/D', $subjectType) !== 1
            || ($publicId !== null && preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1)) {
            throw new InvalidArgumentException('Invalid audit event.');
        }
        // Explicitly exclude notes, registration data, credentials and arbitrary strings.
        foreach ($metadata as $key => $value) {
            $valid = match ($key) {
                'from_status', 'to_status' => in_array($value, VocerosRepository::STATUSES, true),
                'note_id', 'count' => is_int($value) && $value >= 0,
                default => false,
            };
            if (!$valid) {
                throw new InvalidArgumentException('Invalid audit metadata.');
            }
        }
        $statement = $this->pdo->prepare('INSERT INTO audit_log (actor_id, event_type, subject_type, subject_public_id, metadata_json, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([
            $actorId, $eventType, $subjectType, $publicId,
            json_encode((object) $metadata, JSON_THROW_ON_ERROR), $this->crypto->lookup($ip), gmdate('Y-m-d H:i:s'),
        ]);
    }
}
