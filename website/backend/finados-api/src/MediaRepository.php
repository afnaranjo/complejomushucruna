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
require_once __DIR__ . '/MediaPhotoStorage.php';

/** Media accreditation records: owned by a media account, reviewed by administrators. */
final class MediaRepository
{
    public const STATUSES = ['Nuevo', 'En revisión', 'Aprobado', 'Rechazado'];
    public const PROVINCES = [
        'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas',
        'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha',
        'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe',
    ];
    /** Kinds of public channel. A medium may declare several of the same kind; at least one channel is required. */
    public const CHANNEL_TYPES = ['facebook' => 'Facebook', 'instagram' => 'Instagram', 'tiktok' => 'TikTok', 'youtube' => 'YouTube', 'x' => 'X', 'website' => 'Página web', 'otro' => 'Otro canal'];
    public const MAX_CHANNELS = 20;
    public const MAX_TV_CHANNELS = 10;
    // Columns from 011 keep the first link of each kind so earlier exports stay meaningful.
    private const CHANNEL_COLUMNS = ['facebook' => 'facebook', 'instagram' => 'instagram', 'tiktok' => 'tiktok', 'youtube' => 'youtube', 'website' => 'website', 'otro' => 'other_link', 'x' => 'other_link'];
    /** A medium may operate on several platforms at once; at least one is required. */
    public const MEDIA_TYPES = ['radio' => 'Radio', 'tv' => 'Televisión', 'prensa' => 'Prensa escrita', 'digital' => 'Medio digital', 'redes' => 'Redes sociales'];
    public const RADIO_GENRES = ['Noticias e información', 'Musical variada', 'Popular y tropical', 'Folclórica y andina', 'Juvenil y pop', 'Romántica', 'Religiosa', 'Deportiva', 'Comunitaria', 'Otro'];
    public const MAX_STATIONS = 10;
    public const FIELDS = ['media_name', 'media_types', 'radio_stations', 'audience_count', 'radio_genre', 'tv_channels', 'contact_name', 'phone', 'contact_email', 'province', 'city',
        'channels', 'conditions_accepted', 'privacy_accepted', 'image_accepted'];
    /** Required consents block the save when rejected; image use is separate and optional. */
    public const CONSENTS = ['conditions' => true, 'privacy' => true, 'image' => false];
    public const MAX_VIDEOS = 100;
    /** Same three-step traffic light the Voceros programme uses; set only by administration. */
    public const TRAFFIC_LIGHTS = ['red', 'yellow', 'green'];
    private const ARCHIVED = 'Eliminado';
    private const EDITABLE = ['Nuevo', 'En revisión'];
    // social_link keeps the first declared channel so lists and searches have one primary link.
    // frequency_channel is derived from the declared stations and TV channel so lists keep one readable column.
    private const PLAIN = ['media_name', 'media_types', 'radio_stations', 'audience_count', 'radio_genre', 'tv_channel', 'tv_channels', 'frequency_channel', 'province', 'city', 'social_link', 'channels', 'facebook', 'instagram', 'tiktok', 'youtube', 'website', 'other_link'];
    private const ENCRYPTED = ['contact_name', 'phone', 'contact_email'];
    // Columns from the first accreditation form (008). They stay in the schema, unused, so no data is ever dropped.
    private const LEGACY_PLAIN = ['media_type' => '', 'program_name' => '', 'program_type' => '', 'contract' => '', 'people_count' => 0];
    private const LEGACY_ENCRYPTED = ['team_enc'];
    private readonly Audit $audit;
    private readonly array $conditions;
    private readonly array $catalogue;

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
        foreach (array_keys(self::CONSENTS) as $type) {
            if (!is_string($catalogue[$type]['version'] ?? null) || !is_string($catalogue[$type]['text'] ?? null)) throw new RuntimeException('No se pudo cargar las condiciones de acreditación.');
        }
        $this->conditions = $conditions;
        $this->catalogue = $catalogue;
    }

    /** Own record for the authenticated media account, or null before the first save. */
    public function forAccount(int $accountId): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM media_profiles WHERE account_id = ?');
        $statement->execute([$accountId]);
        $row = $statement->fetch();
        if ($row === false || $row['status'] === self::ARCHIVED) return null;
        return [...$this->present($row), 'editable' => in_array($row['status'], self::EDITABLE, true), 'videos' => $this->videos((int) $row['id']),
            'can_add_videos' => $row['status'] !== 'Rechazado', 'consents' => $this->consents((int) $row['id']), 'photo' => $this->photoMeta((int) $row['id'])];
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
                $legacy = self::LEGACY_PLAIN;
                foreach (self::LEGACY_ENCRYPTED as $column) $legacy[$column] = $this->crypto->encrypt('');
                $values = ['public_id' => $publicId, 'account_id' => $accountId, 'status' => 'Nuevo', ...$legacy, ...$values, 'submitted_at' => $now];
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
            $profileId = $existing === false ? (int) $this->pdo->query('SELECT id FROM media_profiles WHERE account_id = ' . (int) $accountId)->fetchColumn() : (int) $existing['id'];
            $this->recordConsents($profileId, $input, $ip, $now);
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
            if (!isset(self::MEDIA_TYPES[$type])) throw new InvalidArgumentException();
            // Keys are stored comma-delimited on both ends, so a plain LIKE matches whole keys only.
            $where[] = 'media_types LIKE ?'; $parameters[] = '%,' . $type . ',%';
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
            $where[] = "(media_name LIKE ? ESCAPE '\\' OR frequency_channel LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\')";
            array_push($parameters, $like, $like, $like);
        }
        $condition = implode(' AND ', $where);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM media_profiles WHERE ' . $condition);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        $rows = $this->pdo->prepare('SELECT public_id, status, traffic_light, media_name, media_types, frequency_channel, audience_count, radio_genre, province, city, social_link, channels, facebook, instagram, tiktok, youtube, website, other_link, submitted_at, (SELECT COUNT(*) FROM media_videos v WHERE v.profile_id = media_profiles.id) AS videos_count, (SELECT COALESCE(SUM(v.views_count), 0) FROM media_videos v WHERE v.profile_id = media_profiles.id) AS views_total FROM media_profiles WHERE ' . $condition . ' ORDER BY submitted_at DESC, id DESC LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage));
        $rows->execute($parameters);
        $items = array_map(static function (array $row): array { $decoded = []; $legacy = array_flip(['facebook', 'instagram', 'tiktok', 'youtube', 'website', 'other_link']); return [...array_diff_key($row, $legacy), 'traffic_light' => self::light($row), 'channels' => $decoded = self::channelsOf($row), 'followers_total' => self::followersTotal($decoded), 'media_types' => self::typeKeys((string) $row['media_types']), 'audience_count' => $row['audience_count'] === null ? null : (int) $row['audience_count'], 'videos_count' => (int) $row['videos_count'], 'views_total' => (int) $row['views_total']]; }, $rows->fetchAll(PDO::FETCH_ASSOC));
        return ['items' => $items, 'page' => $page, 'per_page' => $perPage, 'total' => $total];
    }

    public function summary(): array
    {
        $statuses = array_fill_keys(self::STATUSES, 0);
        $query = $this->pdo->prepare('SELECT status, COUNT(*) AS count FROM media_profiles WHERE status <> ? GROUP BY status');
        $query->execute([self::ARCHIVED]);
        foreach ($query as $row) if (isset($statuses[$row['status']])) $statuses[$row['status']] = (int) $row['count'];
        $videos = $this->pdo->prepare('SELECT COUNT(*) FROM media_videos v JOIN media_profiles m ON m.id = v.profile_id WHERE m.status <> ?');
        $videos->execute([self::ARCHIVED]);
        $views = $this->pdo->prepare('SELECT COALESCE(SUM(v.views_count), 0) FROM media_videos v JOIN media_profiles m ON m.id = v.profile_id WHERE m.status <> ?');
        $views->execute([self::ARCHIVED]);
        return ['total' => array_sum($statuses), 'byStatus' => $statuses, 'videos' => (int) $videos->fetchColumn(), 'views' => (int) $views->fetchColumn()];
    }

    /** Media ranked by the followers they declared across all their channels. */
    public function topByFollowers(int $limit = 20): array
    {
        $query = $this->pdo->prepare('SELECT public_id, media_name, frequency_channel, channels, facebook, instagram, tiktok, youtube, website, other_link FROM media_profiles WHERE status <> ?');
        $query->execute([self::ARCHIVED]);
        $ranking = [];
        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $channels = self::channelsOf($row);
            $total = self::followersTotal($channels);
            if ($total <= 0) continue;
            $best = array_reduce($channels, static fn (?array $carry, array $channel): ?array => ($channel['followers'] ?? 0) > ($carry['followers'] ?? 0) ? $channel : $carry);
            $ranking[] = ['public_id' => (string) $row['public_id'], 'media_name' => (string) $row['media_name'], 'frequency_channel' => (string) $row['frequency_channel'],
                'followers_total' => $total, 'channels_count' => count($channels), 'top_channel' => (string) ($best['type'] ?? '')];
        }
        usort($ranking, static fn (array $left, array $right): int => [$right['followers_total'], $left['media_name']] <=> [$left['followers_total'], $right['media_name']]);
        return array_slice($ranking, 0, max(1, min(50, $limit)));
    }

    /**
     * Channel list of a record. Records saved before 014 kept one link per network in their own
     * columns; they are presented as a list so nothing disappears until the medium saves again.
     */
    private static function channelsOf(array $row): array
    {
        $channels = json_decode((string) ($row['channels'] ?? '') ?: '[]', true, 8);
        if (is_array($channels) && $channels !== []) return $channels;
        $legacy = [];
        foreach (['facebook' => 'facebook', 'instagram' => 'instagram', 'tiktok' => 'tiktok', 'youtube' => 'youtube', 'website' => 'website', 'other_link' => 'otro'] as $column => $type) {
            $url = trim((string) ($row[$column] ?? ''));
            if ($url !== '') $legacy[] = ['type' => $type, 'url' => $url, 'followers' => null];
        }
        return $legacy;
    }

    private static function tvChannelsOf(array $row): array
    {
        $channels = json_decode((string) ($row['tv_channels'] ?? '') ?: '[]', true, 8);
        if (is_array($channels) && $channels !== []) return $channels;
        $legacy = trim((string) ($row['tv_channel'] ?? ''));
        return $legacy === '' ? [] : [$legacy];
    }

    private static function light(array $row): string
    {
        return in_array($row['traffic_light'] ?? null, self::TRAFFIC_LIGHTS, true) ? $row['traffic_light'] : 'red';
    }

    private static function followersTotal(array $channels): int
    {
        return (int) array_sum(array_map(static fn (mixed $channel): int => is_array($channel) && is_int($channel['followers'] ?? null) ? $channel['followers'] : 0, $channels));
    }

    /** Media ranked by the validated views of all their reported videos. */
    public function topByViews(int $limit = 20): array
    {
        $limit = max(1, min(50, $limit));
        $query = $this->pdo->prepare('SELECT m.public_id, m.media_name, m.frequency_channel, COUNT(v.id) AS videos_count, SUM(v.views_count) AS views_total, MAX(v.views_count) AS best_video_views FROM media_profiles m JOIN media_videos v ON v.profile_id = m.id WHERE m.status <> ? GROUP BY m.id, m.public_id, m.media_name, m.frequency_channel HAVING SUM(v.views_count) > 0 ORDER BY views_total DESC, m.media_name ASC LIMIT ' . $limit);
        $query->execute([self::ARCHIVED]);
        return array_map(static fn (array $row): array => [
            'public_id' => (string) $row['public_id'], 'media_name' => (string) $row['media_name'], 'frequency_channel' => (string) $row['frequency_channel'],
            'videos_count' => (int) $row['videos_count'], 'views_total' => (int) $row['views_total'], 'best_video_views' => (int) $row['best_video_views'],
        ], $query->fetchAll(PDO::FETCH_ASSOC));
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
            'videos' => $this->videos((int) $row['id'], true),
            'consents' => $this->consents((int) $row['id']),
            'photo' => $this->photoMeta((int) $row['id']),
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

    public function changeTrafficLight(string $publicId, string $light, int $actorId, string $ip = ''): void
    {
        if (!in_array($light, self::TRAFFIC_LIGHTS, true)) throw new InvalidArgumentException();
        $this->mutate($publicId, function (array $row) use ($light, $actorId, $ip, $publicId): void {
            if (self::light($row) === $light) return;
            $this->pdo->prepare('UPDATE media_profiles SET traffic_light = ?, updated_at = ? WHERE id = ?')->execute([$light, gmdate('Y-m-d H:i:s'), $row['id']]);
            $this->audit->log('media.traffic_light_changed', $actorId, 'media_profile', $publicId, [], $ip);
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
        foreach (self::CONSENTS as $type => $required) {
            $accepted = $input[$type . '_accepted'];
            if (!is_bool($accepted) || ($required && $accepted !== true)) throw new InvalidArgumentException();
        }
        $text = static function (mixed $value, int $max): string {
            if (!is_string($value)) throw new InvalidArgumentException();
            $value = trim(preg_replace('/\p{C}+/u', ' ', $value) ?? '');
            if ($value === '' || self::length($value) > $max) throw new InvalidArgumentException();
            return $value;
        };
        $phone = $text($input['phone'], 25);
        if (preg_match('/^\+?[0-9][0-9 ()-]{6,23}$/D', $phone) !== 1) throw new InvalidArgumentException();
        $email = strtolower($text($input['contact_email'], 180));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) throw new InvalidArgumentException();
        if (!is_string($input['province']) || !in_array($input['province'], self::PROVINCES, true)) throw new InvalidArgumentException();
        $types = $input['media_types'];
        if (!is_array($types) || $types === [] || !array_is_list($types) || count($types) !== count(array_unique($types, SORT_REGULAR))) throw new InvalidArgumentException();
        foreach ($types as $type) if (!is_string($type) || !isset(self::MEDIA_TYPES[$type])) throw new InvalidArgumentException();
        $types = array_values(array_intersect(array_keys(self::MEDIA_TYPES), $types));
        $stations = []; $audience = null; $genre = ''; $tvChannel = '';
        if (in_array('radio', $types, true)) {
            // Radio details are mandatory once Radio is declared: stations, self-reported audience and genre.
            if (!is_array($input['radio_stations']) || !array_is_list($input['radio_stations']) || $input['radio_stations'] === [] || count($input['radio_stations']) > self::MAX_STATIONS) throw new InvalidArgumentException();
            foreach ($input['radio_stations'] as $station) {
                if ($station instanceof \stdClass) $station = (array) $station;
                if (!is_array($station) || array_diff(array_keys($station), ['name', 'frequency']) !== [] || count($station) !== 2) throw new InvalidArgumentException();
                $stations[] = ['name' => $text($station['name'], 140), 'frequency' => $text($station['frequency'], 40)];
            }
            if (!is_int($input['audience_count']) || $input['audience_count'] < 0 || $input['audience_count'] > 100000000) throw new InvalidArgumentException();
            $audience = $input['audience_count'];
            if (!is_string($input['radio_genre']) || !in_array($input['radio_genre'], self::RADIO_GENRES, true)) throw new InvalidArgumentException();
            $genre = $input['radio_genre'];
        } elseif ($input['radio_stations'] !== [] || $input['audience_count'] !== null || $input['radio_genre'] !== '') {
            throw new InvalidArgumentException();
        }
        $tvChannels = [];
        if (!is_array($input['tv_channels']) || !array_is_list($input['tv_channels'])) throw new InvalidArgumentException();
        if (in_array('tv', $types, true)) {
            if ($input['tv_channels'] === [] || count($input['tv_channels']) > self::MAX_TV_CHANNELS) throw new InvalidArgumentException();
            foreach ($input['tv_channels'] as $channel) $tvChannels[] = $text($channel, 120);
        } elseif ($input['tv_channels'] !== []) throw new InvalidArgumentException();
        $tvChannel = $tvChannels[0] ?? '';
        $summary = implode(' · ', [...array_map(static fn (array $station): string => $station['frequency'], $stations), ...$tvChannels]);
        $record = [
            'media_name' => $text($input['media_name'], 140),
            'media_types' => ',' . implode(',', $types) . ',',
            'radio_stations' => json_encode($stations, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'audience_count' => $audience,
            'radio_genre' => $genre,
            'tv_channel' => $tvChannel,
            'tv_channels' => json_encode($tvChannels, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'frequency_channel' => substr($summary, 0, 120),
            'contact_name' => $text($input['contact_name'], 160),
            'phone' => $phone,
            'contact_email' => $email,
            'province' => $input['province'],
            'city' => $text($input['city'], 100),
        ];
        if (!is_array($input['channels']) || !array_is_list($input['channels']) || $input['channels'] === [] || count($input['channels']) > self::MAX_CHANNELS) throw new InvalidArgumentException();
        $channels = []; $seen = [];
        foreach ($input['channels'] as $channel) {
            if ($channel instanceof \stdClass) $channel = (array) $channel;
            if (!is_array($channel) || array_diff(array_keys($channel), ['type', 'url', 'followers']) !== [] || count($channel) !== 3
                || !is_string($channel['type'] ?? null) || !isset(self::CHANNEL_TYPES[$channel['type']])) throw new InvalidArgumentException();
            // Followers are self-reported per account and optional; a web page has none.
            $followers = $channel['followers'];
            if ($followers !== null && (!is_int($followers) || $followers < 0 || $followers > 1000000000 || $channel['type'] === 'website')) throw new InvalidArgumentException();
            $url = self::link($channel['url'] ?? null, 300);
            if (isset($seen[strtolower($url)])) throw new InvalidArgumentException();
            $seen[strtolower($url)] = true;
            $channels[] = ['type' => $channel['type'], 'url' => $url, 'followers' => $followers];
        }
        $record['channels'] = json_encode($channels, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        foreach (array_unique(self::CHANNEL_COLUMNS) as $column) $record[$column] = '';
        foreach ($channels as $channel) {
            $column = self::CHANNEL_COLUMNS[$channel['type']];
            if ($record[$column] === '') $record[$column] = $channel['url'];
        }
        $record['social_link'] = $channels[0]['url'];
        return $record;
    }

    /** Public https link; a bare "facebook.com/medio" is accepted and normalized. */
    public static function link(mixed $value, int $max): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $value = trim($value);
        if ($value !== '' && preg_match('~^https?://~i', $value) !== 1) $value = 'https://' . $value;
        $value = preg_replace('~^http://~i', 'https://', $value) ?? '';
        $parts = parse_url($value);
        if ($value === '' || strlen($value) > $max || preg_match('/[\x00-\x20<>"]/', $value) === 1 || str_contains($value, '\\') || !is_array($parts)
            || strtolower($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['pass'])
            || preg_match('/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/iD', $parts['host'] ?? '') !== 1) {
            throw new InvalidArgumentException();
        }
        return $value;
    }

    /** Appends one published video link to the owner's record; links are kept as evidence and never edited. */
    public function addVideoForAccount(int $accountId, mixed $url, string $ip): array
    {
        $url = self::link($url, 500);
        $this->begin();
        try {
            $statement = $this->pdo->prepare('SELECT id, public_id, status FROM media_profiles WHERE account_id = ?' . $this->rowLock());
            $statement->execute([$accountId]);
            $profile = $statement->fetch();
            if ($profile === false || in_array($profile['status'], [self::ARCHIVED, 'Rechazado'], true)) throw new Forbidden();
            $count = $this->pdo->prepare('SELECT COUNT(*) FROM media_videos WHERE profile_id = ?');
            $count->execute([$profile['id']]);
            if ((int) $count->fetchColumn() >= self::MAX_VIDEOS) throw new InvalidArgumentException();
            $hash = hash('sha256', strtolower($url));
            $duplicate = $this->pdo->prepare('SELECT 1 FROM media_videos WHERE profile_id = ? AND url_hash = ?');
            $duplicate->execute([$profile['id'], $hash]);
            if ($duplicate->fetchColumn() !== false) throw new DuplicateRegistration();
            $this->pdo->prepare('INSERT INTO media_videos (profile_id, url, url_hash, created_at) VALUES (?, ?, ?, ?)')
                ->execute([$profile['id'], $url, $hash, gmdate('Y-m-d H:i:s')]);
            $this->audit->log('media.video_added', null, 'media_profile', $profile['public_id'], [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
        return $this->videos((int) $profile['id']);
    }

    /** Validated views are entered by administration beside each reported link. */
    public function updateVideoViews(string $publicId, mixed $input, int $actorId, string $ip = ''): void
    {
        if ($input instanceof \stdClass) $input = (array) $input;
        if (!is_array($input) || $input === [] || count($input) > self::MAX_VIDEOS) throw new InvalidArgumentException();
        $views = [];
        foreach ($input as $id => $count) {
            $id = filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            $count = is_int($count) ? filter_var($count, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 1000000000]]) : false;
            if ($id === false || $count === false) throw new InvalidArgumentException();
            $views[$id] = $count;
        }
        $this->mutate($publicId, function (array $row) use ($views, $actorId, $ip, $publicId): void {
            $owned = $this->pdo->prepare('SELECT id FROM media_videos WHERE profile_id = ?');
            $owned->execute([$row['id']]);
            $ids = array_map('intval', $owned->fetchAll(PDO::FETCH_COLUMN));
            if (array_diff(array_keys($views), $ids) !== []) throw new InvalidArgumentException();
            $update = $this->pdo->prepare('UPDATE media_videos SET views_count = ? WHERE id = ? AND profile_id = ?');
            foreach ($views as $id => $count) $update->execute([$count, $id, $row['id']]);
            $this->audit->log('media.video_views_updated', $actorId, 'media_profile', $publicId, ['count' => count($views)], $ip);
        });
    }

    /** Replaces the representative's profile photo. It is normalized, encrypted and kept outside the Voceros store. */
    public function savePhotoForAccount(int $accountId, MediaPhotoStorage $storage, string $temporaryPath, int $declaredSize, string $ip): array
    {
        $statement = $this->pdo->prepare('SELECT id, public_id, status FROM media_profiles WHERE account_id = ?');
        $statement->execute([$accountId]);
        $profile = $statement->fetch();
        if ($profile === false || in_array($profile['status'], [self::ARCHIVED, 'Rechazado'], true)) throw new Forbidden();
        try { $photo = $storage->stage($temporaryPath, $declaredSize); }
        catch (RuntimeException) { throw new InvalidArgumentException(); }
        $promoted = false;
        try {
            $storage->promote($photo); $promoted = true;
            $this->begin();
            $previous = $this->pdo->prepare('SELECT storage_key FROM media_photos WHERE profile_id = ?');
            $previous->execute([$profile['id']]);
            $oldKey = $previous->fetchColumn();
            $values = [$photo['storage_key'], $photo['mime_type'], $photo['bytes'], $photo['sha256'], $photo['width'], $photo['height'], gmdate('Y-m-d H:i:s'), $profile['id']];
            if ($oldKey === false) $this->pdo->prepare('INSERT INTO media_photos (storage_key, content_type, bytes, sha256, width, height, created_at, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute($values);
            else $this->pdo->prepare('UPDATE media_photos SET storage_key = ?, content_type = ?, bytes = ?, sha256 = ?, width = ?, height = ?, created_at = ? WHERE profile_id = ?')->execute($values);
            $this->audit->log('media.photo_saved', null, 'media_profile', $profile['public_id'], [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            try { $promoted ? $storage->delete($photo['storage_key']) : $storage->discard($photo); } catch (Throwable) { /* keep the original failure */ }
            throw $error;
        }
        if (is_string($oldKey)) { try { $storage->delete($oldKey); } catch (Throwable) { /* an orphaned ciphertext is harmless */ } }
        return $this->photoMeta((int) $profile['id']);
    }

    public function photoForAccount(int $accountId, MediaPhotoStorage $storage): string
    {
        $statement = $this->pdo->prepare('SELECT p.storage_key FROM media_photos p JOIN media_profiles m ON m.id = p.profile_id WHERE m.account_id = ? AND m.status <> ?');
        $statement->execute([$accountId, self::ARCHIVED]);
        $key = $statement->fetchColumn();
        if ($key === false) throw new OutOfBoundsException();
        return $storage->read($key);
    }

    public function photoForAdmin(string $publicId, MediaPhotoStorage $storage, int $actorId, string $ip): string
    {
        $row = $this->row($publicId);
        if ($row === null) throw new OutOfBoundsException();
        $statement = $this->pdo->prepare('SELECT storage_key FROM media_photos WHERE profile_id = ?');
        $statement->execute([$row['id']]);
        $key = $statement->fetchColumn();
        if ($key === false) throw new OutOfBoundsException();
        $jpeg = $storage->read($key);
        $this->audit->log('media.photo_viewed', $actorId, 'media_profile', $publicId, [], $ip);
        return $jpeg;
    }

    private function photoMeta(int $profileId): array
    {
        $statement = $this->pdo->prepare('SELECT width, height, created_at FROM media_photos WHERE profile_id = ?');
        $statement->execute([$profileId]);
        $row = $statement->fetch();
        return $row === false ? ['available' => false] : ['available' => true, 'width' => (int) $row['width'], 'height' => (int) $row['height'], 'created_at' => (string) $row['created_at']];
    }

    /** Append-only evidence: a new row is written only when the answer or the accepted text changes. */
    private function recordConsents(int $profileId, array $input, string $ip, string $now): void
    {
        $latest = $this->pdo->prepare('SELECT accepted, text_hash FROM media_consents WHERE profile_id = ? AND consent_type = ? ORDER BY recorded_at DESC, id DESC LIMIT 1');
        $insert = $this->pdo->prepare('INSERT INTO media_consents (profile_id, consent_type, accepted, text_version, text_hash, ip_hash, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        foreach (array_keys(self::CONSENTS) as $type) {
            $accepted = (int) ($input[$type . '_accepted'] === true);
            $hash = hash('sha256', $this->catalogue[$type]['text']);
            $latest->execute([$profileId, $type]);
            $previous = $latest->fetch();
            if ($previous !== false && (int) $previous['accepted'] === $accepted && $previous['text_hash'] === $hash) continue;
            $insert->execute([$profileId, $type, $accepted, $this->catalogue[$type]['version'], $hash, $this->crypto->lookup($ip), $now]);
        }
    }

    /** Current answer per consent type, without IP or hashes. */
    private function consents(int $profileId): array
    {
        $statement = $this->pdo->prepare('SELECT consent_type, accepted, text_version, recorded_at FROM media_consents WHERE profile_id = ? ORDER BY recorded_at, id');
        $statement->execute([$profileId]);
        $current = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $current[$row['consent_type']] = ['accepted' => (int) $row['accepted'] === 1, 'version' => (string) $row['text_version'], 'recorded_at' => (string) $row['recorded_at']];
        }
        return $current;
    }

    private function videos(int $profileId, bool $administrative = false): array
    {
        $statement = $this->pdo->prepare('SELECT id, url, created_at, views_count FROM media_videos WHERE profile_id = ? ORDER BY created_at DESC, id DESC');
        $statement->execute([$profileId]);
        return array_map(static fn (array $row): array => $administrative
            ? ['id' => (int) $row['id'], 'url' => (string) $row['url'], 'created_at' => (string) $row['created_at'], 'views_count' => (int) $row['views_count']]
            : ['url' => (string) $row['url'], 'created_at' => (string) $row['created_at']], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function present(array $row): array
    {
        $result = ['public_id' => $row['public_id'], 'status' => $row['status'], 'traffic_light' => self::light($row), 'submitted_at' => $row['submitted_at'], 'updated_at' => $row['updated_at']];
        foreach (self::PLAIN as $field) $result[$field] = (string) $row[$field];
        $result['media_types'] = self::typeKeys((string) ($row['media_types'] ?? ''));
        $result['radio_stations'] = json_decode((string) ($row['radio_stations'] ?? '') ?: '[]', true, 8) ?: [];
        $result['tv_channels'] = self::tvChannelsOf($row);
        $result['channels'] = self::channelsOf($row);
        $result['followers_total'] = self::followersTotal($result['channels']);
        $result['audience_count'] = ($row['audience_count'] ?? null) === null ? null : (int) $row['audience_count'];
        foreach (self::ENCRYPTED as $field) $result[$field] = ($row[$field . '_enc'] ?? null) === null || $row[$field . '_enc'] === '' ? '' : $this->crypto->decrypt($row[$field . '_enc']);
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

    private static function typeKeys(string $stored): array
    {
        return array_values(array_filter(explode(',', $stored), static fn (string $key): bool => isset(self::MEDIA_TYPES[$key])));
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
