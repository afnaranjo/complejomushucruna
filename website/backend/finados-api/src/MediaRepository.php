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
    /** Whether the organisation buys advertising in this medium (016). Internal, set only by administration and never shown to the medium. */
    public const PAID_MEDIA = ['no', 'yes'];
    /** Who created the record: the medium itself (`cuenta`) or coordination on its behalf (`coordinacion`, 018). */
    public const ORIGINS = ['cuenta', 'coordinacion'];
    /** Outcome of a medium's coverage of one event, set by coordination. A link is not the only proof: radio mentions count too. */
    public const COVERAGE_RESULTS = ['pendiente' => 'Pendiente', 'link' => 'Publicó con link', 'mencion' => 'Mención al aire', 'sin_publicacion' => 'No publicó', 'no_asistio' => 'No asistió'];
    public const COVERAGE_PUBLISHED = ['link', 'mencion'];
    /** The medium answers the invitation from its portal; coordination records who actually came (019). */
    public const ATTENDANCE = ['yes', 'no'];
    /** Fields coordination may set when it creates or completes a record; contact data stays optional here. */
    public const ADMIN_FIELDS = ['media_name', 'media_types', 'frequency', 'tv_channel', 'province', 'city', 'program_name', 'representatives', 'channels', 'followers_validated', 'paid_media', 'contact_name', 'phone', 'contact_email', 'audience_count', 'radio_genre'];
    public const MAX_REPRESENTATIVES = 20;
    public const MAX_COVERAGE_LINKS = 20;
    private const INVITATION_TTL = 7 * 86400;
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
        return [...$this->present($row), 'editable' => in_array($row['status'], self::EDITABLE, true), 'videos' => $this->videos((int) $row['id']), 'events' => $this->invitationsForAccount($accountId),
            'can_add_videos' => $row['status'] === 'Aprobado' && $this->photoMeta((int) $row['id'])['available'], 'can_upload_photo' => $row['status'] !== 'Rechazado', 'photo_required' => true, 'consents' => $this->consents((int) $row['id']), 'photo' => $this->photoMeta((int) $row['id'])];
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
        $paid = trim((string) ($filters['paid_media'] ?? ''));
        if ($paid !== '') {
            if (!in_array($paid, self::PAID_MEDIA, true)) throw new InvalidArgumentException();
            $where[] = 'paid_media = ?'; $parameters[] = $paid;
        }
        $origin = trim((string) ($filters['origin'] ?? ''));
        if ($origin !== '') {
            if (!in_array($origin, self::ORIGINS, true)) throw new InvalidArgumentException();
            $where[] = 'origin = ?'; $parameters[] = $origin;
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
        $rows = $this->pdo->prepare('SELECT public_id, status, traffic_light, paid_media, origin, account_id, claim_requested_at, program_name, followers_validated, media_name, media_types, frequency_channel, audience_count, radio_genre, province, city, social_link, channels, facebook, instagram, tiktok, youtube, website, other_link, submitted_at, (SELECT COUNT(*) FROM media_videos v WHERE v.profile_id = media_profiles.id) AS videos_count, (SELECT COALESCE(SUM(v.views_count), 0) FROM media_videos v WHERE v.profile_id = media_profiles.id) AS views_total, (SELECT COUNT(*) FROM media_event_coverage c WHERE c.profile_id = media_profiles.id AND c.links <> \'[]\' AND c.links IS NOT NULL) AS event_links_count, (SELECT COUNT(*) FROM media_event_coverage c WHERE c.profile_id = media_profiles.id AND c.attended = \'yes\') AS events_attended FROM media_profiles WHERE ' . $condition . ' ORDER BY submitted_at DESC, id DESC LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage));
        $rows->execute($parameters);
        $items = array_map(static function (array $row): array { $decoded = []; $legacy = array_flip(['facebook', 'instagram', 'tiktok', 'youtube', 'website', 'other_link']); return [...array_diff_key($row, [...$legacy, 'account_id' => 1, 'claim_requested_at' => 1]), 'traffic_light' => self::light($row), 'paid_media' => self::paid($row), 'origin' => self::origin($row), 'linked' => $row['account_id'] !== null, 'claim_pending' => $row['claim_requested_at'] !== null, 'followers_validated' => $row['followers_validated'] === null ? null : (int) $row['followers_validated'], 'channels' => $decoded = self::channelsOf($row), 'followers_total' => self::followersTotal($decoded), 'media_types' => self::typeKeys((string) $row['media_types']), 'audience_count' => $row['audience_count'] === null ? null : (int) $row['audience_count'], 'videos_count' => (int) $row['videos_count'], 'views_total' => (int) $row['views_total'], 'event_links_count' => (int) $row['event_links_count'], 'events_attended' => (int) $row['events_attended']]; }, $rows->fetchAll(PDO::FETCH_ASSOC));
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

    /**
     * Everything the opening panel shows about Medios: each figure carries the list behind it so a
     * click can reveal the rows without another request.
     */
    public function panel(): array
    {
        $rows = $this->pdo->prepare("SELECT p.public_id, p.media_name, p.status, p.city, p.paid_media, p.origin, p.account_id, (SELECT COUNT(*) FROM media_videos v WHERE v.profile_id = p.id) AS videos_count, (SELECT COALESCE(SUM(v.views_count), 0) FROM media_videos v WHERE v.profile_id = p.id) AS views_total FROM media_profiles p WHERE p.status <> ? ORDER BY p.media_name");
        $rows->execute([self::ARCHIVED]);
        $media = $rows->fetchAll(PDO::FETCH_ASSOC);
        $entry = static fn (array $row): array => ['public_id' => $row['public_id'], 'name' => $row['media_name'], 'detail' => trim(implode(' · ', array_filter([$row['city'], $row['status'], (int) $row['videos_count'] > 0 ? ((int) $row['videos_count'] === 1 ? '1 video' : (int) $row['videos_count'] . ' videos') : ''])))];
        $group = static function (callable $test) use ($media, $entry): array {
            $items = [];
            foreach ($media as $row) if ($test($row)) $items[] = $entry($row);
            return $items;
        };
        $videos = $this->pdo->prepare("SELECT p.public_id, p.media_name, p.city, v.url, v.views_count, v.created_at FROM media_videos v JOIN media_profiles p ON p.id = v.profile_id WHERE p.status <> ? ORDER BY v.created_at DESC, v.id DESC LIMIT 300");
        $videos->execute([self::ARCHIVED]);
        $videoItems = array_map(static fn (array $row): array => ['public_id' => $row['public_id'], 'name' => $row['media_name'], 'detail' => trim(implode(' · ', array_filter([(string) $row['city'], (int) $row['views_count'] > 0 ? (int) $row['views_count'] . ' views' : '']))), 'url' => (string) $row['url']], $videos->fetchAll(PDO::FETCH_ASSOC));
        return [
            'cards' => [
                ['key' => 'medios_aprobados', 'label' => 'Medios aprobados', 'items' => $group(static fn (array $row): bool => $row['status'] === 'Aprobado')],
                ['key' => 'medios_total', 'label' => 'Medios registrados', 'items' => $group(static fn (): bool => true)],
                ['key' => 'medios_pautados', 'label' => 'Medios pautados', 'items' => $group(static fn (array $row): bool => $row['paid_media'] === 'yes')],
                ['key' => 'medios_videos', 'label' => 'Videos recibidos', 'items' => $videoItems],
                ['key' => 'medios_sin_cuenta', 'label' => 'Sin cuenta vinculada', 'items' => $group(static fn (array $row): bool => $row['account_id'] === null)],
            ],
            'events' => array_map(fn (array $event): array => $this->eventPanel($event), $this->listEvents()),
        ];
    }

    /** One event with its buckets already resolved into names, ready for the panel cards. */
    private function eventPanel(array $event): array
    {
        $coverage = $this->coverageForEvent($event['public_id']);
        $names = [];
        foreach ($coverage['items'] as $item) $names[$item['public_id']] = ['public_id' => $item['public_id'], 'name' => $item['media_name'], 'detail' => trim(implode(' · ', array_filter([$item['city'], $item['contracted'] === 'yes' ? 'Pautado' : ($item['contracted'] === 'no' ? 'Sin contrato' : ''), self::COVERAGE_RESULTS[$item['result']] ?? ''])))];
        $cards = [];
        foreach (['pautados_publicaron', 'pautados_sin_publicacion', 'sin_contrato_publicaron', 'sin_contrato_sin_publicacion', 'no_asistieron', 'confirmaron', 'asistieron'] as $key) {
            $bucket = $coverage['summary'][$key] ?? null;
            if ($bucket === null) continue;
            $cards[] = ['key' => $key, 'label' => $bucket['label'], 'items' => array_values(array_filter(array_map(static fn (string $id): ?array => $names[$id] ?? null, $bucket['ids'])))];
        }
        return ['public_id' => $event['public_id'], 'name' => $event['name'], 'event_date' => $event['event_date'], 'place' => $event['place'], 'coverage_count' => $event['coverage_count'], 'cards' => $cards];
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

    private static function paid(array $row): string
    {
        return in_array($row['paid_media'] ?? null, self::PAID_MEDIA, true) ? $row['paid_media'] : 'no';
    }

    private static function origin(array $row): string
    {
        return in_array($row['origin'] ?? null, self::ORIGINS, true) ? $row['origin'] : 'cuenta';
    }

    private static function representativesOf(array $row): array
    {
        $list = json_decode((string) ($row['representatives'] ?? '') ?: '[]', true, 8);
        return is_array($list) ? array_values(array_filter($list, static fn (mixed $entry): bool => is_array($entry) && is_string($entry['name'] ?? null))) : [];
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
        $account->execute([$row['account_id'] ?? 0]);
        $owner = $account->fetch();
        $claim = null;
        if ($row['claim_account_id'] !== null) {
            $claimant = $this->pdo->prepare('SELECT email_enc FROM media_accounts WHERE id = ?');
            $claimant->execute([$row['claim_account_id']]);
            $claimRow = $claimant->fetch();
            $claim = ['email' => $claimRow ? $this->crypto->decrypt($claimRow['email_enc']) : '', 'requested_at' => $row['claim_requested_at']];
        }
        return [
            ...$this->present($row),
            // Internal commercial flag: only the administrative projection carries it.
            'paid_media' => self::paid($row),
            'account_email' => $owner ? $this->crypto->decrypt($owner['email_enc']) : '',
            'account_active' => $owner ? (int) $owner['active'] === 1 : false,
            'last_login_at' => $owner['last_login_at'] ?? null,
            'claim' => $claim,
            'invitation_allowed' => $row['account_id'] === null && $claim === null,
            'coverage' => $this->coverageForProfile((int) $row['id']),
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
            // The photo of the responsible person is mandatory: no approval without it.
            if ($status === 'Aprobado' && !$this->photoMeta((int) $row['id'])['available']) throw new InvalidArgumentException();
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

    public function changePaidMedia(string $publicId, string $paid, int $actorId, string $ip = ''): void
    {
        if (!in_array($paid, self::PAID_MEDIA, true)) throw new InvalidArgumentException();
        $this->mutate($publicId, function (array $row) use ($paid, $actorId, $ip, $publicId): void {
            if (self::paid($row) === $paid) return;
            $this->pdo->prepare('UPDATE media_profiles SET paid_media = ?, updated_at = ? WHERE id = ?')->execute([$paid, gmdate('Y-m-d H:i:s'), $row['id']]);
            $this->audit->log('media.paid_media_changed', $actorId, 'media_profile', $publicId, [], $ip);
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
            if ($row['account_id'] !== null) $this->pdo->prepare('UPDATE media_accounts SET active = 0, updated_at = ? WHERE id = ?')->execute([$now, $row['account_id']]);
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

    // ---------------------------------------------------------------- coordination-created records

    /** Coordination creates a record for a medium that has no account (yet); it may be linked to an account later. */
    public function createByAdmin(array $input, int $actorId, string $ip = ''): array
    {
        $record = $this->validateAdmin($input);
        $now = gmdate('Y-m-d H:i:s');
        $this->begin();
        try {
            $this->assertNameAvailable($record['media_name'], null);
            $publicId = bin2hex(random_bytes(16));
            $legacy = self::LEGACY_PLAIN;
            foreach (self::LEGACY_ENCRYPTED as $column) $legacy[$column] = $this->crypto->encrypt('');
            $values = ['public_id' => $publicId, 'account_id' => null, 'status' => 'Nuevo', 'origin' => 'coordinacion', ...$legacy, ...$record['columns'],
                'conditions_version' => 'coordinacion', 'conditions_hash' => hash('sha256', ''), 'conditions_accepted_at' => $now, 'submitted_at' => $now, 'updated_at' => $now];
            $columns = array_keys($values);
            $this->pdo->prepare('INSERT INTO media_profiles (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')')->execute(array_values($values));
            $this->audit->log('media.profile_created_by_admin', $actorId, 'media_profile', $publicId, [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
        return $this->find($publicId) ?? throw new RuntimeException();
    }

    /** Coordination completes or corrects a record, whatever its origin. */
    public function updateByAdmin(string $publicId, array $input, int $actorId, string $ip = ''): void
    {
        $record = $this->validateAdmin($input);
        $this->mutate($publicId, function (array $row) use ($record, $actorId, $ip, $publicId): void {
            $this->assertNameAvailable($record['media_name'], (int) $row['id']);
            $values = [...$record['columns'], 'updated_at' => gmdate('Y-m-d H:i:s')];
            $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($values)));
            $this->pdo->prepare('UPDATE media_profiles SET ' . $assignments . ' WHERE id = ?')->execute([...array_values($values), $row['id']]);
            $this->audit->log('media.profile_updated_by_admin', $actorId, 'media_profile', $publicId, [], $ip);
        });
    }

    /** Two active records may not share a name: this is how duplicates are avoided when coordination loads lists. */
    private function assertNameAvailable(string $name, ?int $exceptId): void
    {
        $query = $this->pdo->prepare('SELECT id FROM media_profiles WHERE LOWER(media_name) = LOWER(?) AND status <> ?' . ($exceptId === null ? '' : ' AND id <> ?'));
        $query->execute($exceptId === null ? [$name, self::ARCHIVED] : [$name, self::ARCHIVED, $exceptId]);
        if ($query->fetchColumn() !== false) throw new DuplicateRegistration();
    }

    /** Lenient validation for coordination: only the name and at least one media type are mandatory. */
    private function validateAdmin(array $input): array
    {
        if (array_diff(array_keys($input), self::ADMIN_FIELDS) !== [] || array_diff(self::ADMIN_FIELDS, array_keys($input)) !== []) throw new InvalidArgumentException();
        $text = static function (mixed $value, int $max, int $min = 0): string {
            if (!is_string($value)) throw new InvalidArgumentException();
            $value = trim(preg_replace('/\s+/u', ' ', preg_replace('/\p{C}+/u', ' ', $value) ?? '') ?? '');
            if (self::length($value) < $min || self::length($value) > $max) throw new InvalidArgumentException();
            return $value;
        };
        $types = $input['media_types'];
        if (!is_array($types) || $types === [] || !array_is_list($types) || count($types) !== count(array_unique($types, SORT_REGULAR))) throw new InvalidArgumentException();
        foreach ($types as $type) if (!is_string($type) || !isset(self::MEDIA_TYPES[$type])) throw new InvalidArgumentException();
        $types = array_values(array_intersect(array_keys(self::MEDIA_TYPES), $types));
        $name = $text($input['media_name'], 140, 2);
        // Una frecuencia o canal por línea: hay medios con varias señales.
        $lines = static function (mixed $value, int $max, int $limit) use ($text): array {
            if (!is_string($value)) throw new InvalidArgumentException();
            $items = [];
            foreach (preg_split('/\R/u', $value) ?: [] as $line) {
                $line = $text($line, $max);
                if ($line !== '' && !in_array($line, $items, true)) $items[] = $line;
            }
            if (count($items) > $limit) throw new InvalidArgumentException();
            return $items;
        };
        $frequencies = $lines($input['frequency'], 120, self::MAX_STATIONS);
        $tvChannels = $lines($input['tv_channel'], 120, self::MAX_TV_CHANNELS);
        $province = $text($input['province'], 60);
        if ($province !== '' && !in_array($province, self::PROVINCES, true)) throw new InvalidArgumentException();
        $representatives = [];
        if (!is_array($input['representatives']) || !array_is_list($input['representatives']) || count($input['representatives']) > self::MAX_REPRESENTATIVES) throw new InvalidArgumentException();
        foreach ($input['representatives'] as $entry) {
            if ($entry instanceof \stdClass) $entry = (array) $entry;
            if (!is_array($entry) || array_diff(array_keys($entry), ['name', 'role']) !== []) throw new InvalidArgumentException();
            $representatives[] = ['name' => $text($entry['name'] ?? '', 160, 2), 'role' => $text($entry['role'] ?? '', 120)];
        }
        $channels = []; $seen = [];
        if (!is_array($input['channels']) || !array_is_list($input['channels']) || count($input['channels']) > self::MAX_CHANNELS) throw new InvalidArgumentException();
        foreach ($input['channels'] as $channel) {
            if ($channel instanceof \stdClass) $channel = (array) $channel;
            if (!is_array($channel) || array_diff(array_keys($channel), ['type', 'url', 'followers']) !== [] || !is_string($channel['type'] ?? null) || !isset(self::CHANNEL_TYPES[$channel['type']])) throw new InvalidArgumentException();
            $followers = $channel['followers'] ?? null;
            if ($followers !== null && (!is_int($followers) || $followers < 0 || $followers > 1000000000 || $channel['type'] === 'website')) throw new InvalidArgumentException();
            $url = self::link($channel['url'] ?? null, 300);
            if (isset($seen[strtolower($url)])) throw new InvalidArgumentException();
            $seen[strtolower($url)] = true;
            $channels[] = ['type' => $channel['type'], 'url' => $url, 'followers' => $followers];
        }
        $validated = $input['followers_validated'];
        if ($validated !== null && (!is_int($validated) || $validated < 0 || $validated > 1000000000)) throw new InvalidArgumentException();
        $audience = $input['audience_count'];
        if ($audience !== null && (!is_int($audience) || $audience < 0 || $audience > 100000000)) throw new InvalidArgumentException();
        $genre = $text($input['radio_genre'], 60);
        if ($genre !== '' && !in_array($genre, self::RADIO_GENRES, true)) throw new InvalidArgumentException();
        if (!is_string($input['paid_media']) || !in_array($input['paid_media'], self::PAID_MEDIA, true)) throw new InvalidArgumentException();
        $phone = $text($input['phone'], 25);
        if ($phone !== '' && preg_match('/^\+?[0-9][0-9 ()-]{6,23}$/D', $phone) !== 1) throw new InvalidArgumentException();
        $email = strtolower($text($input['contact_email'], 180));
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) throw new InvalidArgumentException();
        $stations = array_map(static fn (string $frequency): array => ['name' => $name, 'frequency' => $frequency], in_array('radio', $types, true) ? $frequencies : []);
        $tvChannels = in_array('tv', $types, true) ? $tvChannels : [];
        $columns = [
            'media_name' => $name, 'media_types' => ',' . implode(',', $types) . ',', 'radio_stations' => json_encode($stations, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'tv_channel' => $tvChannels[0] ?? '', 'tv_channels' => json_encode($tvChannels, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'audience_count' => $audience, 'radio_genre' => $genre,
            'frequency_channel' => substr(implode(' · ', [...$stations ? array_column($stations, 'frequency') : [], ...$tvChannels]), 0, 120),
            'province' => $province, 'city' => $text($input['city'], 100), 'program_name' => $text($input['program_name'], 160),
            'representatives' => json_encode($representatives, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'channels' => json_encode($channels, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'social_link' => $channels[0]['url'] ?? '', 'followers_validated' => $validated, 'paid_media' => $input['paid_media'],
            'contact_name_enc' => $this->crypto->encrypt($text($input['contact_name'], 160)), 'phone_enc' => $this->crypto->encrypt($phone), 'contact_email_enc' => $this->crypto->encrypt($email),
        ];
        foreach (array_unique(self::CHANNEL_COLUMNS) as $column) $columns[$column] = '';
        foreach ($channels as $channel) { $column = self::CHANNEL_COLUMNS[$channel['type']]; if ($columns[$column] === '') $columns[$column] = $channel['url']; }
        return ['media_name' => $name, 'columns' => $columns];
    }

    // ---------------------------------------------------------------- linking an account to a coordination record

    /** Unlinked coordination records whose name resembles what a medium is typing; a minimal projection for the portal. */
    public function lookupUnlinked(mixed $name): array
    {
        if (!is_string($name)) throw new InvalidArgumentException();
        $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
        if (self::length($name) < 3 || self::length($name) > 140) return [];
        $like = '%' . addcslashes($name, '\\%_') . '%';
        $query = $this->pdo->prepare("SELECT public_id, media_name, city, media_types FROM media_profiles WHERE origin = 'coordinacion' AND account_id IS NULL AND claim_account_id IS NULL AND status <> ? AND media_name LIKE ? ESCAPE '\\' ORDER BY media_name LIMIT 8");
        $query->execute([self::ARCHIVED, $like]);
        return array_map(static fn (array $row): array => ['public_id' => $row['public_id'], 'media_name' => $row['media_name'], 'city' => $row['city'], 'media_types' => self::typeKeys((string) $row['media_types'])], $query->fetchAll(PDO::FETCH_ASSOC));
    }

    /** A medium asks to take over a record coordination loaded for it; coordination confirms before any data is exposed. */
    public function requestClaim(int $accountId, string $publicId, string $ip): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $this->begin();
        try {
            $own = $this->pdo->prepare('SELECT 1 FROM media_profiles WHERE account_id = ? OR claim_account_id = ?');
            $own->execute([$accountId, $accountId]);
            if ($own->fetchColumn() !== false) throw new Forbidden();
            $statement = $this->pdo->prepare("SELECT id FROM media_profiles WHERE public_id = ? AND origin = 'coordinacion' AND account_id IS NULL AND claim_account_id IS NULL AND status <> ?" . $this->rowLock());
            $statement->execute([$publicId, self::ARCHIVED]);
            $id = $statement->fetchColumn();
            if ($id === false) throw new OutOfBoundsException();
            $now = gmdate('Y-m-d H:i:s');
            $this->pdo->prepare('UPDATE media_profiles SET claim_account_id = ?, claim_requested_at = ?, updated_at = ? WHERE id = ?')->execute([$accountId, $now, $now, $id]);
            $this->audit->log('media.claim_requested', null, 'media_profile', $publicId, [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
        return $this->claimForAccount($accountId) ?? throw new RuntimeException();
    }

    public function claimForAccount(int $accountId): ?array
    {
        $query = $this->pdo->prepare('SELECT public_id, media_name, city, claim_requested_at FROM media_profiles WHERE claim_account_id = ? AND account_id IS NULL AND status <> ?');
        $query->execute([$accountId, self::ARCHIVED]);
        $row = $query->fetch();
        return $row === false ? null : ['public_id' => $row['public_id'], 'media_name' => $row['media_name'], 'city' => $row['city'], 'requested_at' => $row['claim_requested_at']];
    }

    public function pendingClaims(): array
    {
        $rows = $this->pdo->prepare('SELECT p.public_id, p.media_name, p.city, p.claim_requested_at, a.email_enc FROM media_profiles p JOIN media_accounts a ON a.id = p.claim_account_id WHERE p.account_id IS NULL AND p.status <> ? ORDER BY p.claim_requested_at DESC, p.id DESC LIMIT 200');
        $rows->execute([self::ARCHIVED]);
        return array_map(fn (array $row): array => ['public_id' => $row['public_id'], 'media_name' => $row['media_name'], 'city' => $row['city'], 'requested_at' => $row['claim_requested_at'], 'email' => $this->crypto->decrypt($row['email_enc'])], $rows->fetchAll(PDO::FETCH_ASSOC));
    }

    public function resolveClaim(string $publicId, bool $approve, int $actorId, string $ip = ''): void
    {
        $this->mutate($publicId, function (array $row) use ($approve, $actorId, $ip, $publicId): void {
            if ($row['claim_account_id'] === null || $row['account_id'] !== null) throw new OutOfBoundsException();
            $now = gmdate('Y-m-d H:i:s');
            if ($approve) {
                $taken = $this->pdo->prepare('SELECT 1 FROM media_profiles WHERE account_id = ?');
                $taken->execute([$row['claim_account_id']]);
                if ($taken->fetchColumn() !== false) throw new DuplicateRegistration();
                $this->pdo->prepare('UPDATE media_profiles SET account_id = ?, claim_account_id = NULL, claim_requested_at = NULL, updated_at = ? WHERE id = ?')->execute([$row['claim_account_id'], $now, $row['id']]);
            } else {
                $this->pdo->prepare('UPDATE media_profiles SET claim_account_id = NULL, claim_requested_at = NULL, updated_at = ? WHERE id = ?')->execute([$now, $row['id']]);
            }
            $this->audit->log($approve ? 'media.claim_approved' : 'media.claim_rejected', $actorId, 'media_profile', $publicId, [], $ip);
        });
    }

    /** Coordination hands the medium a link that creates its account already linked to the record; one use, seven days. */
    public function createInvitation(string $publicId, int $actorId, string $ip = ''): string
    {
        $raw = bin2hex(random_bytes(32));
        $this->mutate($publicId, function (array $row) use ($raw, $actorId, $ip, $publicId): void {
            if ($row['account_id'] !== null || $row['claim_account_id'] !== null) throw new Forbidden();
            $now = time();
            $this->pdo->prepare('UPDATE media_invitations SET consumed_at = ? WHERE profile_id = ? AND consumed_at IS NULL')->execute([gmdate('Y-m-d H:i:s', $now), $row['id']]);
            $this->pdo->prepare('INSERT INTO media_invitations (profile_id, token_hash, expires_at, created_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?)')
                ->execute([$row['id'], hash('sha256', $raw), gmdate('Y-m-d H:i:s', $now + self::INVITATION_TTL), $actorId, gmdate('Y-m-d H:i:s', $now)]);
            $this->audit->log('media.invitation_created', $actorId, 'media_profile', $publicId, [], $ip);
        });
        return $raw;
    }

    /** Public preview for the access page: which record the invitation opens, or null when invalid. */
    public function invitationPreview(mixed $token): ?array
    {
        if (!is_string($token) || preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) return null;
        $query = $this->pdo->prepare('SELECT p.public_id, p.media_name FROM media_invitations i JOIN media_profiles p ON p.id = i.profile_id WHERE i.token_hash = ? AND i.consumed_at IS NULL AND i.expires_at > ? AND p.account_id IS NULL AND p.status <> ?');
        $query->execute([hash('sha256', $token), gmdate('Y-m-d H:i:s'), self::ARCHIVED]);
        $row = $query->fetch();
        return $row === false ? null : ['public_id' => $row['public_id'], 'media_name' => $row['media_name']];
    }

    /** Called right after registration: links the freshly created account to the invited record. */
    public function consumeInvitation(string $token, string $email, string $ip): void
    {
        if (preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) throw new InvalidArgumentException();
        $this->begin();
        try {
            $query = $this->pdo->prepare('SELECT i.id AS invitation_id, p.id, p.public_id FROM media_invitations i JOIN media_profiles p ON p.id = i.profile_id WHERE i.token_hash = ? AND i.consumed_at IS NULL AND i.expires_at > ? AND p.account_id IS NULL AND p.status <> ?' . $this->rowLock());
            $query->execute([hash('sha256', $token), gmdate('Y-m-d H:i:s'), self::ARCHIVED]);
            $invitation = $query->fetch();
            if ($invitation === false) throw new OutOfBoundsException();
            $account = $this->pdo->prepare('SELECT id FROM media_accounts WHERE email_idx = ? AND active = 1');
            $account->execute([$this->crypto->lookup(strtolower(trim($email)))]);
            $accountId = $account->fetchColumn();
            if ($accountId === false) throw new OutOfBoundsException();
            $taken = $this->pdo->prepare('SELECT 1 FROM media_profiles WHERE account_id = ?');
            $taken->execute([$accountId]);
            if ($taken->fetchColumn() !== false) throw new DuplicateRegistration();
            $now = gmdate('Y-m-d H:i:s');
            $this->pdo->prepare('UPDATE media_profiles SET account_id = ?, claim_account_id = NULL, claim_requested_at = NULL, updated_at = ? WHERE id = ?')->execute([$accountId, $now, $invitation['id']]);
            $this->pdo->prepare('UPDATE media_invitations SET consumed_at = ? WHERE id = ?')->execute([$now, $invitation['invitation_id']]);
            $this->audit->log('media.invitation_consumed', null, 'media_profile', $invitation['public_id'], [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
    }

    // ---------------------------------------------------------------- coverage events

    public function listEvents(): array
    {
        $rows = $this->pdo->query("SELECT e.public_id, e.name, e.event_date, e.place, e.details, e.created_at, (SELECT COUNT(*) FROM media_event_coverage c JOIN media_profiles p ON p.id = c.profile_id WHERE c.event_id = e.id AND p.status <> 'Eliminado') AS coverage_count, (SELECT COUNT(*) FROM media_event_coverage c JOIN media_profiles p ON p.id = c.profile_id WHERE c.event_id = e.id AND p.status <> 'Eliminado' AND c.confirmation = 'yes') AS confirmed_count, (SELECT COUNT(*) FROM media_event_coverage c JOIN media_profiles p ON p.id = c.profile_id WHERE c.event_id = e.id AND p.status <> 'Eliminado' AND c.checked_in_at IS NOT NULL) AS checked_in_count FROM media_events e ORDER BY e.event_date DESC, e.id DESC");
        return array_map(static fn (array $row): array => ['public_id' => $row['public_id'], 'name' => $row['name'], 'event_date' => $row['event_date'], 'place' => (string) $row['place'], 'details' => (string) $row['details'],
            'created_at' => $row['created_at'], 'coverage_count' => (int) $row['coverage_count'], 'confirmed_count' => (int) $row['confirmed_count'], 'checked_in_count' => (int) $row['checked_in_count']], $rows->fetchAll(PDO::FETCH_ASSOC));
    }

    public function createEvent(mixed $input, ?int $actorId, string $ip = ''): array
    {
        if ($input instanceof \stdClass) $input = (array) $input;
        if (!is_array($input) || array_diff(array_keys($input), ['name', 'event_date', 'place', 'details']) !== [] || !is_string($input['name'] ?? null)) throw new InvalidArgumentException();
        $name = trim(preg_replace('/\s+/u', ' ', $input['name']) ?? '');
        if (self::length($name) < 3 || self::length($name) > 160) throw new InvalidArgumentException();
        $text = static function (mixed $value, int $max): string {
            if ($value === null) return '';
            if (!is_string($value)) throw new InvalidArgumentException();
            $value = trim(preg_replace('/\s+/u', ' ', preg_replace('/\p{C}+/u', ' ', $value) ?? '') ?? '');
            if (self::length($value) > $max) throw new InvalidArgumentException();
            return $value;
        };
        $place = $text($input['place'] ?? '', 160);
        $details = $text($input['details'] ?? '', 500);
        $date = $input['event_date'] ?? null;
        if ($date === '') $date = null;
        if ($date !== null && (!is_string($date) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $parts) !== 1 || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]))) throw new InvalidArgumentException();
        $existing = $this->pdo->prepare('SELECT public_id FROM media_events WHERE LOWER(name) = LOWER(?)');
        $existing->execute([$name]);
        if ($existing->fetchColumn() !== false) throw new DuplicateRegistration();
        $publicId = bin2hex(random_bytes(16));
        $now = gmdate('Y-m-d H:i:s');
        $this->begin();
        try {
            $this->pdo->prepare('INSERT INTO media_events (public_id, name, event_date, place, details, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$publicId, $name, $date, $place, $details, $actorId, $now, $now]);
            $eventId = (int) $this->pdo->lastInsertId();
            // Every active medium is invited at once: those with an account see it in their portal and
            // confirm; the rest are marked by coordination. Contract is pre-filled from the record.
            $invited = $this->pdo->prepare("INSERT INTO media_event_coverage (event_id, profile_id, contracted, result, people_count, links, note, updated_at) SELECT ?, id, CASE WHEN paid_media = 'yes' THEN 'yes' ELSE NULL END, 'pendiente', 0, '[]', '', ? FROM media_profiles WHERE status <> ?");
            $invited->execute([$eventId, $now, self::ARCHIVED]);
            $count = $invited->rowCount();
            $this->audit->log('media_event.created', $actorId, 'media_event', $publicId, ['count' => $count], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
        return ['public_id' => $publicId, 'name' => $name, 'event_date' => $date, 'place' => $place, 'details' => $details, 'created_at' => $now, 'coverage_count' => $count];
    }

    private function eventRow(string $publicId): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new InvalidArgumentException();
        $query = $this->pdo->prepare('SELECT id, public_id, name, event_date, place, details FROM media_events WHERE public_id = ?');
        $query->execute([$publicId]);
        $row = $query->fetch();
        if ($row === false) throw new OutOfBoundsException();
        return $row;
    }

    /**
     * Public data of one event, for the accreditation page reached from its link or QR. The
     * identifier is already random, and nothing here names a medium.
     */
    public function publicEvent(mixed $publicId): ?array
    {
        if (!is_string($publicId) || preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) return null;
        $query = $this->pdo->prepare('SELECT public_id, name, event_date, place, details FROM media_events WHERE public_id = ?');
        $query->execute([$publicId]);
        $row = $query->fetch();
        return $row === false ? null : ['public_id' => $row['public_id'], 'name' => $row['name'], 'event_date' => $row['event_date'], 'place' => (string) $row['place'], 'details' => (string) $row['details']];
    }

    /** The medium registers its arrival on the day of the event; this is what marks attendance. */
    public function checkIn(int $accountId, string $eventPublicId, string $ip): array
    {
        $event = $this->eventRow($eventPublicId);
        $this->begin();
        try {
            $profile = $this->pdo->prepare('SELECT id, public_id FROM media_profiles WHERE account_id = ? AND status <> ?' . $this->rowLock());
            $profile->execute([$accountId, self::ARCHIVED]);
            $row = $profile->fetch();
            if ($row === false) throw new Forbidden();
            $now = gmdate('Y-m-d H:i:s');
            $update = $this->pdo->prepare('UPDATE media_event_coverage SET attended = ?, checked_in_at = COALESCE(checked_in_at, ?), confirmation = COALESCE(confirmation, ?), confirmed_at = COALESCE(confirmed_at, ?), updated_at = ? WHERE event_id = ? AND profile_id = ?');
            $update->execute(['yes', $now, 'yes', $now, $now, $event['id'], $row['id']]);
            if ($update->rowCount() === 0) {
                // A medium registered after the event was created also joins when it arrives.
                $this->pdo->prepare("INSERT INTO media_event_coverage (event_id, profile_id, contracted, result, people_count, links, note, confirmation, confirmed_at, attended, checked_in_at, updated_at) VALUES (?, ?, NULL, 'pendiente', 0, '[]', '', ?, ?, ?, ?, ?)")
                    ->execute([$event['id'], $row['id'], 'yes', $now, 'yes', $now, $now]);
            }
            $this->audit->log('media.checked_in', null, 'media_profile', $row['public_id'], [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
        return $this->invitationsForAccount($accountId);
    }

    /** Every medium covering one event, with the counts the big numbers show. */
    public function coverageForEvent(string $eventPublicId): array
    {
        $event = $this->eventRow($eventPublicId);
        $rows = $this->pdo->prepare('SELECT p.public_id, p.media_name, p.media_types, p.frequency_channel, p.city, p.origin, p.account_id, p.paid_media, p.followers_validated, c.contracted, c.result, c.people_count, c.links, c.note, c.confirmation, c.confirmed_at, c.attended, c.checked_in_at, c.updated_at FROM media_event_coverage c JOIN media_profiles p ON p.id = c.profile_id WHERE c.event_id = ? AND p.status <> ? ORDER BY p.media_name');
        $rows->execute([$event['id'], self::ARCHIVED]);
        $items = array_map(static fn (array $row): array => [
            'public_id' => $row['public_id'], 'media_name' => $row['media_name'], 'media_types' => self::typeKeys((string) $row['media_types']), 'frequency_channel' => $row['frequency_channel'], 'city' => $row['city'],
            'origin' => self::origin($row), 'linked' => $row['account_id'] !== null, 'paid_media' => self::paid($row), 'followers_validated' => $row['followers_validated'] === null ? null : (int) $row['followers_validated'],
            'contracted' => in_array($row['contracted'], self::PAID_MEDIA, true) ? $row['contracted'] : null, 'result' => isset(self::COVERAGE_RESULTS[$row['result']]) ? $row['result'] : 'pendiente',
            'people_count' => (int) $row['people_count'], 'links' => json_decode((string) ($row['links'] ?? '') ?: '[]', true, 4) ?: [], 'note' => (string) ($row['note'] ?? ''),
            'confirmation' => in_array($row['confirmation'], self::ATTENDANCE, true) ? $row['confirmation'] : null, 'confirmed_at' => $row['confirmed_at'],
            'attended' => in_array($row['attended'], self::ATTENDANCE, true) ? $row['attended'] : null, 'checked_in_at' => $row['checked_in_at'], 'updated_at' => $row['updated_at'],
        ], $rows->fetchAll(PDO::FETCH_ASSOC));
        return ['event' => ['public_id' => $event['public_id'], 'name' => $event['name'], 'event_date' => $event['event_date'], 'place' => (string) $event['place'], 'details' => (string) $event['details']],
            'summary' => self::coverageSummary($items), 'items' => $items];
    }

    /** Big-number buckets: contract × outcome. Each bucket lists the public ids it contains so the panel can filter on click. */
    public static function coverageSummary(array $items): array
    {
        $bucket = static fn (callable $test): array => array_values(array_map(static fn (array $item): string => $item['public_id'], array_filter($items, $test)));
        $published = static fn (array $item): bool => in_array($item['result'], self::COVERAGE_PUBLISHED, true);
        $paid = static fn (array $item): bool => $item['contracted'] === 'yes';
        return [
            'todos' => ['label' => 'Todos', 'ids' => $bucket(static fn (): bool => true)],
            'pautados' => ['label' => 'Pautados', 'ids' => $bucket($paid)],
            'pautados_publicaron' => ['label' => 'Pautados que publicaron', 'ids' => $bucket(static fn (array $item): bool => $paid($item) && $published($item))],
            'pautados_sin_publicacion' => ['label' => 'Pautados sin publicación', 'ids' => $bucket(static fn (array $item): bool => $paid($item) && !$published($item))],
            'sin_contrato_publicaron' => ['label' => 'Sin contrato que publicaron', 'ids' => $bucket(static fn (array $item): bool => !$paid($item) && $published($item))],
            'sin_contrato_sin_publicacion' => ['label' => 'Sin contrato sin publicación', 'ids' => $bucket(static fn (array $item): bool => !$paid($item) && !$published($item))],
            // La asistencia se marca con un check, así que «asistieron» y «no asistieron» suman el total.
            'asistieron' => ['label' => 'Asistieron', 'ids' => $bucket(static fn (array $item): bool => $item['attended'] === 'yes')],
            'registrados' => ['label' => 'Se registraron con el QR', 'ids' => $bucket(static fn (array $item): bool => ($item['checked_in_at'] ?? null) !== null)],
            'no_asistieron' => ['label' => 'No asistieron', 'ids' => $bucket(static fn (array $item): bool => $item['attended'] !== 'yes')],
            'confirmaron' => ['label' => 'Confirmaron asistencia', 'ids' => $bucket(static fn (array $item): bool => $item['confirmation'] === 'yes')],
            'no_confirmaron' => ['label' => 'Sin respuesta', 'ids' => $bucket(static fn (array $item): bool => $item['confirmation'] === null)],
        ];
    }

    /** Coordination records or updates how one medium covered one event. */
    public function upsertCoverage(string $eventPublicId, string $profilePublicId, mixed $input, int $actorId, string $ip = ''): void
    {
        if ($input instanceof \stdClass) $input = (array) $input;
        $fields = ['contracted', 'result', 'people_count', 'links', 'note', 'attended', 'confirmation'];
        if (!is_array($input) || array_diff(array_keys($input), $fields) !== [] || array_diff(['contracted', 'result', 'people_count', 'links', 'note'], array_keys($input)) !== []) throw new InvalidArgumentException();
        $contracted = $input['contracted'];
        if ($contracted !== null && (!is_string($contracted) || !in_array($contracted, self::PAID_MEDIA, true))) throw new InvalidArgumentException();
        $attended = $input['attended'] ?? null;
        if ($attended === '') $attended = null;
        if ($attended !== null && (!is_string($attended) || !in_array($attended, self::ATTENDANCE, true))) throw new InvalidArgumentException();
        // Coordination may register the answer a medium gave by phone or in person; the portal writes the same column.
        $hasConfirmation = array_key_exists('confirmation', $input);
        $confirmation = $input['confirmation'] ?? null;
        if ($confirmation === '') $confirmation = null;
        if ($confirmation !== null && (!is_string($confirmation) || !in_array($confirmation, self::ATTENDANCE, true))) throw new InvalidArgumentException();
        if (!is_string($input['result']) || !isset(self::COVERAGE_RESULTS[$input['result']])) throw new InvalidArgumentException();
        $people = filter_var($input['people_count'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 200]]);
        if ($people === false) throw new InvalidArgumentException();
        if (!is_array($input['links']) || !array_is_list($input['links']) || count($input['links']) > self::MAX_COVERAGE_LINKS) throw new InvalidArgumentException();
        $links = [];
        foreach ($input['links'] as $link) { $url = self::link($link, 500); if (!in_array($url, $links, true)) $links[] = $url; }
        if (!is_string($input['note'])) throw new InvalidArgumentException();
        $note = trim(preg_replace('/\p{C}+/u', ' ', $input['note']) ?? '');
        if (self::length($note) > 2000) throw new InvalidArgumentException();
        $event = $this->eventRow($eventPublicId);
        $this->mutate($profilePublicId, function (array $row) use ($event, $contracted, $input, $people, $links, $note, $attended, $hasConfirmation, $confirmation, $actorId, $ip, $profilePublicId): void {
            $now = gmdate('Y-m-d H:i:s');
            $json = json_encode($links, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
            $sql = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
                ? 'INSERT INTO media_event_coverage (event_id, profile_id, contracted, result, people_count, links, note, attended, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE contracted = VALUES(contracted), result = VALUES(result), people_count = VALUES(people_count), links = VALUES(links), note = VALUES(note), attended = VALUES(attended), updated_at = VALUES(updated_at)'
                : 'INSERT INTO media_event_coverage (event_id, profile_id, contracted, result, people_count, links, note, attended, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_id, profile_id) DO UPDATE SET contracted = excluded.contracted, result = excluded.result, people_count = excluded.people_count, links = excluded.links, note = excluded.note, attended = excluded.attended, updated_at = excluded.updated_at';
            $this->pdo->prepare($sql)->execute([$event['id'], $row['id'], $contracted, $input['result'], $people, $json, $note, $attended, $now]);
            if ($hasConfirmation) {
                $this->pdo->prepare('UPDATE media_event_coverage SET confirmation = ?, confirmed_at = ? WHERE event_id = ? AND profile_id = ?')
                    ->execute([$confirmation, $confirmation === null ? null : $now, $event['id'], $row['id']]);
            }
            $this->audit->log('media.coverage_updated', $actorId, 'media_profile', $profilePublicId, [], $ip);
        });
    }

    /** Events the authenticated medium was invited to, with what it may answer. Administrative notes stay out. */
    public function invitationsForAccount(int $accountId): array
    {
        $profile = $this->pdo->prepare('SELECT id FROM media_profiles WHERE account_id = ? AND status <> ?');
        $profile->execute([$accountId, self::ARCHIVED]);
        $profileId = $profile->fetchColumn();
        if ($profileId === false) return [];
        $rows = $this->pdo->prepare('SELECT e.public_id, e.name, e.event_date, e.place, e.details, c.confirmation, c.confirmed_at, c.attended, c.checked_in_at FROM media_event_coverage c JOIN media_events e ON e.id = c.event_id WHERE c.profile_id = ? ORDER BY e.event_date DESC, e.id DESC LIMIT 50');
        $rows->execute([$profileId]);
        return array_map(static fn (array $row): array => ['public_id' => $row['public_id'], 'name' => $row['name'], 'event_date' => $row['event_date'], 'place' => (string) $row['place'], 'details' => (string) $row['details'],
            'confirmation' => in_array($row['confirmation'], self::ATTENDANCE, true) ? $row['confirmation'] : null, 'confirmed_at' => $row['confirmed_at'],
            'attended' => in_array($row['attended'], self::ATTENDANCE, true) ? $row['attended'] : null, 'checked_in_at' => $row['checked_in_at']], $rows->fetchAll(PDO::FETCH_ASSOC));
    }

    /** The medium answers its own invitation. It may change the answer; coordination records attendance separately. */
    public function confirmAttendance(int $accountId, string $eventPublicId, mixed $answer, string $ip): array
    {
        if (!is_string($answer) || !in_array($answer, self::ATTENDANCE, true)) throw new InvalidArgumentException();
        $event = $this->eventRow($eventPublicId);
        $this->begin();
        try {
            $profile = $this->pdo->prepare('SELECT id, public_id FROM media_profiles WHERE account_id = ? AND status <> ?' . $this->rowLock());
            $profile->execute([$accountId, self::ARCHIVED]);
            $row = $profile->fetch();
            if ($row === false) throw new Forbidden();
            $now = gmdate('Y-m-d H:i:s');
            $update = $this->pdo->prepare('UPDATE media_event_coverage SET confirmation = ?, confirmed_at = ?, updated_at = ? WHERE event_id = ? AND profile_id = ?');
            $update->execute([$answer, $now, $now, $event['id'], $row['id']]);
            if ($update->rowCount() === 0) {
                // The medium was registered after the event was created: it joins the invitation list now.
                $this->pdo->prepare("INSERT INTO media_event_coverage (event_id, profile_id, contracted, result, people_count, links, note, confirmation, confirmed_at, updated_at) VALUES (?, ?, NULL, 'pendiente', 0, '[]', '', ?, ?, ?)")
                    ->execute([$event['id'], $row['id'], $answer, $now, $now]);
            }
            $this->audit->log('media.attendance_confirmed', null, 'media_profile', $row['public_id'], [], $ip);
            $this->commit();
        } catch (Throwable $error) {
            $this->rollBack();
            throw $error;
        }
        return $this->invitationsForAccount($accountId);
    }

    private function coverageForProfile(int $profileId): array
    {
        $rows = $this->pdo->prepare('SELECT e.public_id, e.name, e.event_date, e.place, e.details, c.contracted, c.result, c.people_count, c.links, c.note, c.confirmation, c.confirmed_at, c.attended, c.checked_in_at, c.updated_at FROM media_event_coverage c JOIN media_events e ON e.id = c.event_id WHERE c.profile_id = ? ORDER BY e.event_date DESC, e.id DESC');
        $rows->execute([$profileId]);
        return array_map(static fn (array $row): array => ['event_public_id' => $row['public_id'], 'event_name' => $row['name'], 'event_date' => $row['event_date'], 'place' => (string) $row['place'], 'details' => (string) $row['details'], 'checked_in_at' => $row['checked_in_at'],
            'confirmation' => in_array($row['confirmation'], self::ATTENDANCE, true) ? $row['confirmation'] : null, 'confirmed_at' => $row['confirmed_at'],
            'attended' => in_array($row['attended'], self::ATTENDANCE, true) ? $row['attended'] : null,
            'contracted' => in_array($row['contracted'], self::PAID_MEDIA, true) ? $row['contracted'] : null, 'result' => isset(self::COVERAGE_RESULTS[$row['result']]) ? $row['result'] : 'pendiente', 'result_label' => self::COVERAGE_RESULTS[$row['result']] ?? 'Pendiente',
            'people_count' => (int) $row['people_count'], 'links' => json_decode((string) ($row['links'] ?? '') ?: '[]', true, 4) ?: [], 'note' => (string) ($row['note'] ?? ''), 'updated_at' => $row['updated_at']], $rows->fetchAll(PDO::FETCH_ASSOC));
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
            // Video links open only once administration approves the record, which in turn requires the responsible person's photo.
            if ($profile === false || $profile['status'] !== 'Aprobado' || !$this->photoMeta((int) $profile['id'])['available']) throw new Forbidden();
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

    /** Coordination reports a published video for any record, with or without an account. */
    public function addVideoByAdmin(string $publicId, mixed $url, int $actorId, string $ip = ''): void
    {
        $url = self::link($url, 500);
        $this->mutate($publicId, function (array $row) use ($url, $actorId, $ip, $publicId): void {
            $count = $this->pdo->prepare('SELECT COUNT(*) FROM media_videos WHERE profile_id = ?');
            $count->execute([$row['id']]);
            if ((int) $count->fetchColumn() >= self::MAX_VIDEOS) throw new InvalidArgumentException();
            $hash = hash('sha256', strtolower($url));
            $duplicate = $this->pdo->prepare('SELECT 1 FROM media_videos WHERE profile_id = ? AND url_hash = ?');
            $duplicate->execute([$row['id'], $hash]);
            if ($duplicate->fetchColumn() !== false) throw new DuplicateRegistration();
            $this->pdo->prepare('INSERT INTO media_videos (profile_id, url, url_hash, created_at) VALUES (?, ?, ?, ?)')
                ->execute([$row['id'], $url, $hash, gmdate('Y-m-d H:i:s')]);
            $this->audit->log('media.video_added_by_admin', $actorId, 'media_profile', $publicId, [], $ip);
        });
    }

    /** Removes one reported link. Used to undo a mistake; the medium's own links are evidence and stay. */
    public function removeVideoByAdmin(string $publicId, mixed $videoId, int $actorId, string $ip = ''): void
    {
        $videoId = filter_var($videoId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($videoId === false) throw new InvalidArgumentException();
        $this->mutate($publicId, function (array $row) use ($videoId, $actorId, $ip, $publicId): void {
            $delete = $this->pdo->prepare('DELETE FROM media_videos WHERE id = ? AND profile_id = ?');
            $delete->execute([$videoId, $row['id']]);
            if ($delete->rowCount() === 0) throw new OutOfBoundsException();
            $this->audit->log('media.video_removed_by_admin', $actorId, 'media_profile', $publicId, ['note_id' => $videoId], $ip);
        });
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
        $result['origin'] = self::origin($row);
        $result['linked'] = ($row['account_id'] ?? null) !== null;
        $result['program_name'] = (string) ($row['program_name'] ?? '');
        $result['representatives'] = self::representativesOf($row);
        $result['followers_validated'] = ($row['followers_validated'] ?? null) === null ? null : (int) $row['followers_validated'];
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
