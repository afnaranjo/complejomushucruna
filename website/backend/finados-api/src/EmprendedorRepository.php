<?php

declare(strict_types=1);

namespace Finados;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/Http.php';
require_once __DIR__ . '/Crypto.php';
require_once __DIR__ . '/Audit.php';
require_once __DIR__ . '/EmprendedorPhotoStorage.php';

/**
 * Programme "De emprendedor a influencer": records owned by an entrepreneur account, reviewed and
 * measured by administrators. Own tables (`emprendedor_*`), own session and own photo store; it
 * shares nothing with Voceros or Medios beyond the administrative users and the audit log.
 */
final class EmprendedorRepository
{
    public const STATUSES = ['Nuevo', 'En revisión', 'Aprobado', 'Rechazado'];
    public const LEVELS = [
        0 => 'En preparación', 1 => 'Primer video', 2 => 'En camino', 3 => 'Constante',
        4 => 'Destacado', 5 => 'Referente', 6 => 'Tope',
    ];
    public const TRAFFIC_LIGHTS = ['red', 'yellow', 'green'];
    public const NETWORKS = ['TikTok', 'Instagram', 'Facebook'];
    public const PREVIOUS_PARTICIPATION = ['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición'];
    /** Form field (Spanish) → stored column. Sent as multipart strings, like the Voceros form. */
    public const FIELDS = [
        'nombre_completo' => 'full_name', 'cedula' => 'cedula', 'fecha_nacimiento' => 'birth_date', 'whatsapp' => 'whatsapp', 'ciudad' => 'city',
        'emprendimiento' => 'business_name', 'producto' => 'product', 'stand' => 'stand_code',
        'tiktok' => 'tiktok', 'instagram' => 'instagram', 'facebook' => 'facebook', 'red_principal' => 'main_network',
        'participacion_previa' => 'previous_participation',
    ];
    /** Form checkbox → catalogue key. All three are required to take part in the programme. */
    public const CONSENTS = ['consentimiento_politicas' => 'policies', 'autorizacion_imagen' => 'image', 'consentimiento_datos' => 'data'];
    public const VIDEO_SLOTS = 5;
    private const ARCHIVED = 'Eliminado';
    private const EDITABLE = ['Nuevo', 'En revisión'];
    private const VIDEO_STATUSES = ['Nuevo', 'En revisión', 'Aprobado'];
    private const PLAIN = ['full_name', 'city', 'business_name', 'product', 'stand_code', 'main_network', 'tiktok', 'instagram', 'facebook', 'previous_participation'];
    private const ENCRYPTED = ['cedula', 'birth_date', 'whatsapp'];
    private const INDEXED = ['cedula', 'whatsapp'];
    private readonly Audit $audit;
    private readonly array $catalogue;

    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, ?Audit $audit = null)
    {
        $this->audit = $audit ?? new Audit($pdo, $crypto);
        try {
            $catalogue = json_decode((string) file_get_contents(__DIR__ . '/../resources/emprendedor-consents.json'), true, 16, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw new RuntimeException('No se pudo cargar los consentimientos del programa.');
        }
        foreach (self::CONSENTS as $type) {
            if (!is_string($catalogue[$type]['version'] ?? null) || !is_string($catalogue[$type]['text'] ?? null)) throw new RuntimeException('No se pudo cargar los consentimientos del programa.');
        }
        $this->catalogue = $catalogue;
    }

    /** Own record for the authenticated account, or null before the first save. */
    public function forAccount(int $accountId): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM emprendedor_profiles WHERE account_id = ?');
        $statement->execute([$accountId]);
        $row = $statement->fetch();
        if ($row === false || $row['status'] === self::ARCHIVED) return null;
        return $this->own($row);
    }

    private function own(array $row): array
    {
        $id = (int) $row['id'];
        $photo = $this->photoMeta($id);
        $consents = $this->consents($id);
        $accepted = count(array_filter($consents, static fn (array $consent): bool => $consent['accepted'] === 1));
        return [
            ...$this->present($row),
            'editable' => in_array($row['status'], self::EDITABLE, true),
            'photo' => $photo,
            'consents' => $consents,
            'progress' => $this->progressFor($id, $row),
            'profile_complete' => $photo['available'] && $accepted === count(self::CONSENTS),
        ];
    }

    /**
     * Saves the entrepreneur's own record. Fields arrive as multipart strings; the photo, when present,
     * is normalized, encrypted and stored in the programme's own store within the same transaction.
     */
    public function saveForAccount(int $accountId, array $fields, ?array $upload, EmprendedorPhotoStorage $storage, string $ip): array
    {
        $record = self::validate($fields);
        $now = gmdate('Y-m-d H:i:s');
        $photo = null;
        if ($upload !== null) {
            try { $photo = $storage->stage($upload['tmp_name'], (int) $upload['size']); }
            catch (RuntimeException) { throw new InvalidArgumentException(); }
        }
        $promoted = false; $oldKey = false;
        $this->begin();
        try {
            $statement = $this->pdo->prepare('SELECT id, public_id, status FROM emprendedor_profiles WHERE account_id = ?' . $this->rowLock());
            $statement->execute([$accountId]);
            $existing = $statement->fetch();
            $values = [];
            foreach (self::PLAIN as $field) $values[$field] = $record[$field];
            foreach (self::ENCRYPTED as $field) $values[$field . '_enc'] = $this->crypto->encrypt($record[$field]);
            foreach (self::INDEXED as $field) $values[$field . '_idx'] = $this->crypto->lookup($record[$field]);
            $values['age_at_submission'] = $record['age_at_submission'];
            $values['updated_at'] = $now;
            if ($existing === false) {
                $this->assertUnique($record, null);
                $publicId = bin2hex(random_bytes(16));
                $values = ['public_id' => $publicId, 'account_id' => $accountId, 'status' => 'Nuevo', ...$values, 'submitted_at' => $now];
                $columns = array_keys($values);
                $this->pdo->prepare('INSERT INTO emprendedor_profiles (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')')
                    ->execute(array_values($values));
                $profileId = (int) $this->pdo->lastInsertId();
                $this->pdo->prepare('INSERT INTO emprendedor_progress (profile_id, followers_count, level, updated_at) VALUES (?, 0, 0, ?)')->execute([$profileId, $now]);
                $this->audit->log('emprendedor.profile_created', null, 'emprendedor_profile', $publicId, [], $ip);
            } else {
                // Reviewed or retired records are read-only for their owner.
                if (!in_array($existing['status'], self::EDITABLE, true)) throw new Forbidden();
                $this->assertUnique($record, (int) $existing['id']);
                $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($values)));
                $this->pdo->prepare('UPDATE emprendedor_profiles SET ' . $assignments . ' WHERE id = ?')->execute([...array_values($values), $existing['id']]);
                $profileId = (int) $existing['id'];
                $this->audit->log('emprendedor.profile_updated', null, 'emprendedor_profile', $existing['public_id'], [], $ip);
            }
            $this->recordConsents($profileId, $ip, $now);
            if ($photo !== null) {
                $storage->promote($photo); $promoted = true;
                $previous = $this->pdo->prepare('SELECT storage_key FROM emprendedor_photos WHERE profile_id = ?');
                $previous->execute([$profileId]);
                $oldKey = $previous->fetchColumn();
                $photoValues = [$photo['storage_key'], $photo['mime_type'], $photo['bytes'], $photo['sha256'], $photo['width'], $photo['height'], $now, $profileId];
                if ($oldKey === false) $this->pdo->prepare('INSERT INTO emprendedor_photos (storage_key, content_type, bytes, sha256, width, height, created_at, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute($photoValues);
                else $this->pdo->prepare('UPDATE emprendedor_photos SET storage_key = ?, content_type = ?, bytes = ?, sha256 = ?, width = ?, height = ?, created_at = ? WHERE profile_id = ?')->execute($photoValues);
                $this->audit->log('emprendedor.photo_saved', null, 'emprendedor_profile', $existing === false ? $publicId : $existing['public_id'], [], $ip);
            }
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            if ($photo !== null) { try { $promoted ? $storage->delete($photo['storage_key']) : $storage->discard($photo); } catch (Throwable) { /* keep the original failure */ } }
            throw $error;
        }
        if (is_string($oldKey)) { try { $storage->delete($oldKey); } catch (Throwable) { /* an orphaned ciphertext is harmless */ } }
        return $this->forAccount($accountId) ?? throw new RuntimeException();
    }

    /** Cédula and WhatsApp identify one active record each; archived records free their data. */
    private function assertUnique(array $record, ?int $exceptId): void
    {
        foreach (self::INDEXED as $field) {
            $query = $this->pdo->prepare('SELECT id FROM emprendedor_profiles WHERE ' . $field . '_idx = ? AND status <> ?' . ($exceptId === null ? '' : ' AND id <> ?'));
            $query->execute($exceptId === null ? [$this->crypto->lookup($record[$field]), self::ARCHIVED] : [$this->crypto->lookup($record[$field]), self::ARCHIVED, $exceptId]);
            if ($query->fetchColumn() !== false) throw new DuplicateRegistration();
        }
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
        $timezone = new DateTimeZone('America/Guayaquil');
        $now = new DateTimeImmutable('now', $timezone);
        $birthValue = $text('fecha_nacimiento', 10, 10);
        $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $birthValue, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if ($birth === false || (is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) throw new InvalidArgumentException();
        $age = $birth->diff($now)->y;
        // The programme is for business owners: adults only, so no legal representative flow is needed.
        if ($birth > $now || $age < 18 || $age > 120) throw new InvalidArgumentException();
        $record = [
            'full_name' => $text('nombre_completo', 160, 5), 'cedula' => $text('cedula', 10, 10), 'birth_date' => $birthValue, 'age_at_submission' => $age,
            'whatsapp' => $text('whatsapp', 10, 10), 'city' => $text('ciudad', 100, 1),
            'business_name' => $text('emprendimiento', 160, 2), 'product' => $text('producto', 300, 2), 'stand_code' => $text('stand', 40),
            'main_network' => $text('red_principal', 20, 1), 'previous_participation' => $text('participacion_previa', 60, 1),
        ];
        if (preg_match('/^\d{10}$/D', $record['cedula']) !== 1 || preg_match('/^09\d{8}$/D', $record['whatsapp']) !== 1) throw new InvalidArgumentException();
        if (!in_array($record['main_network'], self::NETWORKS, true) || !in_array($record['previous_participation'], self::PREVIOUS_PARTICIPATION, true)) throw new InvalidArgumentException();
        foreach (['tiktok', 'instagram', 'facebook'] as $network) {
            $record[$network] = $text($network, 300);
            if ($record[$network] !== '' && (!filter_var($record[$network], FILTER_VALIDATE_URL) || strtolower((string) parse_url($record[$network], PHP_URL_SCHEME)) !== 'https')) throw new InvalidArgumentException();
        }
        if ($record['tiktok'] === '' && $record['instagram'] === '' && $record['facebook'] === '') throw new InvalidArgumentException();
        foreach (array_keys(self::CONSENTS) as $consent) if ($text($consent, 4, 1) !== 'Sí') throw new InvalidArgumentException();
        return $record;
    }

    /** Append-only evidence: a new row is written only when the accepted text changes. */
    private function recordConsents(int $profileId, string $ip, string $now): void
    {
        $latest = $this->pdo->prepare('SELECT text_hash FROM emprendedor_consents WHERE profile_id = ? AND consent_type = ? AND accepted = 1 ORDER BY recorded_at DESC, id DESC LIMIT 1');
        $insert = $this->pdo->prepare('INSERT INTO emprendedor_consents (profile_id, consent_type, accepted, text_version, text_hash, ip_hash, recorded_at) VALUES (?, ?, 1, ?, ?, ?, ?)');
        foreach (self::CONSENTS as $type) {
            $hash = hash('sha256', $this->catalogue[$type]['text']);
            $latest->execute([$profileId, $type]);
            if ($latest->fetchColumn() === $hash) continue;
            $insert->execute([$profileId, $type, $this->catalogue[$type]['version'], $hash, $this->crypto->lookup($ip), $now]);
        }
    }

    /** Current answer per consent type, without IP or hashes. */
    private function consents(int $profileId): array
    {
        $statement = $this->pdo->prepare('SELECT consent_type, accepted, text_version, recorded_at FROM emprendedor_consents WHERE profile_id = ? ORDER BY recorded_at, id');
        $statement->execute([$profileId]);
        $current = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $current[$row['consent_type']] = ['consent_type' => (string) $row['consent_type'], 'accepted' => (int) $row['accepted'], 'text_version' => (string) $row['text_version'], 'recorded_at' => (string) $row['recorded_at']];
        }
        return array_values($current);
    }

    // ---------------------------------------------------------------- progress and videos

    /** Progress plus five stable video slots governed by the global schedule. */
    public function progressFor(int $profileId, ?array $row = null): array
    {
        if ($row === null) {
            $query = $this->pdo->prepare('SELECT traffic_light FROM emprendedor_profiles WHERE id = ?');
            $query->execute([$profileId]);
            $row = $query->fetch() ?: [];
        }
        $query = $this->pdo->prepare('SELECT followers_count, level, updated_at FROM emprendedor_progress WHERE profile_id = ?');
        $query->execute([$profileId]);
        $progress = $query->fetch() ?: [];
        $level = max(0, min(6, (int) ($progress['level'] ?? 0)));
        $videos = $this->pdo->prepare('SELECT slot, url, status, views_count, submitted_at, updated_at FROM emprendedor_videos WHERE profile_id = ? ORDER BY slot');
        $videos->execute([$profileId]);
        $slots = $this->videoSlots($videos->fetchAll(PDO::FETCH_ASSOC));
        return [
            'followers_count' => (int) ($progress['followers_count'] ?? 0), 'level' => $level, 'level_label' => self::LEVELS[$level],
            'traffic_light' => self::light($row), 'videos_unlocked' => count(array_filter($slots, static fn (array $video): bool => $video['unlocked'])),
            'updated_at' => $progress['updated_at'] ?? null, 'videos' => $slots,
        ];
    }

    private function videoSlots(array $rows): array
    {
        $schedule = [];
        foreach ($this->videoSchedule() as $entry) $schedule[$entry['slot']] = $entry['enabled_at'];
        $bySlot = [];
        foreach ($rows as $row) $bySlot[(int) $row['slot']] = $row;
        return array_map(function (int $slot) use ($bySlot, $schedule): array {
            $row = $bySlot[$slot] ?? [];
            return ['slot' => $slot, 'unlocked' => self::slotAvailable($schedule[$slot] ?? null), 'enabled_at' => $schedule[$slot] ?? null,
                'url' => (string) ($row['url'] ?? ''), 'status' => (string) ($row['status'] ?? 'empty'), 'views_count' => (int) ($row['views_count'] ?? 0),
                'submitted_at' => $row['submitted_at'] ?? null, 'updated_at' => $row['updated_at'] ?? null];
        }, range(1, self::VIDEO_SLOTS));
    }

    private static function slotAvailable(mixed $enabledAt): bool
    {
        if (!is_string($enabledAt) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $enabledAt, $parts) !== 1 || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) return false;
        return $enabledAt <= (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->format('Y-m-d');
    }

    public function videoSchedule(): array
    {
        $rows = [];
        foreach ($this->pdo->query('SELECT slot, enabled_at, updated_at FROM emprendedor_video_schedule ORDER BY slot')->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $enabledAt = $row['enabled_at'];
            $rows[(int) $row['slot']] = ['slot' => (int) $row['slot'], 'enabled_at' => is_string($enabledAt) && $enabledAt !== '' ? substr($enabledAt, 0, 10) : null, 'updated_at' => $row['updated_at']];
        }
        return array_map(static fn (int $slot): array => $rows[$slot] ?? ['slot' => $slot, 'enabled_at' => null, 'updated_at' => null], range(1, self::VIDEO_SLOTS));
    }

    public function updateVideoSchedule(mixed $input, int $actorId, string $ip = ''): void
    {
        $slots = self::normalizeVideoSlots($input);
        $this->begin();
        try {
            $now = gmdate('Y-m-d H:i:s');
            $sql = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
                ? 'INSERT INTO emprendedor_video_schedule (slot, enabled_at, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE enabled_at = VALUES(enabled_at), updated_at = VALUES(updated_at)'
                : 'INSERT INTO emprendedor_video_schedule (slot, enabled_at, updated_at) VALUES (?, ?, ?) ON CONFLICT(slot) DO UPDATE SET enabled_at = excluded.enabled_at, updated_at = excluded.updated_at';
            $query = $this->pdo->prepare($sql);
            foreach ($slots as $slot) $query->execute([$slot['slot'], $slot['enabled_at'], $now]);
            $this->audit->log('emprendedor.video_schedule_updated', $actorId, 'emprendedor_video_schedule', null, ['count' => count(array_filter($slots, static fn (array $slot): bool => $slot['enabled']))], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
    }

    private static function normalizeVideoSlots(mixed $input): array
    {
        if (!is_array($input) || count($input) !== self::VIDEO_SLOTS) throw new InvalidArgumentException();
        $slots = [];
        foreach ($input as $entry) {
            if ($entry instanceof \stdClass) $entry = (array) $entry;
            if (!is_array($entry) || filter_var($entry['slot'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => self::VIDEO_SLOTS]]) === false || !is_bool($entry['enabled'] ?? null)) throw new InvalidArgumentException();
            $slot = (int) $entry['slot'];
            if (isset($slots[$slot])) throw new InvalidArgumentException();
            $enabledAt = $entry['enabled_at'] ?? null;
            if ($enabledAt === '') $enabledAt = null;
            if ($enabledAt !== null && (!is_string($enabledAt) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $enabledAt, $parts) !== 1 || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]))) throw new InvalidArgumentException();
            if ($entry['enabled'] !== ($enabledAt !== null)) throw new InvalidArgumentException();
            $slots[$slot] = ['slot' => $slot, 'enabled' => $entry['enabled'], 'enabled_at' => $enabledAt];
        }
        ksort($slots);
        return array_values($slots);
    }

    /** The entrepreneur pastes one public link per slot once its global date arrives; a received link is never edited. */
    public function saveVideoForAccount(int $accountId, int $slot, mixed $url, string $ip): array
    {
        if ($slot < 1 || $slot > self::VIDEO_SLOTS || !is_string($url) || strlen($url) > 500 || !filter_var($url, FILTER_VALIDATE_URL) || !str_starts_with(strtolower($url), 'https://')) throw new InvalidArgumentException();
        $this->begin();
        try {
            $statement = $this->pdo->prepare('SELECT id, public_id, status FROM emprendedor_profiles WHERE account_id = ?' . $this->rowLock());
            $statement->execute([$accountId]);
            $profile = $statement->fetch();
            if ($profile === false || !in_array($profile['status'], self::VIDEO_STATUSES, true)) throw new Forbidden();
            $schedule = $this->pdo->prepare('SELECT enabled_at FROM emprendedor_video_schedule WHERE slot = ?');
            $schedule->execute([$slot]);
            $enabledAt = $schedule->fetchColumn();
            if (!is_string($enabledAt) || !self::slotAvailable(substr($enabledAt, 0, 10))) throw new OutOfBoundsException();
            $existing = $this->pdo->prepare('SELECT url, status FROM emprendedor_videos WHERE profile_id = ? AND slot = ?');
            $existing->execute([$profile['id'], $slot]);
            $current = $existing->fetch();
            if ($current !== false && trim((string) $current['url']) !== '' && $current['status'] === 'submitted') throw new InvalidArgumentException();
            $now = gmdate('Y-m-d H:i:s');
            $sql = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
                ? 'INSERT INTO emprendedor_videos (profile_id, slot, url, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE url = VALUES(url), status = VALUES(status), submitted_at = VALUES(submitted_at), updated_at = VALUES(updated_at)'
                : 'INSERT INTO emprendedor_videos (profile_id, slot, url, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, slot) DO UPDATE SET url = excluded.url, status = excluded.status, submitted_at = excluded.submitted_at, updated_at = excluded.updated_at';
            $this->pdo->prepare($sql)->execute([$profile['id'], $slot, $url, 'submitted', $now, $now]);
            $this->audit->log('emprendedor.video_submitted', null, 'emprendedor_profile', $profile['public_id'], ['slot' => $slot], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
        return $this->forAccount($accountId) ?? throw new RuntimeException();
    }

    /** Administration records validated followers, level, traffic light and the views of each video. */
    public function updateProgress(string $publicId, mixed $input, int $actorId, string $ip = ''): void
    {
        if ($input instanceof \stdClass) $input = (array) $input;
        if (!is_array($input)) throw new InvalidArgumentException();
        $followers = filter_var($input['followers_count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 1000000000]]);
        $level = filter_var($input['level'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 6]]);
        $light = $input['traffic_light'] ?? null;
        if ($followers === false || $level === false || !is_string($light) || !in_array($light, self::TRAFFIC_LIGHTS, true)) throw new InvalidArgumentException();
        $views = null;
        if (array_key_exists('video_views', $input)) {
            if (!is_array($input['video_views']) || count($input['video_views']) !== self::VIDEO_SLOTS) throw new InvalidArgumentException();
            $views = [];
            foreach ($input['video_views'] as $entry) {
                if ($entry instanceof \stdClass) $entry = (array) $entry;
                $slot = filter_var($entry['slot'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => self::VIDEO_SLOTS]]);
                $count = filter_var($entry['views_count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 1000000000]]);
                if ($slot === false || $count === false || isset($views[$slot])) throw new InvalidArgumentException();
                $views[$slot] = $count;
            }
        }
        $this->mutate($publicId, function (array $row) use ($publicId, $actorId, $ip, $followers, $level, $light, $views): void {
            $now = gmdate('Y-m-d H:i:s');
            $sql = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
                ? 'INSERT INTO emprendedor_progress (profile_id, followers_count, level, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE followers_count = VALUES(followers_count), level = VALUES(level), updated_at = VALUES(updated_at)'
                : 'INSERT INTO emprendedor_progress (profile_id, followers_count, level, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id) DO UPDATE SET followers_count = excluded.followers_count, level = excluded.level, updated_at = excluded.updated_at';
            $this->pdo->prepare($sql)->execute([$row['id'], $followers, $level, $now]);
            if (self::light($row) !== $light) $this->pdo->prepare('UPDATE emprendedor_profiles SET traffic_light = ?, updated_at = ? WHERE id = ?')->execute([$light, $now, $row['id']]);
            if ($views !== null) {
                // Views only apply to slots that already hold a link; empty slots are never created by administration.
                $update = $this->pdo->prepare("UPDATE emprendedor_videos SET views_count = ?, updated_at = ? WHERE profile_id = ? AND slot = ? AND url <> ''");
                foreach ($views as $slot => $count) $update->execute([$count, $now, $row['id'], $slot]);
            }
            $this->audit->log('emprendedor.progress_updated', $actorId, 'emprendedor_profile', $publicId, ['followers_count' => $followers, 'level' => $level, 'traffic_light' => $light], $ip);
        });
    }

    /** Public, minimal projection used by the badge QR validation page. */
    public function publicVerification(string $publicId): ?array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $query = $this->pdo->prepare('SELECT id, full_name, business_name, traffic_light FROM emprendedor_profiles WHERE public_id = ? AND status IN (?, ?, ?)');
        $query->execute([$publicId, ...self::VIDEO_STATUSES]);
        $row = $query->fetch();
        if ($row === false) return null;
        $progress = $this->progressFor((int) $row['id'], $row);
        $labels = ['red' => ['short' => 'Rojo', 'long' => 'En preparación'], 'yellow' => ['short' => 'Amarillo', 'long' => 'En avance'], 'green' => ['short' => 'Verde', 'long' => 'Listo']];
        return ['name' => (string) $row['full_name'], 'business_name' => (string) $row['business_name'], 'level' => $progress['level'], 'level_label' => $progress['level_label'],
            'traffic_light' => $progress['traffic_light'], 'traffic_light_label' => $labels[$progress['traffic_light']]];
    }

    // ---------------------------------------------------------------- administration

    public function list(array $filters): array
    {
        $page = self::positiveInt($filters['page'] ?? '1', 1000000);
        $perPage = self::positiveInt($filters['per_page'] ?? '25', 100);
        if (!in_array($perPage, [25, 50, 100], true)) throw new InvalidArgumentException();
        $where = ['p.status <> ?']; $parameters = [self::ARCHIVED];
        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '') {
            if (!in_array($status, self::STATUSES, true)) throw new InvalidArgumentException();
            $where[] = 'p.status = ?'; $parameters[] = $status;
        }
        $network = trim((string) ($filters['main_network'] ?? ''));
        if ($network !== '') {
            if (!in_array($network, self::NETWORKS, true)) throw new InvalidArgumentException();
            $where[] = 'p.main_network = ?'; $parameters[] = $network;
        }
        $city = trim((string) ($filters['city'] ?? ''));
        if (self::length($city) > 100) throw new InvalidArgumentException();
        if ($city !== '') { $where[] = 'p.city = ?'; $parameters[] = $city; }
        $search = trim((string) ($filters['search'] ?? ''));
        if (self::length($search) > 180) throw new InvalidArgumentException();
        if ($search !== '') {
            $like = '%' . addcslashes($search, '\\%_') . '%';
            $where[] = "(p.full_name LIKE ? ESCAPE '\\' OR p.business_name LIKE ? ESCAPE '\\' OR p.product LIKE ? ESCAPE '\\' OR p.city LIKE ? ESCAPE '\\' OR p.stand_code LIKE ? ESCAPE '\\' OR p.cedula_idx = ? OR p.whatsapp_idx = ?)";
            array_push($parameters, $like, $like, $like, $like, $like, $this->crypto->lookup($search), $this->crypto->lookup($search));
        }
        $condition = implode(' AND ', $where);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM emprendedor_profiles p WHERE ' . $condition);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        $rows = $this->pdo->prepare('SELECT p.public_id, p.status, p.traffic_light, p.full_name, p.cedula_enc, p.whatsapp_enc, p.city, p.business_name, p.product, p.stand_code, p.main_network, p.submitted_at, COALESCE(g.followers_count, 0) AS followers_count, COALESCE(g.level, 0) AS level, (SELECT COUNT(*) FROM emprendedor_videos v WHERE v.profile_id = p.id AND v.status = ? AND v.url <> \'\') AS videos_submitted FROM emprendedor_profiles p LEFT JOIN emprendedor_progress g ON g.profile_id = p.id WHERE ' . $condition . ' ORDER BY p.submitted_at DESC, p.id DESC LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage));
        $rows->execute(['submitted', ...$parameters]);
        $items = array_map(fn (array $row): array => [
            'public_id' => $row['public_id'], 'status' => $row['status'], 'traffic_light' => self::light($row), 'full_name' => $row['full_name'],
            'cedula' => $this->crypto->decrypt($row['cedula_enc']), 'whatsapp' => $this->crypto->decrypt($row['whatsapp_enc']),
            'city' => $row['city'], 'business_name' => $row['business_name'], 'product' => $row['product'], 'stand_code' => $row['stand_code'], 'main_network' => $row['main_network'],
            'submitted_at' => $row['submitted_at'], 'followers_count' => (int) $row['followers_count'], 'level' => (int) $row['level'], 'videos_submitted' => (int) $row['videos_submitted'], 'videos_total' => self::VIDEO_SLOTS,
        ], $rows->fetchAll(PDO::FETCH_ASSOC));
        return ['items' => $items, 'page' => $page, 'per_page' => $perPage, 'total' => $total];
    }

    public function dashboard(): array
    {
        $statuses = array_fill_keys(self::STATUSES, 0);
        $query = $this->pdo->prepare('SELECT status, COUNT(*) AS count FROM emprendedor_profiles WHERE status <> ? GROUP BY status');
        $query->execute([self::ARCHIVED]);
        foreach ($query as $row) if (isset($statuses[$row['status']])) $statuses[$row['status']] = (int) $row['count'];
        $recent = $this->pdo->prepare('SELECT COUNT(*) FROM emprendedor_profiles WHERE status <> ? AND submitted_at >= ?');
        $recent->execute([self::ARCHIVED, gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
        $followers = $this->pdo->prepare('SELECT p.public_id, p.full_name, p.business_name, p.city, p.main_network, g.followers_count, g.level FROM emprendedor_progress g JOIN emprendedor_profiles p ON p.id = g.profile_id WHERE p.status <> ? AND g.followers_count > 0 ORDER BY g.followers_count DESC, p.full_name ASC LIMIT 20');
        $followers->execute([self::ARCHIVED]);
        $videos = $this->pdo->prepare("SELECT p.public_id, p.full_name, p.business_name, p.city, p.main_network, v.slot, v.url, v.views_count FROM emprendedor_videos v JOIN emprendedor_profiles p ON p.id = v.profile_id WHERE p.status <> ? AND v.status = 'submitted' AND v.url <> '' AND v.views_count > 0 ORDER BY v.views_count DESC, p.full_name ASC, v.slot ASC LIMIT 20");
        $videos->execute([self::ARCHIVED]);
        $int = static fn (array $row, array $keys): array => [...$row, ...array_combine($keys, array_map(static fn (string $key): int => (int) $row[$key], $keys))];
        return [
            'total' => array_sum($statuses), 'byStatus' => $statuses, 'lastSevenDays' => (int) $recent->fetchColumn(),
            'topFollowers' => array_map(static fn (array $row): array => $int($row, ['followers_count', 'level']), $followers->fetchAll(PDO::FETCH_ASSOC)),
            'topVideos' => array_map(static fn (array $row): array => $int($row, ['slot', 'views_count']), $videos->fetchAll(PDO::FETCH_ASSOC)),
        ];
    }

    public function find(string $publicId): ?array
    {
        $row = $this->row($publicId);
        if ($row === null) return null;
        $notes = $this->pdo->prepare('SELECT n.id, n.body, n.created_at, u.username AS author FROM emprendedor_notes n JOIN admin_users u ON u.id = n.author_id WHERE n.profile_id = ? ORDER BY n.created_at, n.id');
        $notes->execute([$row['id']]);
        $account = $this->pdo->prepare('SELECT email_enc, active, last_login_at FROM emprendedor_accounts WHERE id = ?');
        $account->execute([$row['account_id']]);
        $owner = $account->fetch();
        $id = (int) $row['id'];
        return [
            ...$this->present($row),
            'email' => $owner ? $this->crypto->decrypt($owner['email_enc']) : '',
            'account' => ['active' => $owner ? (int) $owner['active'] === 1 : false, 'last_login_at' => $owner['last_login_at'] ?? null],
            'photo' => $this->photoMeta($id),
            'consents' => $this->consents($id),
            'progress' => $this->progressFor($id, $row),
            'notes' => array_map(static fn (array $note): array => [...$note, 'id' => (int) $note['id']], $notes->fetchAll(PDO::FETCH_ASSOC)),
        ];
    }

    public function changeStatus(string $publicId, string $status, int $actorId, string $ip = ''): void
    {
        if (!in_array($status, self::STATUSES, true)) throw new InvalidArgumentException();
        $this->mutate($publicId, function (array $row) use ($status, $actorId, $ip, $publicId): void {
            if ($row['status'] === $status) return;
            $this->pdo->prepare('UPDATE emprendedor_profiles SET status = ?, updated_at = ? WHERE id = ?')->execute([$status, gmdate('Y-m-d H:i:s'), $row['id']]);
            $this->audit->log('emprendedor.status_changed', $actorId, 'emprendedor_profile', $publicId, ['from_status' => $row['status'], 'to_status' => $status], $ip);
        });
    }

    public function addNote(string $publicId, string $text, int $actorId, string $ip = ''): void
    {
        $text = trim($text);
        if ($text === '' || self::length($text) > 2000) throw new InvalidArgumentException();
        $this->mutate($publicId, function (array $row) use ($text, $actorId, $ip, $publicId): void {
            $this->pdo->prepare('INSERT INTO emprendedor_notes (profile_id, author_id, body, created_at) VALUES (?, ?, ?, ?)')->execute([$row['id'], $actorId, $text, gmdate('Y-m-d H:i:s')]);
            $this->audit->log('emprendedor.note_added', $actorId, 'emprendedor_profile', $publicId, ['note_id' => (int) $this->pdo->lastInsertId()], $ip);
        });
    }

    /** Safe retirement: hides the record and disables its account; nothing is physically deleted. */
    public function archive(string $publicId, int $actorId, string $ip = ''): void
    {
        $this->mutate($publicId, function (array $row) use ($actorId, $ip, $publicId): void {
            $now = gmdate('Y-m-d H:i:s');
            $this->pdo->prepare('UPDATE emprendedor_profiles SET status = ?, updated_at = ? WHERE id = ?')->execute([self::ARCHIVED, $now, $row['id']]);
            $this->pdo->prepare('UPDATE emprendedor_accounts SET active = 0, updated_at = ? WHERE id = ?')->execute([$now, $row['account_id']]);
            $this->audit->log('emprendedor.archived', $actorId, 'emprendedor_profile', $publicId, [], $ip);
        });
    }

    /** Accounts created without a saved record yet. */
    public function pendingAccounts(): array
    {
        $rows = $this->pdo->query('SELECT a.public_id, a.email_enc, a.created_at, a.last_login_at FROM emprendedor_accounts a LEFT JOIN emprendedor_profiles p ON p.account_id = a.id WHERE a.active = 1 AND p.id IS NULL ORDER BY a.created_at DESC, a.id DESC LIMIT 200');
        $items = [];
        foreach ($rows as $row) $items[] = ['public_id' => $row['public_id'], 'email' => $this->crypto->decrypt($row['email_enc']), 'created_at' => $row['created_at'], 'last_login_at' => $row['last_login_at']];
        return $items;
    }

    public function archiveAccount(string $publicId, int $actorId, string $ip = ''): void
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $this->begin();
        try {
            $statement = $this->pdo->prepare('SELECT a.id FROM emprendedor_accounts a LEFT JOIN emprendedor_profiles p ON p.account_id = a.id WHERE a.public_id = ? AND a.active = 1 AND p.id IS NULL');
            $statement->execute([$publicId]);
            $id = $statement->fetchColumn();
            if ($id === false) throw new OutOfBoundsException();
            $this->pdo->prepare('UPDATE emprendedor_accounts SET active = 0, updated_at = ? WHERE id = ?')->execute([gmdate('Y-m-d H:i:s'), $id]);
            $this->audit->log('emprendedor_account.archived', $actorId, 'emprendedor_account', $publicId, [], $ip);
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

    public function photoForAccount(int $accountId, EmprendedorPhotoStorage $storage): string
    {
        $statement = $this->pdo->prepare('SELECT f.storage_key FROM emprendedor_photos f JOIN emprendedor_profiles p ON p.id = f.profile_id WHERE p.account_id = ? AND p.status <> ?');
        $statement->execute([$accountId, self::ARCHIVED]);
        $key = $statement->fetchColumn();
        if ($key === false) throw new OutOfBoundsException();
        return $storage->read($key);
    }

    public function photoForAdmin(string $publicId, EmprendedorPhotoStorage $storage, int $actorId, string $ip): string
    {
        $row = $this->row($publicId);
        if ($row === null) throw new OutOfBoundsException();
        $statement = $this->pdo->prepare('SELECT storage_key FROM emprendedor_photos WHERE profile_id = ?');
        $statement->execute([$row['id']]);
        $key = $statement->fetchColumn();
        if ($key === false) throw new OutOfBoundsException();
        $jpeg = $storage->read($key);
        $this->audit->log('emprendedor.photo_viewed', $actorId, 'emprendedor_profile', $publicId, [], $ip);
        return $jpeg;
    }

    // ---------------------------------------------------------------- helpers

    private function photoMeta(int $profileId): array
    {
        $statement = $this->pdo->prepare('SELECT width, height, created_at FROM emprendedor_photos WHERE profile_id = ?');
        $statement->execute([$profileId]);
        $row = $statement->fetch();
        return $row === false ? ['available' => false, 'width' => null, 'height' => null, 'created_at' => null] : ['available' => true, 'width' => (int) $row['width'], 'height' => (int) $row['height'], 'created_at' => (string) $row['created_at']];
    }

    private function present(array $row): array
    {
        $result = ['public_id' => $row['public_id'], 'status' => $row['status'], 'traffic_light' => self::light($row), 'age_at_submission' => (int) $row['age_at_submission'], 'submitted_at' => $row['submitted_at'], 'updated_at' => $row['updated_at']];
        foreach (self::PLAIN as $field) $result[$field] = (string) $row[$field];
        foreach (self::ENCRYPTED as $field) $result[$field] = $this->crypto->decrypt($row[$field . '_enc']);
        return $result;
    }

    private static function light(array $row): string
    {
        return in_array($row['traffic_light'] ?? null, self::TRAFFIC_LIGHTS, true) ? $row['traffic_light'] : 'red';
    }

    private function row(string $publicId): ?array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $statement = $this->pdo->prepare('SELECT * FROM emprendedor_profiles WHERE public_id = ? AND status <> ?' . $this->rowLock());
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
