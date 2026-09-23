<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/Crypto.php';
require_once __DIR__ . '/Audit.php';
require_once __DIR__ . '/VocerosRepository.php';

/**
 * Creadoras de contenido: coordinación arma la lista y el calendario de turnos, y cada creadora
 * puede vincular una cuenta para ver los suyos. Todo movimiento del calendario deja bitácora.
 */
final class CreadoraRepository
{
    public const STATUSES = ['Nuevo', 'Activa', 'En pausa', 'Retirada'];
    public const NETWORKS = ['tiktok' => 'TikTok', 'instagram' => 'Instagram', 'facebook' => 'Facebook', 'youtube' => 'YouTube', 'otro' => 'Otra red'];
    public const ORIGINS = ['coordinacion' => 'Coordinación', 'cuenta' => 'Cuenta propia'];
    /** Lo que la bitácora sabe contar. Cada acción nace de un cambio real del calendario. */
    public const ACTIONS = [
        'created' => 'Agregó el turno',
        'moved' => 'Movió el turno',
        'resized' => 'Cambió la duración',
        'reassigned' => 'Cambió de creadora',
        'edited' => 'Editó el detalle',
        'canceled' => 'Quitó el turno',
        'restored' => 'Restauró el turno',
        'attendance' => 'Registró la asistencia',
        'content' => 'Registró contenido',
    ];
    /** Lo que se puede grabar o hacer durante un turno. */
    public const CONTENT_KINDS = ['video' => 'Video', 'live' => 'En vivo', 'historia' => 'Historia', 'foto' => 'Fotografía', 'otro' => 'Otro'];
    public const ATTENDANCE = ['yes' => 'Asistió', 'no' => 'No asistió'];
    public const MAX_CONTENT = 50;
    /** Un turno puede llevar varios guiones; cada uno cabe holgado para una idea larga. */
    public const MAX_SCRIPTS = 30;
    private const MAX_SCRIPT_BODY = 20000;
    /** Un turno cabe en un día y dura al menos un cuarto de hora. */
    private const MIN_MINUTES = 15;
    private const MAX_MINUTES = 24 * 60;
    private const CONSENTS = ['policies' => true, 'privacy' => true];
    /** Enlaces públicos que puede declarar. El principal se elige aparte. */
    public const LINKS = ['tiktok' => 'TikTok', 'instagram' => 'Instagram', 'facebook' => 'Facebook'];
    /** Las horas del calendario son de Ecuador. Aquí no se convierte nada: se escribe y se lee igual. */
    private const ZONE_OFFSET = '-5 hours';

    private readonly array $catalogue;

    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, private readonly Audit $audit)
    {
        $path = __DIR__ . '/../resources/creadora-consents.json';
        $raw = is_readable($path) ? file_get_contents($path) : false;
        $decoded = $raw === false ? null : json_decode($raw, true);
        if (!is_array($decoded)) throw new RuntimeException('Catálogo de consentimientos de creadoras no disponible.');
        $this->catalogue = $decoded;
    }

    public function consentCatalogue(): array
    {
        return array_map(static fn (array $entry): array => ['version' => $entry['version'], 'text' => $entry['text']], $this->catalogue);
    }

    // --- Creadoras ---------------------------------------------------------------------------

    public function list(array $filters = []): array
    {
        $where = [];
        $values = [];
        if (($filters['status'] ?? '') !== '') { $where[] = 'c.status = ?'; $values[] = $filters['status']; }
        if (($filters['search'] ?? '') !== '') { $where[] = 'LOWER(c.full_name) LIKE ?'; $values[] = '%' . mb_strtolower(trim((string) $filters['search'])) . '%'; }
        if (($filters['origin'] ?? '') !== '') { $where[] = 'c.origin = ?'; $values[] = $filters['origin']; }
        if (empty($filters['include_retired'])) $where[] = "c.status <> 'Retirada'";
        $sql = 'SELECT c.*, (SELECT COUNT(*) FROM creadora_shifts s WHERE s.creadora_id = c.id AND s.canceled_at IS NULL) AS shift_count'
            . ' FROM creadoras c' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY c.full_name';
        $statement = $this->pdo->prepare($sql);
        $statement->execute($values);
        return ['items' => array_map(fn (array $row): array => $this->project($row), $statement->fetchAll(PDO::FETCH_ASSOC))];
    }

    public function createByAdmin(array $input, ?int $adminId, mixed $ip): array
    {
        $values = $this->validate($input, true);
        $this->assertNameAvailable($values['full_name'], null);
        $this->assertCedulaAvailable($values['cedula'], null);
        $now = gmdate('Y-m-d H:i:s');
        $publicId = bin2hex(random_bytes(16));
        $insert = $this->pdo->prepare('INSERT INTO creadoras (public_id, account_id, status, origin, full_name, name_idx, whatsapp_enc, whatsapp_idx, city, main_network, social_link, note,'
            . ' cedula_enc, cedula_idx, birth_date_enc, contact_email_enc, tiktok, instagram, facebook, followers_count, created_by_admin_id, submitted_at, updated_at)'
            . " VALUES (?, NULL, ?, 'coordinacion', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $insert->execute([$publicId, $values['status'], $values['full_name'], $this->crypto->lookup($values['full_name']),
            $this->secret($values['whatsapp']), $this->index($values['whatsapp']),
            $values['city'], $values['main_network'], $values['social_link'], $values['note'],
            $this->secret($values['cedula']), $this->index($values['cedula']), $this->secret($values['birth_date']), $this->secret($values['contact_email']),
            $values['tiktok'], $values['instagram'], $values['facebook'], $values['followers_count'], $adminId, $now, $now]);
        $this->audit->log('creadora.created_by_admin', $adminId, 'creadora', $publicId, [], $ip);
        return $this->byPublicId($publicId);
    }

    public function updateByAdmin(string $publicId, array $input, ?int $adminId, mixed $ip): array
    {
        $current = $this->rowByPublicId($publicId);
        $values = $this->validate($input, false, $current);
        $this->assertNameAvailable($values['full_name'], (int) $current['id']);
        $this->assertCedulaAvailable($values['cedula'], (int) $current['id']);
        $update = $this->pdo->prepare('UPDATE creadoras SET status = ?, full_name = ?, name_idx = ?, whatsapp_enc = ?, whatsapp_idx = ?, city = ?, main_network = ?, social_link = ?, note = ?,'
            . ' cedula_enc = ?, cedula_idx = ?, birth_date_enc = ?, contact_email_enc = ?, tiktok = ?, instagram = ?, facebook = ?, followers_count = ?, updated_at = ? WHERE id = ?');
        $update->execute([$values['status'], $values['full_name'], $this->crypto->lookup($values['full_name']),
            $this->secret($values['whatsapp']), $this->index($values['whatsapp']),
            $values['city'], $values['main_network'], $values['social_link'], $values['note'],
            $this->secret($values['cedula']), $this->index($values['cedula']), $this->secret($values['birth_date']), $this->secret($values['contact_email']),
            $values['tiktok'], $values['instagram'], $values['facebook'], $values['followers_count'],
            gmdate('Y-m-d H:i:s'), $current['id']]);
        $this->audit->log('creadora.updated_by_admin', $adminId, 'creadora', $publicId, [], $ip);
        return $this->byPublicId($publicId);
    }

    /** Retirar conserva la ficha y sus turnos pasados; los turnos futuros se quitan del calendario. */
    public function retire(string $publicId, ?int $adminId, string $actorName, mixed $ip): array
    {
        $row = $this->rowByPublicId($publicId);
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare("UPDATE creadoras SET status = 'Retirada', updated_at = ? WHERE id = ?")->execute([$now, $row['id']]);
        $pending = $this->pdo->prepare('SELECT * FROM creadora_shifts WHERE creadora_id = ? AND canceled_at IS NULL AND starts_at >= ?');
        $pending->execute([$row['id'], $this->localNow()]);
        foreach ($pending->fetchAll(PDO::FETCH_ASSOC) as $shift) {
            $this->pdo->prepare('UPDATE creadora_shifts SET canceled_at = ?, updated_at = ? WHERE id = ?')->execute([$now, $now, $shift['id']]);
            $this->log('canceled', $shift, $row, $actorName, ['detail' => 'La creadora fue retirada.']);
        }
        if ($row['account_id'] !== null) {
            $this->pdo->prepare('UPDATE creadora_accounts SET active = 0, updated_at = ? WHERE id = ?')->execute([$now, $row['account_id']]);
        }
        $this->audit->log('creadora.retired', $adminId, 'creadora', $publicId, [], $ip);
        return $this->byPublicId($publicId);
    }

    public function byPublicId(string $publicId): array
    {
        return $this->project($this->rowByPublicId($publicId));
    }

    /** La ficha propia de una creadora autenticada; null mientras no haya completado su registro. */
    public function forAccount(int $accountId): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM creadoras WHERE account_id = ?');
        $statement->execute([$accountId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $this->project($row);
    }

    /** Guarda el registro de la creadora autenticada. Ella no fija su estado ni sus turnos. */
    public function saveForAccount(int $accountId, array $input, mixed $ip): array
    {
        $existing = $this->pdo->prepare('SELECT * FROM creadoras WHERE account_id = ?');
        $existing->execute([$accountId]);
        $current = $existing->fetch(PDO::FETCH_ASSOC) ?: null;
        $values = $this->validate($input, $current === null, $current ?: null, true);
        $this->assertConsents($input);
        $this->assertNameAvailable($values['full_name'], $current ? (int) $current['id'] : null);
        $this->assertCedulaAvailable($values['cedula'], $current ? (int) $current['id'] : null);
        $now = gmdate('Y-m-d H:i:s');
        $whatsapp = $values['whatsapp'];
        if ($whatsapp === '') throw new InvalidArgumentException('Escribe tu número de WhatsApp.');
        if ($current === null) {
            $publicId = bin2hex(random_bytes(16));
            $insert = $this->pdo->prepare('INSERT INTO creadoras (public_id, account_id, status, origin, full_name, name_idx, whatsapp_enc, whatsapp_idx, city, main_network, social_link, note,'
                . ' cedula_enc, cedula_idx, birth_date_enc, contact_email_enc, tiktok, instagram, facebook, followers_count, created_by_admin_id, submitted_at, updated_at)'
                . " VALUES (?, ?, 'Nuevo', 'cuenta', ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)");
            $insert->execute([$publicId, $accountId, $values['full_name'], $this->crypto->lookup($values['full_name']),
                $this->crypto->encrypt($whatsapp), $this->crypto->lookup($whatsapp),
                $values['city'], $values['main_network'], $values['social_link'],
                $this->secret($values['cedula']), $this->index($values['cedula']), $this->secret($values['birth_date']), $this->secret($values['contact_email']),
                $values['tiktok'], $values['instagram'], $values['facebook'], $values['followers_count'], $now, $now]);
            $creadoraId = (int) $this->pdo->lastInsertId();
        } else {
            $creadoraId = (int) $current['id'];
            $publicId = $current['public_id'];
            $this->pdo->prepare('UPDATE creadoras SET full_name = ?, name_idx = ?, whatsapp_enc = ?, whatsapp_idx = ?, city = ?, main_network = ?, social_link = ?,'
                . ' cedula_enc = ?, cedula_idx = ?, birth_date_enc = ?, contact_email_enc = ?, tiktok = ?, instagram = ?, facebook = ?, followers_count = ?, updated_at = ? WHERE id = ?')
                ->execute([$values['full_name'], $this->crypto->lookup($values['full_name']), $this->crypto->encrypt($whatsapp), $this->crypto->lookup($whatsapp),
                    $values['city'], $values['main_network'], $values['social_link'],
                    $this->secret($values['cedula']), $this->index($values['cedula']), $this->secret($values['birth_date']), $this->secret($values['contact_email']),
                    $values['tiktok'], $values['instagram'], $values['facebook'], $values['followers_count'], $now, $creadoraId]);
        }
        $this->recordConsents($creadoraId, $input, $ip, $now);
        $this->audit->log('creadora.profile_saved', null, 'creadora', $publicId, [], $ip);
        return $this->byPublicId($publicId);
    }

    // --- Calendario --------------------------------------------------------------------------

    /**
     * Los turnos del rango pedido, más la lista de creadoras disponibles y la bitácora reciente:
     * la pantalla del calendario se dibuja entera con una sola respuesta.
     */
    public function calendar(string $from, string $to, int $logLimit = 50): array
    {
        [$start, $end] = $this->range($from, $to);
        $statement = $this->pdo->prepare('SELECT s.*, c.public_id AS creadora_public_id, c.full_name,'
            . ' (SELECT COUNT(*) FROM creadora_shift_content k WHERE k.shift_id = s.id) AS content_count,'
            . ' (SELECT COUNT(*) FROM creadora_shift_script g WHERE g.shift_id = s.id) AS script_count FROM creadora_shifts s'
            . ' JOIN creadoras c ON c.id = s.creadora_id WHERE s.canceled_at IS NULL AND s.starts_at < ? AND s.ends_at > ? ORDER BY s.starts_at, c.full_name');
        $statement->execute([$end, $start]);
        return [
            'from' => $start,
            'to' => $end,
            'shifts' => array_map(static fn (array $row): array => [
                'public_id' => $row['public_id'],
                'creadora' => $row['creadora_public_id'],
                'name' => $row['full_name'],
                'starts_at' => $row['starts_at'],
                'ends_at' => $row['ends_at'],
                'place' => $row['place'],
                'note' => $row['note'],
                'attended' => $row['attended'] ?? null,
                'content_count' => (int) ($row['content_count'] ?? 0),
                'script_count' => (int) ($row['script_count'] ?? 0),
            ], $statement->fetchAll(PDO::FETCH_ASSOC)),
            'creadoras' => $this->list()['items'],
            'log' => $this->log_(min(max($logLimit, 1), 200)),
        ];
    }

    public function createShift(array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $creadora = $this->rowByPublicId((string) ($input['creadora'] ?? ''));
        if ($creadora['status'] === 'Retirada') throw new InvalidArgumentException('Esa creadora está retirada.');
        [$startsAt, $endsAt] = $this->slot($input['starts_at'] ?? null, $input['ends_at'] ?? null);
        $this->assertFree((int) $creadora['id'], $startsAt, $endsAt, null);
        $now = gmdate('Y-m-d H:i:s');
        $publicId = bin2hex(random_bytes(16));
        $insert = $this->pdo->prepare('INSERT INTO creadora_shifts (public_id, creadora_id, starts_at, ends_at, place, note, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $insert->execute([$publicId, $creadora['id'], $startsAt, $endsAt, $this->text($input['place'] ?? '', 160), $this->text($input['note'] ?? '', 400), $adminId, $now, $now]);
        $shift = ['id' => (int) $this->pdo->lastInsertId(), 'public_id' => $publicId, 'creadora_id' => (int) $creadora['id'], 'starts_at' => $startsAt, 'ends_at' => $endsAt];
        $this->log('created', $shift, $creadora, $actorName, ['after' => [$startsAt, $endsAt]]);
        $this->audit->log('creadora.shift_created', $adminId, 'creadora_shift', $publicId, [], $ip);
        return $this->shiftByPublicId($publicId);
    }

    /** Mover, estirar, reasignar o editar: cada diferencia real entra a la bitácora con su nombre. */
    public function updateShift(string $publicId, array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($publicId);
        $creadora = $this->rowById((int) $shift['creadora_id']);
        $target = $creadora;
        if (array_key_exists('creadora', $input) && (string) $input['creadora'] !== '' && (string) $input['creadora'] !== $creadora['public_id']) {
            $target = $this->rowByPublicId((string) $input['creadora']);
            if ($target['status'] === 'Retirada') throw new InvalidArgumentException('Esa creadora está retirada.');
        }
        [$startsAt, $endsAt] = $this->slot($input['starts_at'] ?? $shift['starts_at'], $input['ends_at'] ?? $shift['ends_at']);
        $this->assertFree((int) $target['id'], $startsAt, $endsAt, (int) $shift['id']);
        $place = array_key_exists('place', $input) ? $this->text($input['place'], 160) : $shift['place'];
        $note = array_key_exists('note', $input) ? $this->text($input['note'], 400) : $shift['note'];
        $now = gmdate('Y-m-d H:i:s');
        if (array_key_exists('attended', $input)) {
            $this->markAttendance($shift, $target, $input['attended'], $actorName, $adminId, $ip);
            $shift = $this->shiftRow($publicId);
        }
        $this->pdo->prepare('UPDATE creadora_shifts SET creadora_id = ?, starts_at = ?, ends_at = ?, place = ?, note = ?, updated_at = ? WHERE id = ?')
            ->execute([$target['id'], $startsAt, $endsAt, $place, $note, $now, $shift['id']]);

        $moved = $startsAt !== $shift['starts_at'];
        $lengthBefore = $this->minutes($shift['starts_at'], $shift['ends_at']);
        $resized = $this->minutes($startsAt, $endsAt) !== $lengthBefore;
        $context = ['before' => [$shift['starts_at'], $shift['ends_at']], 'after' => [$startsAt, $endsAt]];
        if ((int) $target['id'] !== (int) $creadora['id']) {
            $this->log('reassigned', $shift, $target, $actorName, $context + ['detail' => 'Antes: ' . $creadora['full_name'] . '.']);
        } elseif ($moved && $resized) {
            $this->log('moved', $shift, $target, $actorName, $context);
            $this->log('resized', $shift, $target, $actorName, $context);
        } elseif ($moved) {
            $this->log('moved', $shift, $target, $actorName, $context);
        } elseif ($resized) {
            $this->log('resized', $shift, $target, $actorName, $context);
        }
        if ($place !== $shift['place'] || $note !== $shift['note']) {
            $this->log('edited', $shift, $target, $actorName, $context + ['detail' => 'Se actualizó el lugar o la nota.']);
        }
        $this->audit->log('creadora.shift_updated', $adminId, 'creadora_shift', $publicId, [], $ip);
        return $this->shiftByPublicId($publicId);
    }

    /** Quitar un turno no lo borra: queda fuera del calendario y la bitácora conserva el rastro. */
    public function cancelShift(string $publicId, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($publicId);
        if ($shift['canceled_at'] !== null) throw new InvalidArgumentException('Ese turno ya fue quitado del calendario.');
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('UPDATE creadora_shifts SET canceled_at = ?, updated_at = ? WHERE id = ?')->execute([$now, $now, $shift['id']]);
        $this->log('canceled', $shift, $this->rowById((int) $shift['creadora_id']), $actorName, ['before' => [$shift['starts_at'], $shift['ends_at']]]);
        $this->audit->log('creadora.shift_canceled', $adminId, 'creadora_shift', $publicId, [], $ip);
        return ['removed' => $publicId, 'log' => $this->log_(50)];
    }

    /** Quién vino y quién no: coordinación lo marca en el mismo turno. */
    public function markAttendance(array $shift, array $creadora, mixed $value, string $actorName, ?int $adminId, mixed $ip): void
    {
        $attended = $value === null || $value === '' ? null : (string) $value;
        if ($attended !== null && !array_key_exists($attended, self::ATTENDANCE)) throw new InvalidArgumentException('Asistencia no válida.');
        if (($shift['attended'] ?? null) === $attended) return;
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('UPDATE creadora_shifts SET attended = ?, attendance_at = ?, updated_at = ? WHERE id = ?')
            ->execute([$attended, $attended === null ? null : $now, $now, $shift['id']]);
        $this->log('attendance', $shift, $creadora, $actorName, [
            'detail' => $attended === null ? 'Quitó la marca de asistencia.' : self::ATTENDANCE[$attended] . '.',
        ]);
        $this->audit->log('creadora.attendance_marked', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
    }

    /** Un turno puede dejar varios contenidos: videos, lives, historias o lo que se haya hecho. */
    public function addContent(string $shiftPublicId, array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        $creadora = $this->rowById((int) $shift['creadora_id']);
        $kind = $this->text($input['kind'] ?? '', 16);
        if (!array_key_exists($kind, self::CONTENT_KINDS)) throw new InvalidArgumentException('Elige el tipo de contenido.');
        $title = $this->text($input['title'] ?? '', 200);
        if ($title === '') throw new InvalidArgumentException('Escribe el nombre del contenido.');
        $url = $this->text($input['url'] ?? '', 500);
        if ($url !== '' && !preg_match('~^https://[^\s]+$~D', $url)) throw new InvalidArgumentException('El enlace debe empezar con https://');
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM creadora_shift_content WHERE shift_id = ?');
        $count->execute([$shift['id']]);
        if ((int) $count->fetchColumn() >= self::MAX_CONTENT) throw new InvalidArgumentException('Este turno ya tiene demasiado contenido registrado.');
        $publicId = bin2hex(random_bytes(16));
        $this->pdo->prepare('INSERT INTO creadora_shift_content (public_id, shift_id, kind, title, url, note, created_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $shift['id'], $kind, $title, $url, $this->text($input['note'] ?? '', 400), $adminId, gmdate('Y-m-d H:i:s')]);
        $this->log('content', $shift, $creadora, $actorName, ['detail' => self::CONTENT_KINDS[$kind] . ': ' . $title]);
        $this->audit->log('creadora.content_added', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    public function removeContent(string $shiftPublicId, string $contentPublicId, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        if (!preg_match('~^[a-f0-9]{32}$~D', $contentPublicId)) throw new InvalidArgumentException('Contenido no encontrado.');
        $statement = $this->pdo->prepare('SELECT * FROM creadora_shift_content WHERE public_id = ? AND shift_id = ?');
        $statement->execute([$contentPublicId, $shift['id']]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new InvalidArgumentException('Contenido no encontrado.');
        $this->pdo->prepare('DELETE FROM creadora_shift_content WHERE id = ?')->execute([$row['id']]);
        $this->log('content', $shift, $this->rowById((int) $shift['creadora_id']), $actorName, ['detail' => 'Quitó ' . mb_strtolower(self::CONTENT_KINDS[$row['kind']] ?? 'contenido') . ': ' . $row['title']]);
        $this->audit->log('creadora.content_removed', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    /** El cuaderno: lo que se va a grabar y cómo. Se escribe antes; el contenido se registra después. */
    public function addScript(string $shiftPublicId, array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        $values = $this->validateScript($input);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM creadora_shift_script WHERE shift_id = ?');
        $count->execute([$shift['id']]);
        $total = (int) $count->fetchColumn();
        if ($total >= self::MAX_SCRIPTS) throw new InvalidArgumentException('Este turno ya tiene demasiados guiones.');
        $now = gmdate('Y-m-d H:i:s');
        $publicId = bin2hex(random_bytes(16));
        $this->pdo->prepare('INSERT INTO creadora_shift_script (public_id, shift_id, title, body, reference_url, position, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $shift['id'], $values['title'], $values['body'], $values['reference_url'], $total + 1, $adminId, $now, $now]);
        $this->log('edited', $shift, $this->rowById((int) $shift['creadora_id']), $actorName, ['detail' => 'Agregó el guion: ' . $values['title']]);
        $this->audit->log('creadora.script_added', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    public function updateScript(string $shiftPublicId, string $scriptPublicId, array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        $current = $this->scriptRow($scriptPublicId, (int) $shift['id']);
        $values = $this->validateScript($input, $current);
        $this->pdo->prepare('UPDATE creadora_shift_script SET title = ?, body = ?, reference_url = ?, updated_at = ? WHERE id = ?')
            ->execute([$values['title'], $values['body'], $values['reference_url'], gmdate('Y-m-d H:i:s'), $current['id']]);
        $this->log('edited', $shift, $this->rowById((int) $shift['creadora_id']), $actorName, ['detail' => 'Editó el guion: ' . $values['title']]);
        $this->audit->log('creadora.script_updated', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    public function removeScript(string $shiftPublicId, string $scriptPublicId, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        $current = $this->scriptRow($scriptPublicId, (int) $shift['id']);
        $this->pdo->prepare('DELETE FROM creadora_shift_script WHERE id = ?')->execute([$current['id']]);
        $this->log('edited', $shift, $this->rowById((int) $shift['creadora_id']), $actorName, ['detail' => 'Quitó el guion: ' . $current['title']]);
        $this->audit->log('creadora.script_removed', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    private function validateScript(array $input, ?array $current = null): array
    {
        $title = $this->text($input['title'] ?? ($current['title'] ?? ''), 200);
        if ($title === '') throw new InvalidArgumentException('Ponle un nombre a la idea.');
        // El guion conserva sus saltos de línea: es un texto largo, no una etiqueta.
        $body = is_string($input['body'] ?? null) ? trim($input['body']) : (string) ($current['body'] ?? '');
        if (mb_strlen($body) > self::MAX_SCRIPT_BODY) throw new InvalidArgumentException('El guion es demasiado largo.');
        $url = $this->text($input['reference_url'] ?? ($current['reference_url'] ?? ''), 500);
        if ($url !== '' && !preg_match('~^https://[^\s]+$~D', $url)) throw new InvalidArgumentException('El enlace debe empezar con https://');
        return ['title' => $title, 'body' => $body, 'reference_url' => $url];
    }

    private function scriptRow(string $publicId, int $shiftId): array
    {
        if (!preg_match('~^[a-f0-9]{32}$~D', $publicId)) throw new InvalidArgumentException('Guion no encontrado.');
        $statement = $this->pdo->prepare('SELECT * FROM creadora_shift_script WHERE public_id = ? AND shift_id = ?');
        $statement->execute([$publicId, $shiftId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new InvalidArgumentException('Guion no encontrado.');
        return $row;
    }

    private function scriptsFor(int $shiftId): array
    {
        $statement = $this->pdo->prepare('SELECT public_id, title, body, reference_url, updated_at FROM creadora_shift_script WHERE shift_id = ? ORDER BY position, id');
        $statement->execute([$shiftId]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    private function contentFor(int $shiftId): array
    {
        $statement = $this->pdo->prepare('SELECT public_id, kind, title, url, note, created_at FROM creadora_shift_content WHERE shift_id = ? ORDER BY created_at, id');
        $statement->execute([$shiftId]);
        return array_map(static fn (array $row): array => [
            'public_id' => $row['public_id'],
            'kind' => $row['kind'],
            'kind_label' => self::CONTENT_KINDS[$row['kind']] ?? $row['kind'],
            'title' => $row['title'],
            'url' => $row['url'],
            'note' => $row['note'],
            'created_at' => $row['created_at'],
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    /** Los turnos de la creadora autenticada, de hoy en adelante. */
    public function shiftsForAccount(int $accountId): array
    {
        $own = $this->forAccount($accountId);
        if ($own === null) return ['shifts' => []];
        $statement = $this->pdo->prepare('SELECT s.public_id, s.starts_at, s.ends_at, s.place, s.note, s.attended FROM creadora_shifts s'
            . ' JOIN creadoras c ON c.id = s.creadora_id WHERE c.account_id = ? AND s.canceled_at IS NULL AND s.ends_at >= ? ORDER BY s.starts_at');
        $statement->execute([$accountId, substr($this->localNow(), 0, 10) . ' 00:00:00']);
        return ['shifts' => $statement->fetchAll(PDO::FETCH_ASSOC)];
    }

    public function logEntries(int $limit = 50): array
    {
        return ['log' => $this->log_(min(max($limit, 1), 200))];
    }

    // --- Interno -----------------------------------------------------------------------------

    private function log_(int $limit): array
    {
        $statement = $this->pdo->prepare('SELECT action, actor_name, creadora_name, before_starts_at, before_ends_at, after_starts_at, after_ends_at, detail, recorded_at'
            . ' FROM creadora_shift_log ORDER BY recorded_at DESC, id DESC LIMIT ' . $limit);
        $statement->execute();
        return array_map(static fn (array $row): array => [
            'action' => $row['action'],
            'label' => self::ACTIONS[$row['action']] ?? $row['action'],
            'actor' => $row['actor_name'],
            'creadora' => $row['creadora_name'],
            'before' => $row['before_starts_at'] === null ? null : ['starts_at' => $row['before_starts_at'], 'ends_at' => $row['before_ends_at']],
            'after' => $row['after_starts_at'] === null ? null : ['starts_at' => $row['after_starts_at'], 'ends_at' => $row['after_ends_at']],
            'detail' => $row['detail'],
            'recorded_at' => $row['recorded_at'],
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function log(string $action, array $shift, array $creadora, string $actorName, array $context = []): void
    {
        $insert = $this->pdo->prepare('INSERT INTO creadora_shift_log (shift_id, creadora_id, action, actor_name, creadora_name, before_starts_at, before_ends_at, after_starts_at, after_ends_at, detail, recorded_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $insert->execute([$shift['id'] ?? null, $creadora['id'] ?? null, $action, $this->text($actorName, 160) ?: 'coordinación', $creadora['full_name'] ?? '',
            $context['before'][0] ?? null, $context['before'][1] ?? null, $context['after'][0] ?? null, $context['after'][1] ?? null,
            $this->text($context['detail'] ?? '', 400), gmdate('Y-m-d H:i:s')]);
    }

    private function project(array $row): array
    {
        return [
            'public_id' => $row['public_id'],
            'full_name' => $row['full_name'],
            'status' => $row['status'],
            'origin' => $row['origin'],
            'origin_label' => self::ORIGINS[$row['origin']] ?? $row['origin'],
            'has_account' => $row['account_id'] !== null,
            'whatsapp' => ($row['whatsapp_enc'] ?? '') === '' ? '' : $this->crypto->decrypt($row['whatsapp_enc']),
            'city' => $row['city'],
            'main_network' => $row['main_network'],
            'main_network_label' => self::NETWORKS[$row['main_network']] ?? '',
            'social_link' => $row['social_link'],
            'cedula' => $this->reveal($row['cedula_enc'] ?? ''),
            'birth_date' => $this->reveal($row['birth_date_enc'] ?? ''),
            'age' => $this->age($this->reveal($row['birth_date_enc'] ?? '')),
            'contact_email' => $this->reveal($row['contact_email_enc'] ?? ''),
            'tiktok' => $row['tiktok'] ?? '',
            'instagram' => $row['instagram'] ?? '',
            'facebook' => $row['facebook'] ?? '',
            'followers_count' => (int) ($row['followers_count'] ?? 0),
            'note' => $row['note'],
            'shift_count' => isset($row['shift_count']) ? (int) $row['shift_count'] : null,
            'submitted_at' => $row['submitted_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    private function validate(array $input, bool $creating, ?array $current = null, bool $selfService = false): array
    {
        $name = $this->text($input['full_name'] ?? ($current['full_name'] ?? ''), 160);
        if ($name === '') throw new InvalidArgumentException('Escribe el nombre de la creadora.');
        if (mb_strlen($name) < 3) throw new InvalidArgumentException('El nombre es demasiado corto.');
        $status = $selfService ? ($current['status'] ?? 'Nuevo') : $this->text($input['status'] ?? ($current['status'] ?? 'Nuevo'), 32);
        if (!in_array($status, self::STATUSES, true)) throw new InvalidArgumentException('Estado no válido.');
        $network = $this->text($input['main_network'] ?? ($current['main_network'] ?? ''), 32);
        if ($network !== '' && !array_key_exists($network, self::NETWORKS)) throw new InvalidArgumentException('Red principal no válida.');
        $link = $this->text($input['social_link'] ?? ($current['social_link'] ?? ''), 400);
        if ($link !== '' && !preg_match('~^https://[^\s]+$~D', $link)) throw new InvalidArgumentException('El enlace debe empezar con https://');
        $whatsapp = $this->text($input['whatsapp'] ?? '', 32);
        if ($whatsapp === '' && $current !== null && !array_key_exists('whatsapp', $input)) {
            $whatsapp = ($current['whatsapp_enc'] ?? '') === '' ? '' : $this->crypto->decrypt($current['whatsapp_enc']);
        }
        if ($whatsapp !== '' && !preg_match('~^[0-9+][0-9 ]{6,19}$~D', $whatsapp)) throw new InvalidArgumentException('El número de WhatsApp no es válido.');
        $cedula = preg_replace('/\D+/', '', (string) ($input['cedula'] ?? '')) ?? '';
        if ($cedula === '' && $current !== null && !array_key_exists('cedula', $input)) $cedula = $this->reveal($current['cedula_enc'] ?? '');
        if ($cedula !== '' && !preg_match('~^[0-9]{10}$~D', $cedula)) throw new InvalidArgumentException('La cédula debe tener diez dígitos.');
        $birth = $this->text($input['birth_date'] ?? '', 10);
        if ($birth === '' && $current !== null && !array_key_exists('birth_date', $input)) $birth = $this->reveal($current['birth_date_enc'] ?? '');
        if ($birth !== '') {
            if (!preg_match('~^(\d{4})-(\d{2})-(\d{2})$~D', $birth, $parts) || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
                throw new InvalidArgumentException('La fecha de nacimiento no es válida.');
            }
            if ($birth > substr($this->localNow(), 0, 10)) throw new InvalidArgumentException('La fecha de nacimiento no puede estar en el futuro.');
        }
        $contactEmail = mb_strtolower($this->text($input['contact_email'] ?? '', 254));
        if ($contactEmail === '' && $current !== null && !array_key_exists('contact_email', $input)) $contactEmail = $this->reveal($current['contact_email_enc'] ?? '');
        if ($contactEmail !== '' && !filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('El correo de contacto no es válido.');
        $links = [];
        foreach (array_keys(self::LINKS) as $key) {
            $link = $this->text($input[$key] ?? ($current[$key] ?? ''), 400);
            if ($link !== '' && !preg_match('~^https://[^\s]+$~D', $link)) throw new InvalidArgumentException('Los enlaces deben empezar con https://');
            $links[$key] = $link;
        }
        $followers = $input['followers_count'] ?? ($current['followers_count'] ?? 0);
        if (is_string($followers)) $followers = trim($followers) === '' ? 0 : $followers;
        if (!is_numeric($followers) || (int) $followers < 0 || (int) $followers > 1000000000) throw new InvalidArgumentException('La cantidad de seguidores no es válida.');
        return [
            'cedula' => $cedula,
            'birth_date' => $birth,
            'contact_email' => $contactEmail,
            'tiktok' => $links['tiktok'],
            'instagram' => $links['instagram'],
            'facebook' => $links['facebook'],
            'followers_count' => (int) $followers,
            'full_name' => $name,
            'status' => $creating && !$selfService ? ($this->text($input['status'] ?? 'Activa', 32) ?: 'Activa') : $status,
            'whatsapp' => $whatsapp,
            'city' => $this->text($input['city'] ?? ($current['city'] ?? ''), 120),
            'main_network' => $network,
            'social_link' => $link,
            'note' => $selfService ? ($current['note'] ?? '') : $this->text($input['note'] ?? ($current['note'] ?? ''), 2000),
        ];
    }

    private function secret(string $value): string
    {
        return $value === '' ? '' : $this->crypto->encrypt($value);
    }

    private function index(string $value): string
    {
        return $value === '' ? '' : $this->crypto->lookup($value);
    }

    private function reveal(string $value): string
    {
        return $value === '' ? '' : $this->crypto->decrypt($value);
    }

    /** Años cumplidos, para que coordinación sepa si trata con una persona menor de edad. */
    private function age(string $birth): ?int
    {
        if ($birth === '') return null;
        $today = substr($this->localNow(), 0, 10);
        $years = (int) substr($today, 0, 4) - (int) substr($birth, 0, 4);
        if (substr($today, 5) < substr($birth, 5)) $years--;
        return max(0, $years);
    }

    /** La cédula identifica a la persona: dos fichas activas no pueden compartirla. */
    private function assertCedulaAvailable(string $cedula, ?int $exceptId): void
    {
        if ($cedula === '') return;
        $statement = $this->pdo->prepare("SELECT id FROM creadoras WHERE cedula_idx = ? AND status <> 'Retirada'" . ($exceptId === null ? '' : ' AND id <> ?'));
        $statement->execute($exceptId === null ? [$this->crypto->lookup($cedula)] : [$this->crypto->lookup($cedula), $exceptId]);
        if ($statement->fetch(PDO::FETCH_ASSOC) !== false) throw new DuplicateRegistration('Ya existe una creadora con esa cédula.');
    }

    private function assertNameAvailable(string $name, ?int $exceptId): void
    {
        $statement = $this->pdo->prepare('SELECT id FROM creadoras WHERE name_idx = ?' . ($exceptId === null ? '' : ' AND id <> ?'));
        $statement->execute($exceptId === null ? [$this->crypto->lookup($name)] : [$this->crypto->lookup($name), $exceptId]);
        if ($statement->fetch(PDO::FETCH_ASSOC) !== false) throw new DuplicateRegistration('Ya existe una creadora con ese nombre.');
    }

    private function assertConsents(array $input): void
    {
        foreach (self::CONSENTS as $type => $required) {
            if ($required && empty($input[$type . '_accepted'])) throw new InvalidArgumentException('Falta aceptar las condiciones del programa.');
        }
    }

    private function recordConsents(int $creadoraId, array $input, mixed $ip, string $now): void
    {
        foreach (array_keys(self::CONSENTS) as $type) {
            if (!isset($this->catalogue[$type])) continue;
            $insert = $this->pdo->prepare('INSERT INTO creadora_consents (creadora_id, consent_type, accepted, text_version, text_hash, ip_hash, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $insert->execute([$creadoraId, $type, empty($input[$type . '_accepted']) ? 0 : 1, $this->catalogue[$type]['version'],
                hash('sha256', $this->catalogue[$type]['text']), $this->crypto->lookup((string) $ip), $now]);
        }
    }

    /** Normaliza el inicio y el fin que manda el calendario y rechaza lo que no es un turno. */
    private function slot(mixed $startsAt, mixed $endsAt): array
    {
        $start = $this->moment($startsAt);
        $end = $this->moment($endsAt);
        $minutes = $this->minutes($start, $end);
        if ($minutes < self::MIN_MINUTES) throw new InvalidArgumentException('El turno debe durar al menos 15 minutos.');
        if ($minutes > self::MAX_MINUTES) throw new InvalidArgumentException('El turno no puede durar más de un día.');
        return [$start, $end];
    }

    private function moment(mixed $value): string
    {
        if (!is_string($value) || !preg_match('~^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$~D', trim($value), $parts)) {
            throw new InvalidArgumentException('Fecha y hora no válidas.');
        }
        [$year, $month, $day] = array_map('intval', explode('-', $parts[1]));
        if (!checkdate($month, $day, $year) || (int) $parts[2] > 23 || (int) $parts[3] > 59) throw new InvalidArgumentException('Fecha y hora no válidas.');
        if ($year < 2026 || $year > 2030) throw new InvalidArgumentException('La fecha está fuera del rango permitido.');
        return sprintf('%s %02d:%02d:00', $parts[1], (int) $parts[2], (int) $parts[3]);
    }

    /** La hora de Ecuador en el formato del calendario, para comparar turnos con «ahora». */
    private function localNow(): string
    {
        return gmdate('Y-m-d H:i:s', strtotime(self::ZONE_OFFSET, time()));
    }

    private function minutes(string $start, string $end): int
    {
        return (int) round((strtotime($end . ' UTC') - strtotime($start . ' UTC')) / 60);
    }

    /** Nadie puede estar en dos lugares a la vez: dos turnos de la misma creadora no se solapan. */
    private function assertFree(int $creadoraId, string $startsAt, string $endsAt, ?int $exceptId): void
    {
        $sql = 'SELECT public_id FROM creadora_shifts WHERE creadora_id = ? AND canceled_at IS NULL AND starts_at < ? AND ends_at > ?';
        $values = [$creadoraId, $endsAt, $startsAt];
        if ($exceptId !== null) { $sql .= ' AND id <> ?'; $values[] = $exceptId; }
        $statement = $this->pdo->prepare($sql . ' LIMIT 1');
        $statement->execute($values);
        if ($statement->fetch(PDO::FETCH_ASSOC) !== false) throw new DuplicateRegistration('Esa creadora ya tiene un turno a esa hora.');
    }

    private function range(mixed $from, mixed $to): array
    {
        $start = $this->day($from) . ' 00:00:00';
        $end = $this->day($to) . ' 00:00:00';
        if ($end <= $start) throw new InvalidArgumentException('El rango de fechas no es válido.');
        if ($this->minutes($start, $end) > 62 * 24 * 60) throw new InvalidArgumentException('El rango no puede superar dos meses.');
        return [$start, $end];
    }

    private function day(mixed $value): string
    {
        if (!is_string($value) || !preg_match('~^\d{4}-\d{2}-\d{2}$~D', trim($value))) throw new InvalidArgumentException('Fecha no válida.');
        [$year, $month, $day] = array_map('intval', explode('-', trim($value)));
        if (!checkdate($month, $day, $year) || $year < 2026 || $year > 2030) throw new InvalidArgumentException('Fecha no válida.');
        return trim($value);
    }

    private function text(mixed $value, int $max): string
    {
        $text = is_string($value) ? trim(preg_replace('/\s+/u', ' ', $value) ?? '') : '';
        return mb_substr($text, 0, $max);
    }

    private function rowByPublicId(string $publicId): array
    {
        if (!preg_match('~^[a-f0-9]{32}$~D', $publicId)) throw new InvalidArgumentException('Creadora no encontrada.');
        $statement = $this->pdo->prepare('SELECT * FROM creadoras WHERE public_id = ?');
        $statement->execute([$publicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new InvalidArgumentException('Creadora no encontrada.');
        return $row;
    }

    private function rowById(int $id): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM creadoras WHERE id = ?');
        $statement->execute([$id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new InvalidArgumentException('Creadora no encontrada.');
        return $row;
    }

    private function shiftRow(string $publicId): array
    {
        if (!preg_match('~^[a-f0-9]{32}$~D', $publicId)) throw new InvalidArgumentException('Turno no encontrado.');
        $statement = $this->pdo->prepare('SELECT * FROM creadora_shifts WHERE public_id = ?');
        $statement->execute([$publicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new InvalidArgumentException('Turno no encontrado.');
        return $row;
    }

    private function shiftByPublicId(string $publicId): array
    {
        $statement = $this->pdo->prepare('SELECT s.*, c.public_id AS creadora_public_id, c.full_name FROM creadora_shifts s JOIN creadoras c ON c.id = s.creadora_id WHERE s.public_id = ?');
        $statement->execute([$publicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new InvalidArgumentException('Turno no encontrado.');
        return ['shift' => [
            'public_id' => $row['public_id'],
            'creadora' => $row['creadora_public_id'],
            'name' => $row['full_name'],
            'starts_at' => $row['starts_at'],
            'ends_at' => $row['ends_at'],
            'place' => $row['place'],
            'note' => $row['note'],
            'attended' => $row['attended'] ?? null,
            'attendance_at' => $row['attendance_at'] ?? null,
            'content' => $this->contentFor((int) $row['id']),
            'scripts' => $this->scriptsFor((int) $row['id']),
        ], 'log' => $this->log_(50)];
    }
}
