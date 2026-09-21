<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/Http.php';
require_once __DIR__ . '/Crypto.php';
require_once __DIR__ . '/Audit.php';

/** Media accreditation records: owned by a media account, reviewed by administrators. */
final class MediaRepository
{
    public const STATUSES = ['Nuevo', 'En revisión', 'Aprobado', 'Rechazado'];
    public const MEDIA_TYPES = ['Radio', 'TV', 'Prensa escrita', 'Digital', 'Redes sociales'];
    public const PROGRAM_TYPES = ['Noticias', 'Magazine', 'Cultural', 'Deportivo', 'Entretenimiento', 'Opinión'];
    public const PROVINCES = [
        'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas',
        'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha',
        'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe',
    ];
    public const FIELDS = ['media_name', 'media_type', 'frequency_channel', 'program_name', 'program_type', 'province', 'city', 'contract', 'people_count', 'team', 'phone', 'contact_email', 'conditions_accepted'];
    private const ARCHIVED = 'Eliminado';
    private const EDITABLE = ['Nuevo', 'En revisión'];
    private const PLAIN = ['media_name', 'media_type', 'frequency_channel', 'program_name', 'program_type', 'province', 'city', 'contract', 'people_count'];
    private const ENCRYPTED = ['team', 'phone', 'contact_email'];
    private readonly Audit $audit;
    private readonly array $conditions;

    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, ?Audit $audit = null)
    {
        $this->audit = $audit ?? new Audit($pdo, $crypto);
        try {
            $catalogue = json_decode((string) file_get_contents(__DIR__ . '/../resources/media-consents.json'), true, 16, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw new RuntimeException('No se pudo cargar las condiciones de acreditación.');
        }
        $conditions = $catalogue['conditions'] ?? null;
        if (!is_array($conditions) || !is_string($conditions['version'] ?? null) || !is_string($conditions['text'] ?? null)) {
            throw new RuntimeException('No se pudo cargar las condiciones de acreditación.');
        }
        $this->conditions = $conditions;
    }

    /** Own record for the authenticated media account, or null before the first save. */
    public function forAccount(int $accountId): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM media_profiles WHERE account_id = ?');
        $statement->execute([$accountId]);
        $row = $statement->fetch();
        if ($row === false || $row['status'] === self::ARCHIVED) return null;
        return [...$this->present($row), 'editable' => in_array($row['status'], self::EDITABLE, true)];
    }

    public function saveForAccount(int $accountId, array $input, string $ip): array
    {
        $record = self::validate($input);
        $now = gmdate('Y-m-d H:i:s');
        $this->begin();
        try {
            $statement = $this->pdo->prepare('SELECT id, public_id, status FROM media_profiles WHERE account_id = ?' . $this->rowLock());
            $statement->execute([$accountId]);
            $existing = $statement->fetch();
            $values = [];
            foreach (self::PLAIN as $field) $values[$field] = $record[$field];
            foreach (self::ENCRYPTED as $field) $values[$field . '_enc'] = $this->crypto->encrypt($record[$field]);
            $values += [
                'conditions_version' => $this->conditions['version'], 'conditions_hash' => hash('sha256', $this->conditions['text']),
                'conditions_accepted_at' => $now, 'updated_at' => $now,
            ];
            if ($existing === false) {
                $publicId = bin2hex(random_bytes(16));
                $values = ['public_id' => $publicId, 'account_id' => $accountId, 'status' => 'Nuevo', ...$values, 'submitted_at' => $now];
                $columns = array_keys($values);
                $this->pdo->prepare('INSERT INTO media_profiles (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')')
                    ->execute(array_values($values));
                $this->audit->log('media.profile_created', null, 'media_profile', $publicId, [], $ip);
            } else {
                // Reviewed or retired records are read-only for their owner.
                if (!in_array($existing['status'], self::EDITABLE, true)) throw new Forbidden();
                $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($values)));
                $this->pdo->prepare('UPDATE media_profiles SET ' . $assignments . ' WHERE id = ?')->execute([...array_values($values), $existing['id']]);
                $this->audit->log('media.profile_updated', null, 'media_profile', $existing['public_id'], [], $ip);
            }
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
        return $this->forAccount($accountId) ?? throw new RuntimeException();
    }

    public function list(array $filters): array
    {
        $page = self::positiveInt($filters['page'] ?? '1', 1000000);
        $perPage = self::positiveInt($filters['per_page'] ?? '25', 100);
        if (!in_array($perPage, [25, 50, 100], true)) throw new InvalidArgumentException();
        $where = ['status <> ?']; $parameters = [self::ARCHIVED];
        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '') {
            if (!in_array($status, self::STATUSES, true)) throw new InvalidArgumentException();
            $where[] = 'status = ?'; $parameters[] = $status;
        }
        $type = trim((string) ($filters['media_type'] ?? ''));
        if ($type !== '') {
            if (!in_array($type, self::MEDIA_TYPES, true)) throw new InvalidArgumentException();
            $where[] = 'media_type = ?'; $parameters[] = $type;
        }
        $province = trim((string) ($filters['province'] ?? ''));
        if ($province !== '') {
            if (!in_array($province, self::PROVINCES, true)) throw new InvalidArgumentException();
            $where[] = 'province = ?'; $parameters[] = $province;
        }
        $search = trim((string) ($filters['search'] ?? ''));
        if (self::length($search) > 100) throw new InvalidArgumentException();
        if ($search !== '') {
            // Both supported collations already compare LIKE without case sensitivity.
            $like = '%' . addcslashes($search, '\\%_') . '%';
            $where[] = "(media_name LIKE ? ESCAPE '\\' OR program_name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\')";
            array_push($parameters, $like, $like, $like);
        }
        $condition = implode(' AND ', $where);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM media_profiles WHERE ' . $condition);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        $rows = $this->pdo->prepare('SELECT public_id, status, media_name, media_type, program_name, province, city, contract, people_count, submitted_at FROM media_profiles WHERE ' . $condition . ' ORDER BY submitted_at DESC, id DESC LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage));
        $rows->execute($parameters);
        $items = array_map(static fn (array $row): array => [...$row, 'people_count' => (int) $row['people_count']], $rows->fetchAll(PDO::FETCH_ASSOC));
        return ['items' => $items, 'page' => $page, 'per_page' => $perPage, 'total' => $total];
    }

    public function summary(): array
    {
        $statuses = array_fill_keys(self::STATUSES, 0);
        $query = $this->pdo->prepare('SELECT status, COUNT(*) AS count FROM media_profiles WHERE status <> ? GROUP BY status');
        $query->execute([self::ARCHIVED]);
        foreach ($query as $row) if (isset($statuses[$row['status']])) $statuses[$row['status']] = (int) $row['count'];
        $people = $this->pdo->prepare('SELECT COALESCE(SUM(people_count), 0) FROM media_profiles WHERE status <> ?');
        $people->execute([self::ARCHIVED]);
        return ['total' => array_sum($statuses), 'byStatus' => $statuses, 'people' => (int) $people->fetchColumn()];
    }

    public function find(string $publicId): ?array
    {
        $row = $this->row($publicId);
        if ($row === null) return null;
        $notes = $this->pdo->prepare('SELECT n.id, n.body, n.created_at, u.username AS author FROM media_notes n JOIN admin_users u ON u.id = n.author_id WHERE n.profile_id = ? ORDER BY n.created_at, n.id');
        $notes->execute([$row['id']]);
        $account = $this->pdo->prepare('SELECT email_enc, active, last_login_at FROM media_accounts WHERE id = ?');
        $account->execute([$row['account_id']]);
        $owner = $account->fetch();
        return [
            ...$this->present($row),
            'account_email' => $owner ? $this->crypto->decrypt($owner['email_enc']) : '',
            'account_active' => $owner ? (int) $owner['active'] === 1 : false,
            'last_login_at' => $owner['last_login_at'] ?? null,
            'notes' => array_map(static fn (array $note): array => [...$note, 'id' => (int) $note['id']], $notes->fetchAll(PDO::FETCH_ASSOC)),
        ];
    }

    public function changeStatus(string $publicId, string $status, int $actorId, string $ip = ''): void
    {
        if (!in_array($status, self::STATUSES, true)) throw new InvalidArgumentException();
        $this->mutate($publicId, function (array $row) use ($status, $actorId, $ip, $publicId): void {
            if ($row['status'] === $status) return;
            $this->pdo->prepare('UPDATE media_profiles SET status = ?, updated_at = ? WHERE id = ?')->execute([$status, gmdate('Y-m-d H:i:s'), $row['id']]);
            $this->audit->log('media.status_changed', $actorId, 'media_profile', $publicId, ['from_status' => $row['status'], 'to_status' => $status], $ip);
        });
    }

    public function addNote(string $publicId, string $text, int $actorId, string $ip = ''): void
    {
        $text = trim($text);
        if ($text === '' || self::length($text) > 2000) throw new InvalidArgumentException();
        $this->mutate($publicId, function (array $row) use ($text, $actorId, $ip, $publicId): void {
            $this->pdo->prepare('INSERT INTO media_notes (profile_id, author_id, body, created_at) VALUES (?, ?, ?, ?)')
                ->execute([$row['id'], $actorId, $text, gmdate('Y-m-d H:i:s')]);
            $this->audit->log('media.note_added', $actorId, 'media_profile', $publicId, ['note_id' => (int) $this->pdo->lastInsertId()], $ip);
        });
    }

    /** Safe retirement: hides the record and disables its account; nothing is physically deleted. */
    public function archive(string $publicId, int $actorId, string $ip = ''): void
    {
        $this->mutate($publicId, function (array $row) use ($actorId, $ip, $publicId): void {
            $now = gmdate('Y-m-d H:i:s');
            $this->pdo->prepare('UPDATE media_profiles SET status = ?, updated_at = ? WHERE id = ?')->execute([self::ARCHIVED, $now, $row['id']]);
            $this->pdo->prepare('UPDATE media_accounts SET active = 0, updated_at = ? WHERE id = ?')->execute([$now, $row['account_id']]);
            $this->audit->log('media.archived', $actorId, 'media_profile', $publicId, [], $ip);
        });
    }

    /** Accounts created without a saved record yet. */
    public function pendingAccounts(): array
    {
        $rows = $this->pdo->query('SELECT a.public_id, a.email_enc, a.created_at, a.last_login_at FROM media_accounts a LEFT JOIN media_profiles m ON m.account_id = a.id WHERE a.active = 1 AND m.id IS NULL ORDER BY a.created_at DESC, a.id DESC LIMIT 200');
        $items = [];
        foreach ($rows as $row) {
            $items[] = ['public_id' => $row['public_id'], 'email' => $this->crypto->decrypt($row['email_enc']), 'created_at' => $row['created_at'], 'last_login_at' => $row['last_login_at']];
        }
        return $items;
    }

    public function archiveAccount(string $publicId, int $actorId, string $ip = ''): void
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $this->begin();
        try {
            $statement = $this->pdo->prepare('SELECT a.id FROM media_accounts a LEFT JOIN media_profiles m ON m.account_id = a.id WHERE a.public_id = ? AND a.active = 1 AND m.id IS NULL');
            $statement->execute([$publicId]);
            $id = $statement->fetchColumn();
            if ($id === false) throw new OutOfBoundsException();
            $this->pdo->prepare('UPDATE media_accounts SET active = 0, updated_at = ? WHERE id = ?')->execute([gmdate('Y-m-d H:i:s'), $id]);
            $this->audit->log('media_account.archived', $actorId, 'media_account', $publicId, [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
    }

    /** Decrypted rows for the administrative CSV export. */
    public function exportRows(array $filters): array
    {
        $rows = []; $page = 1;
        do {
            $result = $this->list([...$filters, 'page' => (string) $page, 'per_page' => '100']);
            foreach ($result['items'] as $item) {
                $detail = $this->find($item['public_id']);
                if ($detail !== null) $rows[] = $detail;
            }
            $page++;
        } while (($page - 1) * 100 < $result['total']);
        return $rows;
    }

    public static function validate(array $input): array
    {
        if (array_diff(array_keys($input), self::FIELDS) !== [] || array_diff(self::FIELDS, array_keys($input)) !== []) throw new InvalidArgumentException();
        if ($input['conditions_accepted'] !== true) throw new InvalidArgumentException();
        $text = static function (mixed $value, int $max, bool $multiline = false): string {
            if (!is_string($value)) throw new InvalidArgumentException();
            $value = str_replace(["\r\n", "\r"], "\n", $value);
            $value = trim(preg_replace($multiline ? '/[^\P{C}\n]+/u' : '/\p{C}+/u', ' ', $value) ?? '');
            if ($value === '' || self::length($value) > $max) throw new InvalidArgumentException();
            return $value;
        };
        $choice = static function (mixed $value, array $allowed): string {
            if (!is_string($value) || !in_array($value, $allowed, true)) throw new InvalidArgumentException();
            return $value;
        };
        if (!is_int($input['people_count']) || !in_array($input['people_count'], [1, 2], true)) throw new InvalidArgumentException();
        $phone = $text($input['phone'], 25);
        if (preg_match('/^\+?[0-9][0-9 ()-]{6,23}$/D', $phone) !== 1) throw new InvalidArgumentException();
        $email = strtolower($text($input['contact_email'], 180));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) throw new InvalidArgumentException();
        return [
            'media_name' => $text($input['media_name'], 140),
            'media_type' => $choice($input['media_type'], self::MEDIA_TYPES),
            'frequency_channel' => $text($input['frequency_channel'], 120),
            'program_name' => $text($input['program_name'], 160),
            'program_type' => $choice($input['program_type'], self::PROGRAM_TYPES),
            'province' => $choice($input['province'], self::PROVINCES),
            'city' => $text($input['city'], 100),
            'contract' => $choice($input['contract'], ['Sí', 'No']),
            'people_count' => $input['people_count'],
            'team' => $text($input['team'], 500, true),
            'phone' => $phone,
            'contact_email' => $email,
        ];
    }

    private function present(array $row): array
    {
        $result = ['public_id' => $row['public_id'], 'status' => $row['status'], 'submitted_at' => $row['submitted_at'], 'updated_at' => $row['updated_at']];
        foreach (self::PLAIN as $field) $result[$field] = $field === 'people_count' ? (int) $row[$field] : (string) $row[$field];
        foreach (self::ENCRYPTED as $field) $result[$field] = $this->crypto->decrypt($row[$field . '_enc']);
        return $result;
    }

    private function row(string $publicId): ?array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $statement = $this->pdo->prepare('SELECT * FROM media_profiles WHERE public_id = ? AND status <> ?' . $this->rowLock());
        $statement->execute([$publicId, self::ARCHIVED]);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    private function mutate(string $publicId, callable $mutation): void
    {
        $this->begin();
        try {
            $row = $this->row($publicId);
            if ($row === null) throw new OutOfBoundsException();
            $mutation($row);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
    }

    /** Unicode scalar count without requiring mbstring; invalid UTF-8 is rejected. */
    private static function length(string $value): int
    {
        $length = strlen($value) <= 16384 ? preg_match_all('/./us', $value) : false;
        if ($length === false) throw new InvalidArgumentException();
        return $length;
    }

    private static function positiveInt(mixed $value, int $max): int
    {
        if ((!is_string($value) && !is_int($value)) || preg_match('/^[1-9][0-9]{0,6}$/D', (string) $value) !== 1 || (int) $value > $max) throw new InvalidArgumentException();
        return (int) $value;
    }

    private function rowLock(): string
    {
        return $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' && $this->pdo->inTransaction() ? ' FOR UPDATE' : '';
    }

    private function begin(): void
    {
        if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') $this->pdo->exec('BEGIN IMMEDIATE');
        else $this->pdo->beginTransaction();
    }

    private function commit(): void
    {
        if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') $this->pdo->exec('COMMIT');
        else $this->pdo->commit();
    }

    private function rollBack(): void
    {
        try {
            if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') $this->pdo->exec('ROLLBACK');
            elseif ($this->pdo->inTransaction()) $this->pdo->rollBack();
        } catch (Throwable) {
            // Preserve the original failure rather than its cleanup error.
        }
    }
}
