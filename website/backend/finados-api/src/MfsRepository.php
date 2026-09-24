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
require_once __DIR__ . '/VocerosRepository.php';
require_once __DIR__ . '/MfsPhotoStorage.php';

/**
 * Mushuc Freestyle 2026: inscripción de participantes con una audición en TikTok, revisada por
 * administración. Tablas propias (`mfs_*`), sesión propia y almacén de fotos propio; no comparte
 * nada con Voceros, Medios, Emprendedores ni Creadoras más allá de los administradores y la auditoría.
 */
final class MfsRepository
{
    public const STATUSES = ['Nuevo', 'En revisión', 'Aprobado', 'Rechazado', 'Seleccionado'];
    public const ARCHIVED = 'Archivado';
    /** Campo del formulario → columna. Llegan como texto multipart, igual que en los demás programas. */
    public const FIELDS = [
        'nombre_completo' => 'full_name', 'nombre_artistico' => 'stage_name', 'whatsapp' => 'whatsapp',
        'audicion_tiktok' => 'audition_url', 'declaracion_video' => 'video_declaration',
    ];
    /** Casilla del formulario → clave del catálogo. Las tres son obligatorias para inscribirse. */
    public const CONSENTS = ['consentimiento_bases' => 'bases', 'autorizacion_imagen' => 'image', 'consentimiento_datos' => 'data'];
    private const EDITABLE = ['Nuevo', 'En revisión'];
    private const TIKTOK_HOSTS = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'];
    private readonly Audit $audit;
    private readonly array $catalogue;

    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, ?Audit $audit = null)
    {
        $this->audit = $audit ?? new Audit($pdo, $crypto);
        try {
            $catalogue = json_decode((string) file_get_contents(__DIR__ . '/../resources/mfs-consents.json'), true, 16, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw new RuntimeException('No se pudo cargar los consentimientos de Mushuc Freestyle.');
        }
        foreach (self::CONSENTS as $type) {
            if (!is_string($catalogue[$type]['version'] ?? null) || !is_string($catalogue[$type]['text'] ?? null)) throw new RuntimeException('No se pudo cargar los consentimientos de Mushuc Freestyle.');
        }
        $this->catalogue = $catalogue;
    }

    /** Registro propio de la cuenta autenticada, o null antes del primer guardado. */
    public function forAccount(int $accountId): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM mfs_profiles WHERE account_id = ?');
        $statement->execute([$accountId]);
        $row = $statement->fetch();
        if ($row === false || $row['status'] === self::ARCHIVED) return null;
        $id = (int) $row['id'];
        return [
            ...$this->present($row),
            'editable' => in_array($row['status'], self::EDITABLE, true),
            'photo' => $this->photoMeta($id),
            'consents' => $this->consents($id),
        ];
    }

    /**
     * Guarda la inscripción del participante. La foto es obligatoria en el primer guardado; la audición
     * queda fija desde que se envía y solo administración puede corregirla.
     */
    public function saveForAccount(int $accountId, array $fields, ?array $upload, MfsPhotoStorage $storage, string $ip): array
    {
        $record = self::validate($fields);
        $now = gmdate('Y-m-d H:i:s');
        $photo = null;
        if ($upload !== null) {
            try { $photo = $storage->stage($upload['tmp_name'], (int) $upload['size']); }
            catch (RuntimeException) { throw new InvalidArgumentException(); }
        }
        $promoted = false; $oldKey = false; $publicId = '';
        $this->begin();
        try {
            $statement = $this->pdo->prepare('SELECT id, public_id, status, audition_url FROM mfs_profiles WHERE account_id = ?' . $this->rowLock());
            $statement->execute([$accountId]);
            $existing = $statement->fetch();
            $values = [
                'full_name' => $record['full_name'], 'stage_name' => $record['stage_name'],
                'whatsapp_enc' => $this->crypto->encrypt($record['whatsapp']), 'whatsapp_idx' => $this->crypto->lookup($record['whatsapp']),
                'updated_at' => $now,
            ];
            if ($existing === false) {
                if ($photo === null) throw new InvalidArgumentException();
                $this->assertUnique($record, null);
                $publicId = bin2hex(random_bytes(16));
                $values = ['public_id' => $publicId, 'account_id' => $accountId, 'status' => 'Nuevo', ...$values,
                    'audition_url' => $record['audition_url'], 'audition_submitted_at' => $now, 'video_declaration_at' => $now, 'submitted_at' => $now];
                $columns = array_keys($values);
                $this->pdo->prepare('INSERT INTO mfs_profiles (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')')
                    ->execute(array_values($values));
                $profileId = (int) $this->pdo->lastInsertId();
                $this->audit->log('mfs.profile_created', null, 'mfs_profile', $publicId, [], $ip);
            } else {
                // Una inscripción revisada o retirada es de solo lectura para su dueño.
                if (!in_array($existing['status'], self::EDITABLE, true)) throw new Forbidden();
                // La audición enviada no se reemplaza desde la cuenta.
                if ($record['audition_url'] !== $existing['audition_url']) throw new InvalidArgumentException();
                $this->assertUnique($record, (int) $existing['id']);
                $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($values)));
                $this->pdo->prepare('UPDATE mfs_profiles SET ' . $assignments . ' WHERE id = ?')->execute([...array_values($values), $existing['id']]);
                $profileId = (int) $existing['id'];
                $publicId = $existing['public_id'];
                $this->audit->log('mfs.profile_updated', null, 'mfs_profile', $publicId, [], $ip);
            }
            $this->recordConsents($profileId, $ip, $now);
            if ($photo !== null) {
                $storage->promote($photo); $promoted = true;
                $previous = $this->pdo->prepare('SELECT storage_key FROM mfs_photos WHERE profile_id = ?');
                $previous->execute([$profileId]);
                $oldKey = $previous->fetchColumn();
                $photoValues = [$photo['storage_key'], $photo['mime_type'], $photo['bytes'], $photo['sha256'], $photo['width'], $photo['height'], $now, $profileId];
                if ($oldKey === false) $this->pdo->prepare('INSERT INTO mfs_photos (storage_key, content_type, bytes, sha256, width, height, created_at, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute($photoValues);
                else $this->pdo->prepare('UPDATE mfs_photos SET storage_key = ?, content_type = ?, bytes = ?, sha256 = ?, width = ?, height = ?, created_at = ? WHERE profile_id = ?')->execute($photoValues);
                $this->audit->log('mfs.photo_saved', null, 'mfs_profile', $publicId, [], $ip);
            }
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            if ($photo !== null) { try { $promoted ? $storage->delete($photo['storage_key']) : $storage->discard($photo); } catch (Throwable) { /* conservar el error original */ } }
            throw $error;
        }
        if (is_string($oldKey)) { try { $storage->delete($oldKey); } catch (Throwable) { /* un cifrado huérfano es inofensivo */ } }
        return $this->forAccount($accountId) ?? throw new RuntimeException();
    }

    /** Un WhatsApp identifica una sola inscripción activa; las archivadas liberan su dato. */
    private function assertUnique(array $record, ?int $exceptId): void
    {
        $query = $this->pdo->prepare('SELECT id FROM mfs_profiles WHERE whatsapp_idx = ? AND status <> ?' . ($exceptId === null ? '' : ' AND id <> ?'));
        $lookup = $this->crypto->lookup($record['whatsapp']);
        $query->execute($exceptId === null ? [$lookup, self::ARCHIVED] : [$lookup, self::ARCHIVED, $exceptId]);
        if ($query->fetchColumn() !== false) throw new DuplicateRegistration();
    }

    public static function validate(array $fields): array
    {
        $allowed = [...array_keys(self::FIELDS), ...array_keys(self::CONSENTS)];
        if (array_diff(array_keys($fields), $allowed) !== [] || array_diff($allowed, array_keys($fields)) !== []) throw new InvalidArgumentException();
        foreach ($fields as $value) if (!is_string($value)) throw new InvalidArgumentException();
        $text = static function (string $name, int $max, int $min = 0) use ($fields): string {
            $value = trim(preg_replace('/\s+/u', ' ', preg_replace('/\p{C}+/u', ' ', $fields[$name]) ?? '') ?? '');
            $length = self::length($value);
            if ($length < $min || $length > $max) throw new InvalidArgumentException();
            return $value;
        };
        $record = [
            'full_name' => $text('nombre_completo', 160, 5), 'stage_name' => $text('nombre_artistico', 80),
            'whatsapp' => $text('whatsapp', 10, 10), 'audition_url' => $text('audicion_tiktok', 500, 12),
        ];
        if (preg_match('/^09\d{8}$/D', $record['whatsapp']) !== 1) throw new InvalidArgumentException();
        if (!self::isTikTokUrl($record['audition_url'])) throw new InvalidArgumentException();
        if ($text('declaracion_video', 4, 1) !== 'Sí') throw new InvalidArgumentException();
        foreach (array_keys(self::CONSENTS) as $consent) if ($text($consent, 4, 1) !== 'Sí') throw new InvalidArgumentException();
        return $record;
    }

    /** Solo enlaces HTTPS de TikTok, sin credenciales ni puertos. */
    public static function isTikTokUrl(string $url): bool
    {
        if (strlen($url) > 500 || filter_var($url, FILTER_VALIDATE_URL) === false) return false;
        $parts = parse_url($url);
        if (!is_array($parts) || strtolower($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) return false;
        return in_array(strtolower($parts['host'] ?? ''), self::TIKTOK_HOSTS, true) && ($parts['path'] ?? '') !== '' && ($parts['path'] ?? '') !== '/';
    }

    /** Evidencia solo de agregado: se escribe una fila nueva únicamente si cambia el texto aceptado. */
    private function recordConsents(int $profileId, string $ip, string $now): void
    {
        $latest = $this->pdo->prepare('SELECT text_hash FROM mfs_consents WHERE profile_id = ? AND consent_type = ? AND accepted = 1 ORDER BY recorded_at DESC, id DESC LIMIT 1');
        $insert = $this->pdo->prepare('INSERT INTO mfs_consents (profile_id, consent_type, accepted, text_version, text_hash, ip_hash, recorded_at) VALUES (?, ?, 1, ?, ?, ?, ?)');
        foreach (self::CONSENTS as $type) {
            $hash = hash('sha256', $this->catalogue[$type]['text']);
            $latest->execute([$profileId, $type]);
            if ($latest->fetchColumn() === $hash) continue;
            $insert->execute([$profileId, $type, $this->catalogue[$type]['version'], $hash, $this->crypto->lookup($ip), $now]);
        }
    }

    /** Respuesta vigente por consentimiento, sin IP ni hashes. */
    private function consents(int $profileId): array
    {
        $statement = $this->pdo->prepare('SELECT consent_type, accepted, text_version, recorded_at FROM mfs_consents WHERE profile_id = ? ORDER BY recorded_at, id');
        $statement->execute([$profileId]);
        $current = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $current[$row['consent_type']] = ['consent_type' => (string) $row['consent_type'], 'accepted' => (int) $row['accepted'], 'text_version' => (string) $row['text_version'], 'recorded_at' => (string) $row['recorded_at']];
        }
        return array_values($current);
    }

    // ---------------------------------------------------------------- administración

    public function list(array $filters): array
    {
        $page = self::positiveInt($filters['page'] ?? '1', 1000000);
        $perPage = self::positiveInt($filters['per_page'] ?? '25', 100);
        if (!in_array($perPage, [25, 50, 100], true)) throw new InvalidArgumentException();
        $where = []; $parameters = [];
        $status = trim((string) ($filters['status'] ?? ''));
        if ($status === '') { $where[] = 'p.status <> ?'; $parameters[] = self::ARCHIVED; }
        else {
            if (!in_array($status, [...self::STATUSES, self::ARCHIVED], true)) throw new InvalidArgumentException();
            $where[] = 'p.status = ?'; $parameters[] = $status;
        }
        $search = trim((string) ($filters['search'] ?? ''));
        if (self::length($search) > 180) throw new InvalidArgumentException();
        if ($search !== '') {
            $like = '%' . addcslashes($search, '\\%_') . '%';
            $where[] = "(p.full_name LIKE ? ESCAPE '\\' OR p.stage_name LIKE ? ESCAPE '\\' OR p.whatsapp_idx = ? OR a.email_idx = ?)";
            array_push($parameters, $like, $like, $this->crypto->lookup($search), $this->crypto->lookup(strtolower($search)));
        }
        $condition = implode(' AND ', $where);
        $from = ' FROM mfs_profiles p JOIN mfs_accounts a ON a.id = p.account_id WHERE ' . $condition;
        $count = $this->pdo->prepare('SELECT COUNT(*)' . $from);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        $rows = $this->pdo->prepare('SELECT p.id, p.public_id, p.status, p.full_name, p.stage_name, p.whatsapp_enc, p.audition_url, p.submitted_at, a.email_enc, (SELECT COUNT(*) FROM mfs_photos f WHERE f.profile_id = p.id) AS has_photo' . $from . ' ORDER BY p.submitted_at DESC, p.id DESC LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage));
        $rows->execute($parameters);
        $items = array_map(fn (array $row): array => [
            'public_id' => $row['public_id'], 'status' => $row['status'], 'full_name' => $row['full_name'], 'stage_name' => $row['stage_name'],
            'whatsapp' => $this->crypto->decrypt($row['whatsapp_enc']), 'email' => $this->crypto->decrypt($row['email_enc']),
            'audition_url' => $row['audition_url'], 'has_photo' => (int) $row['has_photo'] > 0, 'submitted_at' => $row['submitted_at'],
        ], $rows->fetchAll(PDO::FETCH_ASSOC));
        return ['items' => $items, 'page' => $page, 'per_page' => $perPage, 'total' => $total];
    }

    public function dashboard(): array
    {
        $statuses = array_fill_keys(self::STATUSES, 0);
        $query = $this->pdo->prepare('SELECT status, COUNT(*) AS count FROM mfs_profiles WHERE status <> ? GROUP BY status');
        $query->execute([self::ARCHIVED]);
        foreach ($query as $row) if (isset($statuses[$row['status']])) $statuses[$row['status']] = (int) $row['count'];
        $recent = $this->pdo->prepare('SELECT COUNT(*) FROM mfs_profiles WHERE status <> ? AND submitted_at >= ?');
        $recent->execute([self::ARCHIVED, gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
        $archived = $this->pdo->prepare('SELECT COUNT(*) FROM mfs_profiles WHERE status = ?');
        $archived->execute([self::ARCHIVED]);
        $pending = (int) $this->pdo->query('SELECT COUNT(*) FROM mfs_accounts a LEFT JOIN mfs_profiles p ON p.account_id = a.id WHERE a.active = 1 AND p.id IS NULL')->fetchColumn();
        return ['total' => array_sum($statuses), 'byStatus' => $statuses, 'lastSevenDays' => (int) $recent->fetchColumn(), 'archived' => (int) $archived->fetchColumn(), 'pendingAccounts' => $pending];
    }

    public function find(string $publicId, bool $includeArchived = false): ?array
    {
        $row = $this->row($publicId, $includeArchived);
        if ($row === null) return null;
        $notes = $this->pdo->prepare('SELECT n.id, n.body, n.created_at, u.username AS author FROM mfs_notes n JOIN admin_users u ON u.id = n.author_id WHERE n.profile_id = ? ORDER BY n.created_at, n.id');
        $notes->execute([$row['id']]);
        $account = $this->pdo->prepare('SELECT email_enc, active, last_login_at FROM mfs_accounts WHERE id = ?');
        $account->execute([$row['account_id']]);
        $owner = $account->fetch();
        $id = (int) $row['id'];
        return [
            ...$this->present($row),
            'email' => $owner ? $this->crypto->decrypt($owner['email_enc']) : '',
            'account' => ['active' => $owner ? (int) $owner['active'] === 1 : false, 'last_login_at' => $owner['last_login_at'] ?? null],
            'photo' => $this->photoMeta($id),
            'consents' => $this->consents($id),
            'notes' => array_map(static fn (array $note): array => [...$note, 'id' => (int) $note['id']], $notes->fetchAll(PDO::FETCH_ASSOC)),
        ];
    }

    public function changeStatus(string $publicId, string $status, int $actorId, string $ip = ''): void
    {
        if (!in_array($status, self::STATUSES, true)) throw new InvalidArgumentException();
        $this->mutate($publicId, false, function (array $row) use ($status, $actorId, $ip, $publicId): void {
            if ($row['status'] === $status) return;
            $this->pdo->prepare('UPDATE mfs_profiles SET status = ?, updated_at = ? WHERE id = ?')->execute([$status, gmdate('Y-m-d H:i:s'), $row['id']]);
            $this->audit->log('mfs.status_changed', $actorId, 'mfs_profile', $publicId, [], $ip);
        });
    }

    /** Solo administración corrige una audición ya enviada, cuando el participante lo solicita. */
    public function correctAudition(string $publicId, mixed $url, int $actorId, string $ip = ''): void
    {
        if (!is_string($url) || !self::isTikTokUrl(trim($url))) throw new InvalidArgumentException();
        $url = trim($url);
        $this->mutate($publicId, false, function (array $row) use ($url, $actorId, $ip, $publicId): void {
            if ($row['audition_url'] === $url) return;
            $now = gmdate('Y-m-d H:i:s');
            $this->pdo->prepare('UPDATE mfs_profiles SET audition_url = ?, audition_submitted_at = ?, updated_at = ? WHERE id = ?')->execute([$url, $now, $now, $row['id']]);
            $this->audit->log('mfs.audition_corrected', $actorId, 'mfs_profile', $publicId, [], $ip);
        });
    }

    public function addNote(string $publicId, string $text, int $actorId, string $ip = ''): void
    {
        $text = trim($text);
        if ($text === '' || self::length($text) > 2000) throw new InvalidArgumentException();
        $this->mutate($publicId, true, function (array $row) use ($text, $actorId, $ip, $publicId): void {
            $this->pdo->prepare('INSERT INTO mfs_notes (profile_id, author_id, body, created_at) VALUES (?, ?, ?, ?)')->execute([$row['id'], $actorId, $text, gmdate('Y-m-d H:i:s')]);
            $this->audit->log('mfs.note_added', $actorId, 'mfs_profile', $publicId, ['note_id' => (int) $this->pdo->lastInsertId()], $ip);
        });
    }

    /** Retiro reversible: oculta la inscripción y desactiva su cuenta; no se borra nada. */
    public function archive(string $publicId, int $actorId, string $ip = ''): void
    {
        $this->mutate($publicId, false, function (array $row) use ($actorId, $ip, $publicId): void {
            $now = gmdate('Y-m-d H:i:s');
            $this->pdo->prepare('UPDATE mfs_profiles SET status = ?, updated_at = ? WHERE id = ?')->execute([self::ARCHIVED, $now, $row['id']]);
            $this->pdo->prepare('UPDATE mfs_accounts SET active = 0, updated_at = ? WHERE id = ?')->execute([$now, $row['account_id']]);
            $this->audit->log('mfs.archived', $actorId, 'mfs_profile', $publicId, [], $ip);
        });
    }

    /** Deshace un retiro: la inscripción vuelve a revisión y su cuenta recupera el acceso. */
    public function restore(string $publicId, int $actorId, string $ip = ''): void
    {
        $this->mutate($publicId, true, function (array $row) use ($actorId, $ip, $publicId): void {
            if ($row['status'] !== self::ARCHIVED) throw new InvalidArgumentException();
            $now = gmdate('Y-m-d H:i:s');
            $this->pdo->prepare('UPDATE mfs_profiles SET status = ?, updated_at = ? WHERE id = ?')->execute(['En revisión', $now, $row['id']]);
            $this->pdo->prepare('UPDATE mfs_accounts SET active = 1, updated_at = ? WHERE id = ?')->execute([$now, $row['account_id']]);
            $this->audit->log('mfs.restored', $actorId, 'mfs_profile', $publicId, [], $ip);
        });
    }

    /** Cuentas creadas que todavía no guardan su inscripción. */
    public function pendingAccounts(): array
    {
        $rows = $this->pdo->query('SELECT a.public_id, a.email_enc, a.created_at, a.last_login_at FROM mfs_accounts a LEFT JOIN mfs_profiles p ON p.account_id = a.id WHERE a.active = 1 AND p.id IS NULL ORDER BY a.created_at DESC, a.id DESC LIMIT 200');
        $items = [];
        foreach ($rows as $row) $items[] = ['public_id' => $row['public_id'], 'email' => $this->crypto->decrypt($row['email_enc']), 'created_at' => $row['created_at'], 'last_login_at' => $row['last_login_at']];
        return $items;
    }

    public function archiveAccount(string $publicId, int $actorId, string $ip = ''): void
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $this->begin();
        try {
            $statement = $this->pdo->prepare('SELECT a.id FROM mfs_accounts a LEFT JOIN mfs_profiles p ON p.account_id = a.id WHERE a.public_id = ? AND a.active = 1 AND p.id IS NULL');
            $statement->execute([$publicId]);
            $id = $statement->fetchColumn();
            if ($id === false) throw new OutOfBoundsException();
            $this->pdo->prepare('UPDATE mfs_accounts SET active = 0, updated_at = ? WHERE id = ?')->execute([gmdate('Y-m-d H:i:s'), $id]);
            $this->audit->log('mfs_account.archived', $actorId, 'mfs_account', $publicId, [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
    }

    /** Filas descifradas para el CSV administrativo. */
    public function exportRows(array $filters): array
    {
        $rows = []; $page = 1;
        do {
            $result = $this->list([...$filters, 'page' => (string) $page, 'per_page' => '100']);
            foreach ($result['items'] as $item) {
                $detail = $this->find($item['public_id'], true);
                if ($detail !== null) $rows[] = $detail;
            }
            $page++;
        } while (($page - 1) * 100 < $result['total']);
        return $rows;
    }

    public function photoForAccount(int $accountId, MfsPhotoStorage $storage): string
    {
        $statement = $this->pdo->prepare('SELECT f.storage_key FROM mfs_photos f JOIN mfs_profiles p ON p.id = f.profile_id WHERE p.account_id = ? AND p.status <> ?');
        $statement->execute([$accountId, self::ARCHIVED]);
        $key = $statement->fetchColumn();
        if ($key === false) throw new OutOfBoundsException();
        return $storage->read($key);
    }

    public function photoForAdmin(string $publicId, MfsPhotoStorage $storage, int $actorId, string $ip): string
    {
        $row = $this->row($publicId, true);
        if ($row === null) throw new OutOfBoundsException();
        $statement = $this->pdo->prepare('SELECT storage_key FROM mfs_photos WHERE profile_id = ?');
        $statement->execute([$row['id']]);
        $key = $statement->fetchColumn();
        if ($key === false) throw new OutOfBoundsException();
        $jpeg = $storage->read($key);
        $this->audit->log('mfs.photo_viewed', $actorId, 'mfs_profile', $publicId, [], $ip);
        return $jpeg;
    }

    // ---------------------------------------------------------------- utilidades

    private function photoMeta(int $profileId): array
    {
        $statement = $this->pdo->prepare('SELECT width, height, created_at FROM mfs_photos WHERE profile_id = ?');
        $statement->execute([$profileId]);
        $row = $statement->fetch();
        return $row === false ? ['available' => false, 'width' => null, 'height' => null, 'created_at' => null] : ['available' => true, 'width' => (int) $row['width'], 'height' => (int) $row['height'], 'created_at' => (string) $row['created_at']];
    }

    private function present(array $row): array
    {
        return [
            'public_id' => $row['public_id'], 'status' => $row['status'], 'full_name' => (string) $row['full_name'], 'stage_name' => (string) $row['stage_name'],
            'whatsapp' => $this->crypto->decrypt($row['whatsapp_enc']), 'audition_url' => (string) $row['audition_url'],
            'audition_submitted_at' => $row['audition_submitted_at'], 'video_declaration_at' => $row['video_declaration_at'],
            'submitted_at' => $row['submitted_at'], 'updated_at' => $row['updated_at'],
        ];
    }

    private function row(string $publicId, bool $includeArchived): ?array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $sql = 'SELECT * FROM mfs_profiles WHERE public_id = ?' . ($includeArchived ? '' : ' AND status <> ?') . $this->rowLock();
        $statement = $this->pdo->prepare($sql);
        $statement->execute($includeArchived ? [$publicId] : [$publicId, self::ARCHIVED]);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    private function mutate(string $publicId, bool $includeArchived, callable $mutation): void
    {
        $this->begin();
        try {
            $row = $this->row($publicId, $includeArchived);
            if ($row === null) throw new OutOfBoundsException();
            $mutation($row);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
    }

    /** Conteo de caracteres Unicode sin depender de mbstring; rechaza UTF-8 inválido. */
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
            // Conservar el error original antes que el de limpieza.
        }
    }
}
