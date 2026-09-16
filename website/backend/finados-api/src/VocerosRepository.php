<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use PDOException;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/SheetsOutbox.php';

final class DuplicateRegistration extends RuntimeException {}
final class RegistrationRateLimit extends RuntimeException {}

final class VocerosRepository
{
    public const STATUSES = ['Nuevo', 'En revisión', 'Aprobado', 'Rechazado', 'Pendiente de autorización'];
    public const LEVELS = [
        0 => 'En preparación', 1 => 'Primer paso', 2 => 'Gorra', 3 => 'Kit completo',
        4 => 'Trae a los tuyos', 5 => 'Noche de concierto', 6 => 'Tope',
    ];
    public const TRAFFIC_LIGHTS = ['red', 'yellow', 'green'];
    public const KIT_STATUSES = ['pendiente', 'retirado'];
    private const ENCRYPTED = ['cedula', 'birth_date', 'whatsapp', 'email', 'representative_name', 'representative_cedula', 'representative_phone', 'representative_email'];
    private const INDEXED = ['cedula', 'whatsapp', 'email', 'representative_cedula', 'representative_phone', 'representative_email'];
    private readonly Audit $audit;
    private ?bool $progressSchema = null;

    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, ?Audit $audit = null)
    {
        $this->audit = $audit ?? new Audit($pdo, $crypto);
    }

    public function create(array $record, array $consents, bool $allowReplay = true): string
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
        $ownsTransaction = !$this->pdo->inTransaction();
        if ($ownsTransaction) $this->pdo->beginTransaction();
        try {
            $existing = $this->findSubmissionId($submissionId);
            if ($existing !== null) {
                if (!$allowReplay) throw new InvalidArgumentException('Submission identifier unavailable.');
                if ($ownsTransaction) $this->pdo->commit();
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
            $this->audit->log('vocero.created', null, 'vocero', $row['public_id'], [], $record['registration_ip'] ?? '');
            if ($ownsTransaction) $this->pdo->commit();
            return $row['public_id'];
        } catch (Throwable $exception) {
            if ($ownsTransaction) $this->pdo->rollBack();
            if ($exception instanceof PDOException) {
                // A concurrent submission may have committed while this insert waited on UNIQUE.
                if ($allowReplay && $ownsTransaction && str_starts_with((string) $exception->getCode(), '23')) {
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

    /** Serialize public intake so deduplication and the rolling quota are atomic. */
    public function createPublic(array $record, array $consents, string $ip): array
    {
        $mysql = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
        $locked = false;
        try {
            if ($mysql) {
                $query = $this->pdo->prepare('SELECT GET_LOCK(?, 10)');
                $query->execute(['finados.voceros.public-registration']);
                if ((int) $query->fetchColumn() !== 1) throw new RuntimeException('Registration is busy.');
                $locked = true;
            }
            $this->pdo->beginTransaction();
            if (!$mysql) {
                // Acquire SQLite's write reservation before reading the shared quota.
                $this->pdo->exec('UPDATE schema_migrations SET applied_at = applied_at WHERE 1 = 0');
            }
            $existing = $this->findSubmissionId($record['submission_id']);
            if ($existing !== null) {
                $sheets = (new SheetsOutbox($this->pdo, $this->crypto))->ensure($existing);
                $this->pdo->commit();
                return ['public_id' => $existing, 'created' => false, 'sheets' => $sheets];
            }
            $query = $this->pdo->prepare('SELECT COUNT(*) FROM voceros WHERE cedula_idx = ? OR email_idx = ? OR whatsapp_idx = ?');
            $query->execute([$this->crypto->lookup($record['cedula']), $this->crypto->lookup($record['email']), $this->crypto->lookup($record['whatsapp'])]);
            if ((int) $query->fetchColumn() > 0) throw new DuplicateRegistration('Duplicate registration.');
            $query = $this->pdo->prepare("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.created' AND ip_hash = ? AND created_at > ?");
            $query->execute([$this->crypto->lookup($ip), gmdate('Y-m-d H:i:s', time() - 900)]);
            if ((int) $query->fetchColumn() >= 5) throw new RegistrationRateLimit('Registration quota reached.');
            $record['registration_ip'] = $ip;
            $publicId = $this->create($record, $consents);
            (new SheetsOutbox($this->pdo, $this->crypto))->ensure($publicId);
            $this->pdo->commit();
            return ['public_id' => $publicId, 'created' => true, 'sheets' => 'queued'];
        } catch (Throwable $exception) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $exception;
        } finally {
            if ($locked) {
                $query = $this->pdo->prepare('SELECT RELEASE_LOCK(?)');
                $query->execute(['finados.voceros.public-registration']);
            }
        }
    }

    public function syncSheets(string $submissionId, callable $send): string
    {
        return (new SheetsOutbox($this->pdo, $this->crypto))->deliver($submissionId, $send);
    }

    /** Caller holds the account/vocero locks and owns the complete profile/photo transaction. */
    public function updateProfile(int $voceroId, array $record, array $consents): bool
    {
        if (!$this->pdo->inTransaction()) throw new RuntimeException('Profile update requires a transaction.');
        $query = $this->pdo->prepare('SELECT * FROM voceros WHERE id = ?');
        $query->execute([$voceroId]);
        $stored = $query->fetch();
        if ($stored === false) throw new OutOfBoundsException('Registration not found.');
        $current = $this->decryptRow($stored);
        $changes = [];
        foreach (['full_name', 'age_at_submission', 'city', 'main_network', 'previous_participation', 'community_source', 'kit_pickup',
            'status', 'tiktok', 'instagram', 'facebook', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $field) {
            if ((string) $current[$field] !== (string) $record[$field]) $changes[$field] = $record[$field];
        }
        foreach (self::ENCRYPTED as $field) {
            if ($current[$field] === $record[$field]) continue;
            $changes[$field . '_enc'] = $this->crypto->encrypt($record[$field]);
            if (in_array($field, self::INDEXED, true)) $changes[$field . '_idx'] = $this->crypto->lookup($record[$field]);
        }
        if ($changes !== []) {
            $changes['updated_at'] = gmdate('Y-m-d H:i:s');
            $query = $this->pdo->prepare('UPDATE voceros SET ' . implode(', ', array_map(static fn (string $field): string => $field . ' = ?', array_keys($changes))) . ' WHERE id = ?');
            $query->execute([...array_values($changes), $voceroId]);
        }
        $appended = false;
        foreach ($consents as $consent) {
            $query = $this->pdo->prepare('SELECT id FROM vocero_consents WHERE vocero_id = ? AND consent_type = ? AND text_hash = ?');
            $query->execute([$voceroId, $consent['consent_type'], $consent['text_hash']]);
            // Historical uniqueness is by exact text. Never rewrite an earlier acceptance.
            if ($query->fetchColumn() !== false) continue;
            $row = ['vocero_id' => $voceroId];
            foreach (['consent_type', 'accepted', 'text_version', 'text_hash', 'accepted_at', 'user_agent', 'source_url', 'method'] as $field) $row[$field] = $consent[$field];
            $row['ip_enc'] = $this->crypto->encrypt($consent['ip']);
            $this->insert('vocero_consents', $row);
            $appended = true;
        }
        return $changes !== [] || $appended;
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
        $detail['progress'] = $this->progressForVocero((int) $row['id']);
        return $detail;
    }

    /** Returns progress and five stable video slots. Older test databases get safe defaults. */
    public function progressForVocero(int $voceroId): array
    {
        $default = ['followers_count' => 0, 'level' => 0, 'level_label' => self::LEVELS[0], 'traffic_light' => 'red', 'videos_unlocked' => 0, 'kit_status' => 'pendiente', 'updated_at' => null];
        if (!$this->hasProgressSchema()) return $default + ['videos' => $this->videoSlots([])];
        $query = $this->pdo->prepare('SELECT followers_count, level, traffic_light, videos_unlocked, kit_status, updated_at FROM vocero_progress WHERE vocero_id = ?');
        $query->execute([$voceroId]);
        $row = $query->fetch() ?: [];
        $progress = array_merge($default, [
            'followers_count' => (int) ($row['followers_count'] ?? 0),
            'level' => (int) ($row['level'] ?? 0),
            'traffic_light' => in_array($row['traffic_light'] ?? '', self::TRAFFIC_LIGHTS, true) ? $row['traffic_light'] : 'red',
            'videos_unlocked' => (int) ($row['videos_unlocked'] ?? 0),
            'kit_status' => in_array($row['kit_status'] ?? '', self::KIT_STATUSES, true) ? $row['kit_status'] : 'pendiente',
            'updated_at' => $row['updated_at'] ?? null,
        ]);
        $progress['level'] = max(0, min(6, $progress['level']));
        $progress['level_label'] = self::LEVELS[$progress['level']];
        $progress['videos_unlocked'] = max(0, min(5, $progress['videos_unlocked']));
        $query = $this->pdo->prepare('SELECT slot, url, status, submitted_at, updated_at FROM vocero_videos WHERE vocero_id = ? ORDER BY slot');
        $query->execute([$voceroId]);
        $progress['videos'] = $this->videoSlots($query->fetchAll(), $progress['videos_unlocked']);
        return $progress;
    }

    public function updateProgress(string $publicId, array $input, int $actorId, string $ip = ''): void
    {
        if (!$this->hasProgressSchema()) throw new RuntimeException('Progress schema unavailable.');
        $followers = filter_var($input['followers_count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 1000000000]]);
        $level = filter_var($input['level'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 6]]);
        $unlocked = filter_var($input['videos_unlocked'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 5]]);
        $light = $input['traffic_light'] ?? null;
        $kit = $input['kit_status'] ?? null;
        if ($followers === false || $level === false || $unlocked === false || !is_string($light) || !in_array($light, self::TRAFFIC_LIGHTS, true) || !is_string($kit) || !in_array($kit, self::KIT_STATUSES, true)) {
            throw new InvalidArgumentException('Invalid progress.');
        }
        $this->mutate($publicId, $actorId, function (array $row) use ($publicId, $actorId, $ip, $followers, $level, $unlocked, $light, $kit): void {
            $now = gmdate('Y-m-d H:i:s');
            $values = [$row['id'], $followers, $level, $light, $unlocked, $kit, $now];
            if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
                $sql = 'INSERT INTO vocero_progress (vocero_id, followers_count, level, traffic_light, videos_unlocked, kit_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE followers_count = VALUES(followers_count), level = VALUES(level), traffic_light = VALUES(traffic_light), videos_unlocked = VALUES(videos_unlocked), kit_status = VALUES(kit_status), updated_at = VALUES(updated_at)';
            } else {
                $sql = 'INSERT INTO vocero_progress (vocero_id, followers_count, level, traffic_light, videos_unlocked, kit_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(vocero_id) DO UPDATE SET followers_count = excluded.followers_count, level = excluded.level, traffic_light = excluded.traffic_light, videos_unlocked = excluded.videos_unlocked, kit_status = excluded.kit_status, updated_at = excluded.updated_at';
            }
            $this->pdo->prepare($sql)->execute($values);
            $this->audit->log('vocero.progress_updated', $actorId, 'vocero', $publicId, ['followers_count' => $followers, 'level' => $level, 'traffic_light' => $light, 'videos_unlocked' => $unlocked, 'kit_status' => $kit], $ip);
        });
    }

    public function saveVideoByVoceroId(int $voceroId, int $slot, string $url, string $ip = ''): void
    {
        if (!$this->hasProgressSchema()) throw new RuntimeException('Progress schema unavailable.');
        if ($slot < 1 || $slot > 5 || !filter_var($url, FILTER_VALIDATE_URL) || !str_starts_with(strtolower($url), 'https://') || strlen($url) > 500) throw new InvalidArgumentException('Invalid video URL.');
        $this->pdo->beginTransaction();
        try {
            $query = $this->pdo->prepare('SELECT public_id FROM voceros WHERE id = ?'); $query->execute([$voceroId]); $publicId = $query->fetchColumn();
            if (!is_string($publicId)) throw new OutOfBoundsException('Registration not found.');
            $query = $this->pdo->prepare('SELECT videos_unlocked FROM vocero_progress WHERE vocero_id = ?'); $query->execute([$voceroId]);
            $unlocked = (int) $query->fetchColumn();
            if ($slot > $unlocked) throw new OutOfBoundsException('Video slot locked.');
            $now = gmdate('Y-m-d H:i:s');
            $values = [$voceroId, $slot, $url, 'submitted', $now, $now];
            if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') $sql = 'INSERT INTO vocero_videos (vocero_id, slot, url, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE url = VALUES(url), status = VALUES(status), submitted_at = VALUES(submitted_at), updated_at = VALUES(updated_at)';
            else $sql = 'INSERT INTO vocero_videos (vocero_id, slot, url, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(vocero_id, slot) DO UPDATE SET url = excluded.url, status = excluded.status, submitted_at = excluded.submitted_at, updated_at = excluded.updated_at';
            $this->pdo->prepare($sql)->execute($values);
            $this->audit->log('vocero.video_submitted', null, 'vocero', $publicId, ['slot' => $slot], $ip);
            $this->pdo->commit();
        } catch (Throwable $exception) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $exception;
        }
    }

    /** Only the authenticated admin detail consumes this minimal metadata. */
    public function accessMetadata(string $publicId): array
    {
        $query = $this->pdo->prepare('SELECT p.width, p.height, p.created_at, a.active FROM voceros v LEFT JOIN vocero_photos p ON p.vocero_id = v.id LEFT JOIN vocero_account_links l ON l.vocero_id = v.id LEFT JOIN vocero_accounts a ON a.id = l.account_id WHERE v.public_id = ?');
        $query->execute([$publicId]); $row = $query->fetch();
        if (!$row) throw new OutOfBoundsException();
        return ['photo' => ['available' => $row['width'] !== null, 'width' => $row['width'] === null ? null : (int) $row['width'], 'height' => $row['height'] === null ? null : (int) $row['height'], 'created_at' => $row['created_at']], 'account' => ['active' => (int) ($row['active'] ?? 0) === 1]];
    }

    public function changeStatus(string $publicId, string $status, int $actorId, string $ip = ''): void
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException('Invalid registration status.');
        }
        $this->mutate($publicId, $actorId, function (array $row) use ($publicId, $status, $actorId, $ip): void {
            if ($row['status'] === $status) {
                return;
            }
            $query = $this->pdo->prepare('UPDATE voceros SET status = ?, updated_at = ? WHERE id = ?');
            $query->execute([$status, gmdate('Y-m-d H:i:s'), $row['id']]);
            $this->audit->log('vocero.status_changed', $actorId, 'vocero', $publicId, ['from_status' => $row['status'], 'to_status' => $status], $ip);
        });
    }

    public function addNote(string $publicId, string $text, int $actorId, string $ip = ''): void
    {
        $text = trim($text);
        $length = preg_match_all('/./us', $text);
        if ($length === false || $length < 1 || $length > 2000) {
            throw new InvalidArgumentException('Notes require 1 to 2000 characters.');
        }
        $this->mutate($publicId, $actorId, function (array $row) use ($publicId, $text, $actorId, $ip): void {
            $now = gmdate('Y-m-d H:i:s');
            $this->insert('vocero_notes', ['vocero_id' => $row['id'], 'author_id' => $actorId, 'body' => $text, 'created_at' => $now]);
            $noteId = (int) $this->pdo->lastInsertId();
            $query = $this->pdo->prepare('UPDATE voceros SET updated_at = ? WHERE id = ?');
            $query->execute([$now, $row['id']]);
            $this->audit->log('vocero.note_added', $actorId, 'vocero', $publicId, ['note_id' => $noteId], $ip);
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

    private function hasProgressSchema(): bool
    {
        if ($this->progressSchema !== null) return $this->progressSchema;
        if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
            $query = $this->pdo->prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('vocero_progress', 'vocero_videos')");
            $query->execute();
            return $this->progressSchema = count($query->fetchAll()) === 2;
        }
        try {
            $query = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('vocero_progress', 'vocero_videos')");
            $query->execute();
            return $this->progressSchema = (int) $query->fetchColumn() === 2;
        } catch (PDOException $exception) {
            // The lock-protocol test wraps SQLite as MySQL; its metadata table is absent.
            if (!preg_match('/no such table:\s*information_schema\.tables/i', $exception->getMessage())) throw $exception;
            return $this->progressSchema = false;
        }
    }

    private function videoSlots(array $rows, int $unlocked = 0): array
    {
        $bySlot = [];
        foreach ($rows as $row) $bySlot[(int) $row['slot']] = ['slot' => (int) $row['slot'], 'unlocked' => (int) $row['slot'] <= $unlocked, 'url' => (string) ($row['url'] ?? ''), 'status' => (string) ($row['status'] ?? 'empty'), 'submitted_at' => $row['submitted_at'] ?? null, 'updated_at' => $row['updated_at'] ?? null];
        return array_map(static fn (int $slot): array => $bySlot[$slot] ?? ['slot' => $slot, 'unlocked' => $slot <= $unlocked, 'url' => '', 'status' => 'empty', 'submitted_at' => null, 'updated_at' => null], range(1, 5));
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
