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
    /** Varias creadoras pueden compartir la misma caja del calendario. */
    public const MAX_MEMBERS = 12;
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
        $sql = 'SELECT c.*, (SELECT COUNT(*) FROM creadora_shift_members m JOIN creadora_shifts s ON s.id = m.shift_id WHERE m.creadora_id = c.id AND s.canceled_at IS NULL) AS shift_count'
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
        $pending = $this->pdo->prepare('SELECT s.* FROM creadora_shifts s JOIN creadora_shift_members m ON m.shift_id = s.id'
            . ' WHERE m.creadora_id = ? AND s.canceled_at IS NULL AND s.starts_at >= ?');
        $pending->execute([$row['id'], $this->localNow()]);
        foreach ($pending->fetchAll(PDO::FETCH_ASSOC) as $shift) {
            $others = array_values(array_filter($this->members((int) $shift['id']), static fn (array $member): bool => (int) $member['creadora_id'] !== (int) $row['id']));
            if ($others === []) {
                $this->pdo->prepare('UPDATE creadora_shifts SET canceled_at = ?, updated_at = ? WHERE id = ?')->execute([$now, $now, $shift['id']]);
                $this->log('canceled', $shift, $row, $actorName, ['detail' => 'La creadora fue retirada.']);
                continue;
            }
            // Si el turno era compartido, sigue en pie para las demás.
            $this->pdo->prepare('DELETE FROM creadora_shift_members WHERE shift_id = ? AND creadora_id = ?')->execute([$shift['id'], $row['id']]);
            $this->pdo->prepare('UPDATE creadora_shifts SET creadora_id = ?, updated_at = ? WHERE id = ?')->execute([$others[0]['creadora_id'], $now, $shift['id']]);
            $this->log('reassigned', $shift, $row, $actorName, ['detail' => 'La creadora fue retirada. Siguen: ' . implode(', ', array_column($others, 'full_name')) . '.']);
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
     * Los turnos del rango pedido, más la lista de creadoras, los indicadores de cada una y la
     * bitácora reciente: la pantalla del calendario se dibuja entera con una sola respuesta.
     */
    public function calendar(string $from, string $to, int $logLimit = 50): array
    {
        [$start, $end] = $this->range($from, $to);
        $statement = $this->pdo->prepare('SELECT s.*,'
            . ' (SELECT COUNT(*) FROM creadora_shift_content k WHERE k.shift_id = s.id) AS content_count,'
            . ' (SELECT COUNT(*) FROM creadora_shift_script g WHERE g.shift_id = s.id) AS script_count,'
            . ' (SELECT COUNT(*) FROM creadora_shift_script g WHERE g.shift_id = s.id AND g.recorded_at IS NOT NULL) AS recorded_count'
            . ' FROM creadora_shifts s WHERE s.canceled_at IS NULL AND s.starts_at < ? AND s.ends_at > ? ORDER BY s.starts_at, s.id');
        $statement->execute([$end, $start]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $members = $this->membersFor(array_map(static fn (array $row): int => (int) $row['id'], $rows));
        return [
            'from' => $start,
            'to' => $end,
            'shifts' => array_map(fn (array $row): array => $this->projectShift($row, $members[(int) $row['id']] ?? []) + [
                'content_count' => (int) ($row['content_count'] ?? 0),
                'script_count' => (int) ($row['script_count'] ?? 0),
                'recorded_count' => (int) ($row['recorded_count'] ?? 0),
            ], $rows),
            'creadoras' => $this->list()['items'],
            'indicators' => $this->indicators(),
            'log' => $this->log_(min(max($logLimit, 1), 200)),
        ];
    }

    /**
     * Lo que lleva cada creadora en toda la campaña: turnos, asistencias, guiones, guiones ya
     * grabados y contenido registrado. Un guion «para todas» cuenta para cada integrante del turno.
     */
    public function indicators(): array
    {
        $rows = $this->pdo->query("SELECT c.public_id, c.full_name,"
            . " (SELECT COUNT(*) FROM creadora_shift_members m JOIN creadora_shifts s ON s.id = m.shift_id WHERE m.creadora_id = c.id AND s.canceled_at IS NULL) AS shifts,"
            . " (SELECT COUNT(*) FROM creadora_shift_members m JOIN creadora_shifts s ON s.id = m.shift_id WHERE m.creadora_id = c.id AND s.canceled_at IS NULL AND m.attended = 'yes') AS attended,"
            . " (SELECT COUNT(*) FROM creadora_shift_script g JOIN creadora_shifts s ON s.id = g.shift_id WHERE s.canceled_at IS NULL AND (g.creadora_id = c.id"
            . "   OR (g.creadora_id IS NULL AND EXISTS (SELECT 1 FROM creadora_shift_members m WHERE m.shift_id = g.shift_id AND m.creadora_id = c.id)))) AS scripts,"
            . " (SELECT COUNT(*) FROM creadora_shift_script g JOIN creadora_shifts s ON s.id = g.shift_id WHERE s.canceled_at IS NULL AND g.recorded_at IS NOT NULL AND (g.creadora_id = c.id"
            . "   OR (g.creadora_id IS NULL AND EXISTS (SELECT 1 FROM creadora_shift_members m WHERE m.shift_id = g.shift_id AND m.creadora_id = c.id)))) AS recorded,"
            . " (SELECT COUNT(*) FROM creadora_shift_content k JOIN creadora_shifts s ON s.id = k.shift_id WHERE s.canceled_at IS NULL AND k.creadora_id = c.id AND k.kind = 'video') AS videos,"
            . " (SELECT COUNT(*) FROM creadora_shift_content k JOIN creadora_shifts s ON s.id = k.shift_id WHERE s.canceled_at IS NULL AND k.creadora_id = c.id) AS content"
            . " FROM creadoras c WHERE c.status <> 'Retirada' ORDER BY c.full_name")->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map(static fn (array $row): array => [
            'creadora' => $row['public_id'],
            'name' => $row['full_name'],
            'shifts' => (int) $row['shifts'],
            'attended' => (int) $row['attended'],
            'scripts' => (int) $row['scripts'],
            'recorded' => (int) $row['recorded'],
            'videos' => (int) $row['videos'],
            'content' => (int) $row['content'],
        ], $rows);
        // Los totales no suman los guiones «para todas» varias veces: se cuentan una sola.
        $totals = $this->pdo->query("SELECT"
            . " (SELECT COUNT(*) FROM creadora_shifts s WHERE s.canceled_at IS NULL) AS shifts,"
            . " (SELECT COUNT(*) FROM creadora_shift_members m JOIN creadora_shifts s ON s.id = m.shift_id WHERE s.canceled_at IS NULL AND m.attended = 'yes') AS attended,"
            . " (SELECT COUNT(*) FROM creadora_shift_script g JOIN creadora_shifts s ON s.id = g.shift_id WHERE s.canceled_at IS NULL) AS scripts,"
            . " (SELECT COUNT(*) FROM creadora_shift_script g JOIN creadora_shifts s ON s.id = g.shift_id WHERE s.canceled_at IS NULL AND g.recorded_at IS NOT NULL) AS recorded,"
            . " (SELECT COUNT(*) FROM creadora_shift_content k JOIN creadora_shifts s ON s.id = k.shift_id WHERE s.canceled_at IS NULL AND k.kind = 'video') AS videos,"
            . " (SELECT COUNT(*) FROM creadora_shift_content k JOIN creadora_shifts s ON s.id = k.shift_id WHERE s.canceled_at IS NULL) AS content")->fetch(PDO::FETCH_ASSOC) ?: [];
        return ['items' => $items, 'totals' => array_map('intval', $totals)];
    }

    public function createShift(array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $people = $this->resolveMembers($input);
        if ($people === []) throw new InvalidArgumentException('Elige al menos una creadora.');
        [$startsAt, $endsAt] = $this->slot($input['starts_at'] ?? null, $input['ends_at'] ?? null);
        foreach ($people as $person) $this->assertFree($person, $startsAt, $endsAt, null);
        $now = gmdate('Y-m-d H:i:s');
        $publicId = bin2hex(random_bytes(16));
        $insert = $this->pdo->prepare('INSERT INTO creadora_shifts (public_id, creadora_id, starts_at, ends_at, place, note, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $insert->execute([$publicId, $people[0]['id'], $startsAt, $endsAt, $this->text($input['place'] ?? '', 160), $this->text($input['note'] ?? '', 400), $adminId, $now, $now]);
        $shiftId = (int) $this->pdo->lastInsertId();
        foreach ($people as $person) $this->addMember($shiftId, (int) $person['id'], $now);
        $shift = ['id' => $shiftId, 'public_id' => $publicId, 'creadora_id' => (int) $people[0]['id'], 'starts_at' => $startsAt, 'ends_at' => $endsAt];
        $this->log('created', $shift, $this->group($people), $actorName, ['after' => [$startsAt, $endsAt]]);
        $this->audit->log('creadora.shift_created', $adminId, 'creadora_shift', $publicId, [], $ip);
        return $this->shiftByPublicId($publicId);
    }

    /** Mover, estirar, cambiar integrantes o editar: cada diferencia real entra a la bitácora con su nombre. */
    public function updateShift(string $publicId, array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($publicId);
        $current = $this->members((int) $shift['id']);
        $before = array_map(fn (array $member): array => $this->rowById((int) $member['creadora_id']), $current);
        $people = array_key_exists('creadoras', $input) || (array_key_exists('creadora', $input) && (string) $input['creadora'] !== '')
            ? $this->resolveMembers($input, array_map(static fn (array $row): int => (int) $row['id'], $before))
            : $before;
        if ($people === []) throw new InvalidArgumentException('El turno necesita al menos una creadora.');
        [$startsAt, $endsAt] = $this->slot($input['starts_at'] ?? $shift['starts_at'], $input['ends_at'] ?? $shift['ends_at']);
        foreach ($people as $person) $this->assertFree($person, $startsAt, $endsAt, (int) $shift['id']);
        $place = array_key_exists('place', $input) ? $this->text($input['place'], 160) : $shift['place'];
        $note = array_key_exists('note', $input) ? $this->text($input['note'], 400) : $shift['note'];
        $now = gmdate('Y-m-d H:i:s');
        // La asistencia se valida antes de tocar nada, para no dejar el turno a medio guardar.
        if (array_key_exists('attended', $input)) {
            $mark = $input['attended'];
            if ($mark !== null && $mark !== '' && !array_key_exists((string) $mark, self::ATTENDANCE)) throw new InvalidArgumentException('Asistencia no válida.');
        }

        $beforeIds = array_map(static fn (array $row): int => (int) $row['id'], $before);
        $afterIds = array_map(static fn (array $row): int => (int) $row['id'], $people);
        foreach (array_diff($beforeIds, $afterIds) as $gone) {
            $this->pdo->prepare('DELETE FROM creadora_shift_members WHERE shift_id = ? AND creadora_id = ?')->execute([$shift['id'], $gone]);
        }
        foreach (array_diff($afterIds, $beforeIds) as $joined) $this->addMember((int) $shift['id'], $joined, $now);
        $this->pdo->prepare('UPDATE creadora_shifts SET creadora_id = ?, starts_at = ?, ends_at = ?, place = ?, note = ?, updated_at = ? WHERE id = ?')
            ->execute([$afterIds[0], $startsAt, $endsAt, $place, $note, $now, $shift['id']]);

        if (array_key_exists('attended', $input)) {
            $this->markAttendance($this->shiftRow($publicId), $input['attended'], $input['attendance_for'] ?? null, $actorName, $adminId, $ip);
        }

        $group = $this->group($people);
        $moved = $startsAt !== $shift['starts_at'];
        $resized = $this->minutes($startsAt, $endsAt) !== $this->minutes($shift['starts_at'], $shift['ends_at']);
        $context = ['before' => [$shift['starts_at'], $shift['ends_at']], 'after' => [$startsAt, $endsAt]];
        $sameGroup = $beforeIds == $afterIds || (count($beforeIds) === count($afterIds) && array_diff($beforeIds, $afterIds) === []);
        if (!$sameGroup) {
            $this->log('reassigned', $shift, $group, $actorName, $context + ['detail' => 'Antes: ' . $this->group($before)['full_name'] . '.']);
        } else {
            if ($moved) $this->log('moved', $shift, $group, $actorName, $context);
            if ($resized) $this->log('resized', $shift, $group, $actorName, $context);
        }
        if ($place !== $shift['place'] || $note !== $shift['note']) {
            $this->log('edited', $shift, $group, $actorName, $context + ['detail' => 'Se actualizó el lugar o la nota.']);
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
        $this->log('canceled', $shift, $this->shiftGroup($shift), $actorName, ['before' => [$shift['starts_at'], $shift['ends_at']]]);
        $this->audit->log('creadora.shift_canceled', $adminId, 'creadora_shift', $publicId, [], $ip);
        return ['removed' => $publicId, 'log' => $this->log_(50)];
    }

    /**
     * Quién vino y quién no: cada integrante tiene su propia marca. En un turno de una sola
     * creadora no hace falta decir de quién es.
     */
    public function markAttendance(array $shift, mixed $value, mixed $for, string $actorName, ?int $adminId, mixed $ip): void
    {
        $attended = $value === null || $value === '' ? null : (string) $value;
        if ($attended !== null && !array_key_exists($attended, self::ATTENDANCE)) throw new InvalidArgumentException('Asistencia no válida.');
        $member = $this->memberFor($shift, $for, 'Elige de quién es la asistencia.');
        if (($member['attended'] ?? null) === $attended) return;
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('UPDATE creadora_shift_members SET attended = ?, attendance_at = ? WHERE id = ?')
            ->execute([$attended, $attended === null ? null : $now, $member['id']]);
        // La columna del turno refleja a la primera integrante, para lecturas antiguas.
        if ((int) $member['creadora_id'] === (int) $shift['creadora_id']) {
            $this->pdo->prepare('UPDATE creadora_shifts SET attended = ?, attendance_at = ?, updated_at = ? WHERE id = ?')
                ->execute([$attended, $attended === null ? null : $now, $now, $shift['id']]);
        }
        $this->log('attendance', $shift, $this->rowById((int) $member['creadora_id']), $actorName, [
            'detail' => $attended === null ? 'Quitó la marca de asistencia.' : self::ATTENDANCE[$attended] . '.',
        ]);
        $this->audit->log('creadora.attendance_marked', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
    }

    /** Un turno puede dejar varios contenidos: videos, lives, historias o lo que se haya hecho, cada uno de una creadora. */
    public function addContent(string $shiftPublicId, array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        $member = $this->memberFor($shift, $input['creadora'] ?? null, 'Elige qué creadora hizo el contenido.');
        $creadora = $this->rowById((int) $member['creadora_id']);
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
        $this->pdo->prepare('INSERT INTO creadora_shift_content (public_id, shift_id, creadora_id, kind, title, url, note, created_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $shift['id'], $creadora['id'], $kind, $title, $url, $this->text($input['note'] ?? '', 400), $adminId, gmdate('Y-m-d H:i:s')]);
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
        $owner = $row['creadora_id'] === null ? $this->shiftGroup($shift) : $this->rowById((int) $row['creadora_id']);
        $this->log('content', $shift, $owner, $actorName, ['detail' => 'Quitó ' . mb_strtolower(self::CONTENT_KINDS[$row['kind']] ?? 'contenido') . ': ' . $row['title']]);
        $this->audit->log('creadora.content_removed', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    /** El cuaderno: lo que se va a grabar y cómo. Un guion es de una creadora o de todas las del turno. */
    public function addScript(string $shiftPublicId, array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        $values = $this->validateScript($input, $shift);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM creadora_shift_script WHERE shift_id = ?');
        $count->execute([$shift['id']]);
        $total = (int) $count->fetchColumn();
        if ($total >= self::MAX_SCRIPTS) throw new InvalidArgumentException('Este turno ya tiene demasiados guiones.');
        $now = gmdate('Y-m-d H:i:s');
        $publicId = bin2hex(random_bytes(16));
        $this->pdo->prepare('INSERT INTO creadora_shift_script (public_id, shift_id, creadora_id, title, body, reference_url, position, recorded_at, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $shift['id'], $values['creadora_id'], $values['title'], $values['body'], $values['reference_url'], $total + 1, $values['recorded'] ? $now : null, $adminId, $now, $now]);
        $this->log('edited', $shift, $this->scriptOwner($shift, $values['creadora_id']), $actorName, ['detail' => 'Agregó el guion: ' . $values['title']]);
        $this->audit->log('creadora.script_added', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    public function updateScript(string $shiftPublicId, string $scriptPublicId, array $input, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        $current = $this->scriptRow($scriptPublicId, (int) $shift['id']);
        $values = $this->validateScript($input, $shift, $current);
        $recordedAt = $values['recorded'] ? ($current['recorded_at'] ?? gmdate('Y-m-d H:i:s')) : null;
        $this->pdo->prepare('UPDATE creadora_shift_script SET creadora_id = ?, title = ?, body = ?, reference_url = ?, recorded_at = ?, updated_at = ? WHERE id = ?')
            ->execute([$values['creadora_id'], $values['title'], $values['body'], $values['reference_url'], $recordedAt, gmdate('Y-m-d H:i:s'), $current['id']]);
        $owner = $this->scriptOwner($shift, $values['creadora_id']);
        $wasRecorded = ($current['recorded_at'] ?? null) !== null;
        if ($wasRecorded !== $values['recorded']) {
            $this->log('edited', $shift, $owner, $actorName, ['detail' => ($values['recorded'] ? 'Marcó como grabado: ' : 'Quitó la marca de grabado: ') . $values['title']]);
        }
        $changed = $values['title'] !== $current['title'] || $values['body'] !== $current['body'] || $values['reference_url'] !== $current['reference_url']
            || (string) ($values['creadora_id'] ?? '') !== (string) ($current['creadora_id'] ?? '');
        if ($changed) $this->log('edited', $shift, $owner, $actorName, ['detail' => 'Editó el guion: ' . $values['title']]);
        $this->audit->log('creadora.script_updated', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    public function removeScript(string $shiftPublicId, string $scriptPublicId, ?int $adminId, string $actorName, mixed $ip): array
    {
        $shift = $this->shiftRow($shiftPublicId);
        $current = $this->scriptRow($scriptPublicId, (int) $shift['id']);
        $this->pdo->prepare('DELETE FROM creadora_shift_script WHERE id = ?')->execute([$current['id']]);
        $owner = $this->scriptOwner($shift, $current['creadora_id'] === null ? null : (int) $current['creadora_id']);
        $this->log('edited', $shift, $owner, $actorName, ['detail' => 'Quitó el guion: ' . $current['title']]);
        $this->audit->log('creadora.script_removed', $adminId, 'creadora_shift', $shift['public_id'], [], $ip);
        return $this->shiftByPublicId($shiftPublicId);
    }

    private function validateScript(array $input, array $shift, ?array $current = null): array
    {
        $title = $this->text($input['title'] ?? ($current['title'] ?? ''), 200);
        if ($title === '') throw new InvalidArgumentException('Ponle un nombre a la idea.');
        // El guion conserva sus saltos de línea: es un texto largo, no una etiqueta.
        $body = is_string($input['body'] ?? null) ? trim($input['body']) : (string) ($current['body'] ?? '');
        if (mb_strlen($body) > self::MAX_SCRIPT_BODY) throw new InvalidArgumentException('El guion es demasiado largo.');
        $url = $this->text($input['reference_url'] ?? ($current['reference_url'] ?? ''), 500);
        if ($url !== '' && !preg_match('~^https://[^\s]+$~D', $url)) throw new InvalidArgumentException('El enlace debe empezar con https://');
        // Sin creadora elegida, el guion es para todas las del turno.
        if (array_key_exists('creadora', $input)) {
            $owner = (string) ($input['creadora'] ?? '') === '' ? null : (int) $this->memberFor($shift, $input['creadora'], 'Esa creadora no está en el turno.')['creadora_id'];
        } else {
            $owner = $current === null || $current['creadora_id'] === null ? null : (int) $current['creadora_id'];
        }
        $recorded = array_key_exists('recorded', $input) ? $this->flag($input['recorded']) : ($current !== null && ($current['recorded_at'] ?? null) !== null);
        return ['title' => $title, 'body' => $body, 'reference_url' => $url, 'creadora_id' => $owner, 'recorded' => $recorded];
    }

    private function flag(mixed $value): bool
    {
        if (is_bool($value)) return $value;
        if ($value === 1 || $value === 0) return (bool) $value;
        if (in_array($value, ['1', 'true', 'yes'], true)) return true;
        if (in_array($value, ['0', 'false', 'no', ''], true)) return false;
        throw new InvalidArgumentException('Valor no válido.');
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
        $statement = $this->pdo->prepare('SELECT g.public_id, g.title, g.body, g.reference_url, g.recorded_at, g.updated_at, c.public_id AS creadora, c.full_name AS creadora_name'
            . ' FROM creadora_shift_script g LEFT JOIN creadoras c ON c.id = g.creadora_id WHERE g.shift_id = ? ORDER BY g.position, g.id');
        $statement->execute([$shiftId]);
        return array_map(static fn (array $row): array => [
            'public_id' => $row['public_id'],
            'title' => $row['title'],
            'body' => $row['body'],
            'reference_url' => $row['reference_url'],
            'creadora' => $row['creadora'] ?? '',
            'creadora_name' => $row['creadora_name'] ?? '',
            'recorded' => $row['recorded_at'] !== null,
            'recorded_at' => $row['recorded_at'],
            'updated_at' => $row['updated_at'],
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function contentFor(int $shiftId): array
    {
        $statement = $this->pdo->prepare('SELECT k.public_id, k.kind, k.title, k.url, k.note, k.created_at, c.public_id AS creadora, c.full_name AS creadora_name'
            . ' FROM creadora_shift_content k LEFT JOIN creadoras c ON c.id = k.creadora_id WHERE k.shift_id = ? ORDER BY k.created_at, k.id');
        $statement->execute([$shiftId]);
        return array_map(static fn (array $row): array => [
            'public_id' => $row['public_id'],
            'kind' => $row['kind'],
            'kind_label' => self::CONTENT_KINDS[$row['kind']] ?? $row['kind'],
            'title' => $row['title'],
            'url' => $row['url'],
            'note' => $row['note'],
            'creadora' => $row['creadora'] ?? '',
            'creadora_name' => $row['creadora_name'] ?? '',
            'created_at' => $row['created_at'],
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    /** Los turnos de la creadora autenticada, de hoy en adelante, incluidos los que comparte. */
    public function shiftsForAccount(int $accountId): array
    {
        $own = $this->forAccount($accountId);
        if ($own === null) return ['shifts' => []];
        $statement = $this->pdo->prepare('SELECT s.public_id, s.starts_at, s.ends_at, s.place, s.note, m.attended FROM creadora_shifts s'
            . ' JOIN creadora_shift_members m ON m.shift_id = s.id JOIN creadoras c ON c.id = m.creadora_id'
            . ' WHERE c.account_id = ? AND s.canceled_at IS NULL AND s.ends_at >= ? ORDER BY s.starts_at');
        $statement->execute([$accountId, substr($this->localNow(), 0, 10) . ' 00:00:00']);
        return ['shifts' => $statement->fetchAll(PDO::FETCH_ASSOC)];
    }

    // --- Integrantes del turno -----------------------------------------------------------------

    /**
     * Quiénes van al turno. Acepta la lista `creadoras` o, por compatibilidad, una sola `creadora`.
     * Las que ya estaban pueden seguir aunque hoy estén retiradas; las nuevas no.
     */
    private function resolveMembers(array $input, array $keep = []): array
    {
        $ids = array_key_exists('creadoras', $input) ? $input['creadoras'] : [$input['creadora'] ?? ''];
        if (!is_array($ids)) throw new InvalidArgumentException('La lista de creadoras no es válida.');
        $people = [];
        foreach ($ids as $id) {
            if (!is_string($id)) throw new InvalidArgumentException('La lista de creadoras no es válida.');
            if (trim($id) === '') continue;
            $row = $this->rowByPublicId(trim($id));
            if (isset($people[(int) $row['id']])) continue;
            if ($row['status'] === 'Retirada' && !in_array((int) $row['id'], $keep, true)) throw new InvalidArgumentException('Esa creadora está retirada.');
            $people[(int) $row['id']] = $row;
        }
        if (count($people) > self::MAX_MEMBERS) throw new InvalidArgumentException('Un turno admite hasta ' . self::MAX_MEMBERS . ' creadoras.');
        return array_values($people);
    }

    private function addMember(int $shiftId, int $creadoraId, string $now): void
    {
        $this->pdo->prepare('INSERT INTO creadora_shift_members (shift_id, creadora_id, created_at) VALUES (?, ?, ?)')->execute([$shiftId, $creadoraId, $now]);
    }

    private function members(int $shiftId): array
    {
        return $this->membersFor([$shiftId])[$shiftId] ?? [];
    }

    /** Las integrantes de varios turnos a la vez, en el orden en que se sumaron. */
    private function membersFor(array $shiftIds): array
    {
        if ($shiftIds === []) return [];
        $marks = implode(', ', array_fill(0, count($shiftIds), '?'));
        $statement = $this->pdo->prepare('SELECT m.id, m.shift_id, m.creadora_id, m.attended, m.attendance_at, c.public_id, c.full_name'
            . " FROM creadora_shift_members m JOIN creadoras c ON c.id = m.creadora_id WHERE m.shift_id IN ($marks) ORDER BY m.shift_id, m.id");
        $statement->execute(array_values($shiftIds));
        $grouped = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) $grouped[(int) $row['shift_id']][] = $row;
        return $grouped;
    }

    /** La integrante a la que se refiere un pedido; si el turno es de una sola, se sobreentiende. */
    private function memberFor(array $shift, mixed $publicId, string $message): array
    {
        $members = $this->members((int) $shift['id']);
        $wanted = is_string($publicId) ? trim($publicId) : '';
        if ($wanted === '') {
            if (count($members) === 1) return $members[0];
            throw new InvalidArgumentException($message);
        }
        foreach ($members as $member) if ($member['public_id'] === $wanted) return $member;
        throw new InvalidArgumentException('Esa creadora no está en el turno.');
    }

    /** Para la bitácora: el nombre de todas las integrantes juntas. */
    private function group(array $people): array
    {
        return ['id' => $people[0]['id'] ?? null, 'full_name' => implode(', ', array_column($people, 'full_name'))];
    }

    private function shiftGroup(array $shift): array
    {
        $members = $this->members((int) $shift['id']);
        return $members === [] ? $this->rowById((int) $shift['creadora_id']) : $this->group(array_map(static fn (array $member): array => ['id' => $member['creadora_id'], 'full_name' => $member['full_name']], $members));
    }

    private function scriptOwner(array $shift, ?int $creadoraId): array
    {
        return $creadoraId === null ? $this->shiftGroup($shift) : $this->rowById($creadoraId);
    }

    private function projectShift(array $row, array $members): array
    {
        $people = array_map(static fn (array $member): array => [
            'public_id' => $member['public_id'],
            'name' => $member['full_name'],
            'attended' => $member['attended'],
            'attendance_at' => $member['attendance_at'],
        ], $members);
        $marks = array_column($people, 'attended');
        return [
            'public_id' => $row['public_id'],
            'creadora' => $people[0]['public_id'] ?? '',
            'creadoras' => $people,
            'name' => implode(', ', array_column($people, 'name')),
            'starts_at' => $row['starts_at'],
            'ends_at' => $row['ends_at'],
            'place' => $row['place'],
            'note' => $row['note'],
            // Resumen del turno: «yes» si vinieron todas, «no» si no vino ninguna, «partial» si faltó alguna.
            'attended' => $this->attendanceSummary($marks),
            'attended_count' => count(array_filter($marks, static fn ($mark): bool => $mark === 'yes')),
            'attendance_at' => ($stamps = array_filter(array_column($people, 'attendance_at'))) === [] ? null : max($stamps),
        ];
    }

    private function attendanceSummary(array $marks): ?string
    {
        $marked = array_values(array_filter($marks, static fn ($mark): bool => $mark !== null));
        if ($marked === []) return null;
        if (count($marked) === count($marks) && !in_array('no', $marked, true)) return 'yes';
        if (!in_array('yes', $marked, true) && count($marked) === count($marks)) return 'no';
        return 'partial';
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
    private function assertFree(array $creadora, string $startsAt, string $endsAt, ?int $exceptId): void
    {
        $sql = 'SELECT s.public_id FROM creadora_shifts s JOIN creadora_shift_members m ON m.shift_id = s.id'
            . ' WHERE m.creadora_id = ? AND s.canceled_at IS NULL AND s.starts_at < ? AND s.ends_at > ?';
        $values = [$creadora['id'], $endsAt, $startsAt];
        if ($exceptId !== null) { $sql .= ' AND s.id <> ?'; $values[] = $exceptId; }
        $statement = $this->pdo->prepare($sql . ' LIMIT 1');
        $statement->execute($values);
        if ($statement->fetch(PDO::FETCH_ASSOC) !== false) throw new DuplicateRegistration($creadora['full_name'] . ' ya tiene un turno a esa hora.');
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

    /** Un turno completo, con sus guiones y su contenido: lo que abre el diálogo del calendario. */
    public function shift(string $publicId): array
    {
        return $this->shiftByPublicId($publicId);
    }

    private function shiftByPublicId(string $publicId): array
    {
        $row = $this->shiftRow($publicId);
        return ['shift' => $this->projectShift($row, $this->members((int) $row['id'])) + [
            'content' => $this->contentFor((int) $row['id']),
            'scripts' => $this->scriptsFor((int) $row['id']),
        ], 'log' => $this->log_(50)];
    }
}
