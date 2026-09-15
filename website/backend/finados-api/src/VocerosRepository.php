<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use PDOException;
use RuntimeException;
use Throwable;

final class VocerosRepository
{
    public const STATUSES = ['Nuevo', 'En revisión', 'Aprobado', 'Rechazado', 'Pendiente de autorización'];
    private const ENCRYPTED = ['cedula', 'birth_date', 'whatsapp', 'email', 'representative_name', 'representative_cedula', 'representative_phone', 'representative_email'];
    private const INDEXED = ['cedula', 'whatsapp', 'email', 'representative_cedula', 'representative_phone', 'representative_email'];
    private readonly Audit $audit;

    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, ?Audit $audit = null)
    {
        $this->audit = $audit ?? new Audit($pdo, $crypto);
    }

    public function create(array $record, array $consents): string
    {
        if (count($consents) !== 3 || count(array_unique(array_column($consents, 'consent_type'))) !== 3) {
            throw new InvalidArgumentException('Exactly three distinct consents are required.');
        }
        $submissionId = $record['submission_id'] ?? '';
        if (!is_string($submissionId) || preg_match('/^[a-f0-9]{32}$/D', $submissionId) !== 1) {
            throw new InvalidArgumentException('Invalid submission identifier.');
        }
        $status = $record['status'] ?? 'Nuevo';
        if (!in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException('Invalid registration status.');
        }
        $this->pdo->beginTransaction();
        try {
            $existing = $this->findSubmissionId($submissionId);
            if ($existing !== null) {
                $this->pdo->commit();
                return $existing;
            }
            $now = gmdate('Y-m-d H:i:s');
            $row = [
                'public_id' => bin2hex(random_bytes(16)), 'submission_id' => $submissionId,
                'status' => $status,
                'created_at' => $now, 'updated_at' => $now,
            ];
            foreach (['full_name', 'age_at_submission', 'city', 'main_network', 'previous_participation', 'community_source', 'kit_pickup', 'submitted_at'] as $field) {
                if (!isset($record[$field])) {
                    throw new InvalidArgumentException('Missing registration field.');
                }
                $row[$field] = $record[$field];
            }
            foreach (['tiktok', 'instagram', 'facebook', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $field) {
                $row[$field] = $record[$field] ?? '';
            }
            foreach (self::ENCRYPTED as $field) {
                $value = $record[$field] ?? null;
                if ($value === null && !str_starts_with($field, 'representative_')) {
                    throw new InvalidArgumentException('Missing protected registration field.');
                }
                if ($value !== null && !is_string($value)) {
                    throw new InvalidArgumentException('Invalid protected registration field.');
                }
                $row[$field . '_enc'] = $value === null ? null : $this->crypto->encrypt($value);
                if (in_array($field, self::INDEXED, true)) {
                    $row[$field . '_idx'] = $value === null ? null : $this->crypto->lookup($value);
                }
            }
            $this->insert('voceros', $row);
            $voceroId = (int) $this->pdo->lastInsertId();
            foreach ($consents as $consent) {
                $consentRow = ['vocero_id' => $voceroId];
                foreach (['consent_type', 'accepted', 'text_version', 'text_hash', 'accepted_at', 'user_agent', 'source_url', 'method'] as $field) {
                    if (!isset($consent[$field])) {
                        throw new InvalidArgumentException('Missing consent field.');
                    }
                    $consentRow[$field] = $consent[$field];
                }
                if (!isset($consent['ip']) || !is_string($consent['ip'])) {
                    throw new InvalidArgumentException('Missing consent evidence.');
                }
                $consentRow['ip_enc'] = $this->crypto->encrypt($consent['ip']);
                $this->insert('vocero_consents', $consentRow);
            }
            $this->audit->log('vocero.created', null, 'vocero', $row['public_id']);
            $this->pdo->commit();
            return $row['public_id'];
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            if ($exception instanceof PDOException) {
                // A concurrent submission may have committed while this insert waited on UNIQUE.
                if (str_starts_with((string) $exception->getCode(), '23')) {
                    $existing = $this->findSubmissionId($submissionId);
                    if ($existing !== null) {
                        return $existing;
                    }
                }
                throw new RuntimeException('Unable to persist registration.');
            }
            throw $exception;
        }
    }

    public function list(array $filters): array
    {
        $page = filter_var($filters['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000000]]);
        $perPage = filter_var($filters['per_page'] ?? 25, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]);
        if ($page === false || $perPage === false) {
            throw new InvalidArgumentException('Invalid pagination.');
        }
        $where = [];
        $parameters = [];
        foreach (['status' => 40, 'city' => 100, 'main_network' => 20, 'previous_participation' => 60] as $field => $limit) {
            $value = $this->filterText($filters, $field, $limit);
            if ($value !== '') {
                if ($field === 'status' && !in_array($value, self::STATUSES, true)) {
                    throw new InvalidArgumentException('Invalid registration status.');
                }
                $where[] = $field . ' = ?';
                $parameters[] = $value;
            }
        }
        $from = $this->filterText($filters, 'date_from', 10);
        $to = $this->filterText($filters, 'date_to', 10);
        foreach ([$from, $to] as $date) {
            if ($date !== '' && (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $parts) || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]))) {
                throw new InvalidArgumentException('Invalid date filter.');
            }
        }
        if ($from !== '' && $to !== '' && $from > $to) {
            throw new InvalidArgumentException('Invalid date range.');
        }
        if ($from !== '') {
            $where[] = 'submitted_at >= ?';
            $parameters[] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $where[] = 'submitted_at <= ?';
            $parameters[] = $to . ' 23:59:59';
        }
        $search = $this->filterText($filters, 'search', 180);
        if ($search !== '') {
            $where[] = "(full_name LIKE ? ESCAPE '!' OR city LIKE ? ESCAPE '!' OR public_id = ? OR submission_id = ? OR cedula_idx = ? OR whatsapp_idx = ? OR email_idx = ?)";
            $like = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search) . '%';
            $index = $this->crypto->lookup($search);
            array_push($parameters, $like, $like, strtolower($search), strtolower($search), $index, $index, $index);
        }
        $clause = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
        $query = $this->pdo->prepare('SELECT COUNT(*) FROM voceros' . $clause);
        $query->execute($parameters);
        $total = (int) $query->fetchColumn();
        $query = $this->pdo->prepare('SELECT public_id, submission_id, status, full_name, city, main_network, previous_participation, submitted_at, created_at, updated_at, cedula_enc, whatsapp_enc FROM voceros' . $clause . ' ORDER BY submitted_at DESC, id DESC LIMIT ? OFFSET ?');
        foreach ($parameters as $index => $value) {
            $query->bindValue($index + 1, $value, PDO::PARAM_STR);
        }
        $query->bindValue(count($parameters) + 1, $perPage, PDO::PARAM_INT);
        $query->bindValue(count($parameters) + 2, ($page - 1) * $perPage, PDO::PARAM_INT);
        $query->execute();
        $items = array_map(function (array $row): array {
            foreach (['cedula', 'whatsapp'] as $field) {
                $value = $this->crypto->decrypt($row[$field . '_enc']);
                $row[$field] = str_repeat('*', max(0, strlen($value) - 4)) . substr($value, -4);
                unset($row[$field . '_enc']);
            }
            return $row;
        }, $query->fetchAll());
        return ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $perPage];
    }

    public function find(string $publicId): ?array
    {
        $query = $this->pdo->prepare('SELECT * FROM voceros WHERE public_id = ?');
        $query->execute([$publicId]);
        $row = $query->fetch();
        if ($row === false) {
            return null;
        }
        $detail = $this->decryptRow($row);
        $query = $this->pdo->prepare('SELECT * FROM vocero_consents WHERE vocero_id = ? ORDER BY accepted_at, id');
        $query->execute([$row['id']]);
        $detail['consents'] = array_map(function (array $consent): array {
            $consent['ip'] = $this->crypto->decrypt($consent['ip_enc']);
            unset($consent['ip_enc'], $consent['vocero_id']);
            return $consent;
        }, $query->fetchAll());
        $query = $this->pdo->prepare('SELECT id, author_id, body, created_at FROM vocero_notes WHERE vocero_id = ? ORDER BY created_at, id');
        $query->execute([$row['id']]);
        $detail['notes'] = $query->fetchAll();
        return $detail;
    }

    public function changeStatus(string $publicId, string $status, int $actorId): void
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException('Invalid registration status.');
        }
        $this->mutate($publicId, $actorId, function (array $row) use ($publicId, $status, $actorId): void {
            if ($row['status'] === $status) {
                return;
            }
            $query = $this->pdo->prepare('UPDATE voceros SET status = ?, updated_at = ? WHERE id = ?');
            $query->execute([$status, gmdate('Y-m-d H:i:s'), $row['id']]);
            $this->audit->log('vocero.status_changed', $actorId, 'vocero', $publicId, ['from_status' => $row['status'], 'to_status' => $status]);
        });
    }

    public function addNote(string $publicId, string $text, int $actorId): void
    {
        $text = trim($text);
        $length = preg_match_all('/./us', $text);
        if ($length === false || $length < 1 || $length > 2000) {
            throw new InvalidArgumentException('Notes require 1 to 2000 characters.');
        }
        $this->mutate($publicId, $actorId, function (array $row) use ($publicId, $text, $actorId): void {
            $now = gmdate('Y-m-d H:i:s');
            $this->insert('vocero_notes', ['vocero_id' => $row['id'], 'author_id' => $actorId, 'body' => $text, 'created_at' => $now]);
            $noteId = (int) $this->pdo->lastInsertId();
            $query = $this->pdo->prepare('UPDATE voceros SET updated_at = ? WHERE id = ?');
            $query->execute([$now, $row['id']]);
            $this->audit->log('vocero.note_added', $actorId, 'vocero', $publicId, ['note_id' => $noteId]);
        });
    }

    private function mutate(string $publicId, int $actorId, callable $mutation): void
    {
        $this->pdo->beginTransaction();
        try {
            $actor = $this->pdo->prepare('SELECT id FROM admin_users WHERE id = ? AND active = 1');
            $actor->execute([$actorId]);
            if ($actor->fetchColumn() === false) {
                throw new InvalidArgumentException('Invalid audit actor.');
            }
            // Serialize writes on MySQL so the audit records the actual previous status.
            $lock = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
            $query = $this->pdo->prepare('SELECT id, status FROM voceros WHERE public_id = ?' . $lock);
            $query->execute([$publicId]);
            $row = $query->fetch();
            if ($row === false) {
                throw new OutOfBoundsException('Registration not found.');
            }
            $mutation($row);
            $this->pdo->commit();
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            if ($exception instanceof PDOException) {
                throw new RuntimeException('Unable to update registration.');
            }
            throw $exception;
        }
    }

    private function findSubmissionId(string $submissionId): ?string
    {
        $query = $this->pdo->prepare('SELECT public_id FROM voceros WHERE submission_id = ?');
        $query->execute([$submissionId]);
        $result = $query->fetchColumn();
        return $result === false ? null : $result;
    }

    private function filterText(array $filters, string $field, int $limit): string
    {
        $value = $filters[$field] ?? '';
        if (!is_string($value) || strlen($value) > $limit * 4) {
            throw new InvalidArgumentException('Invalid filter.');
        }
        $length = preg_match_all('/./us', $value);
        if ($length === false || $length > $limit) {
            throw new InvalidArgumentException('Invalid filter.');
        }
        return trim($value);
    }

    private function insert(string $table, array $row): void
    {
        // Both identifiers and column names are internal allowlists, never caller-provided SQL.
        $query = $this->pdo->prepare('INSERT INTO ' . $table . ' (' . implode(', ', array_keys($row)) . ') VALUES (' . implode(', ', array_fill(0, count($row), '?')) . ')');
        $query->execute(array_values($row));
    }

    private function decryptRow(array $row): array
    {
        foreach (self::ENCRYPTED as $field) {
            $row[$field] = $row[$field . '_enc'] === null ? null : $this->crypto->decrypt($row[$field . '_enc']);
            unset($row[$field . '_enc'], $row[$field . '_idx']);
        }
        unset($row['id']);
        return $row;
    }
}
