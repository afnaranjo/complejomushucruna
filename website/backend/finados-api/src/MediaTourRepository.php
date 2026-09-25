<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;

/** Dos citas de la misma persona se cruzan en el horario. */
final class MediaTourConflict extends \RuntimeException {}

/**
 * Gira de medios: las personas que visitan los medios (voceros, artistas, dirección) y cada cita
 * en un medio de Seguimiento, con día, hora, tipo y estado. Una cita puede llevar a varias personas;
 * una misma persona no puede estar en dos citas a la misma hora.
 */
final class MediaTourRepository
{
    public const KINDS = ['entrevista' => 'Entrevista', 'en_vivo' => 'En vivo', 'grabacion' => 'Grabación', 'visita' => 'Visita', 'rueda' => 'Rueda de prensa', 'otro' => 'Otro'];
    public const VISIT_STATUSES = ['programada' => 'Programada', 'confirmada' => 'Confirmada', 'realizada' => 'Realizada', 'no_se_dio' => 'No se dio'];
    public const PERSON_STATUSES = ['Activa', 'Retirada'];
    private const ARCHIVED_MEDIA = 'Eliminado';
    private const MAX_RANGE_DAYS = 62;

    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, private readonly Audit $audit) {}

    /** Todo lo que dibuja la pantalla para un rango: personas, citas y la lista de medios de Seguimiento. */
    public function calendar(string $from, string $to): array
    {
        [$from, $to] = self::range($from, $to);
        $visits = $this->pdo->prepare('SELECT v.*, m.public_id AS media_public_id, m.media_name, m.city AS media_city, m.frequency_channel FROM media_tour_visits v JOIN media_profiles m ON m.id = v.profile_id WHERE v.canceled_at IS NULL AND v.starts_at >= ? AND v.starts_at < ? ORDER BY v.starts_at, v.id');
        $visits->execute([$from . ' 00:00:00', $to . ' 00:00:00']);
        $rows = $visits->fetchAll(PDO::FETCH_ASSOC);
        return [
            'people' => $this->people(),
            'visits' => array_map(fn (array $row): array => $this->visitProjection($row), $rows),
            'media' => $this->mediaOptions(),
            'kinds' => self::KINDS,
            'statuses' => self::VISIT_STATUSES,
            'totals' => $this->totals(),
        ];
    }

    public function people(): array
    {
        $rows = $this->pdo->query("SELECT p.*, (SELECT COUNT(*) FROM media_tour_visit_people vp JOIN media_tour_visits v ON v.id = vp.visit_id WHERE vp.person_id = p.id AND v.canceled_at IS NULL) AS visits_count, (SELECT COUNT(*) FROM media_tour_visit_people vp JOIN media_tour_visits v ON v.id = vp.visit_id WHERE vp.person_id = p.id AND v.canceled_at IS NULL AND v.status = 'realizada') AS done_count FROM media_tour_people p WHERE p.status <> 'Retirada' ORDER BY p.full_name")->fetchAll(PDO::FETCH_ASSOC);
        return array_map(fn (array $row): array => [
            'public_id' => $row['public_id'], 'name' => $row['full_name'], 'role' => $row['role'],
            'phone' => $row['phone_enc'] ? $this->crypto->decrypt($row['phone_enc']) : '', 'note' => $row['note'], 'status' => $row['status'],
            'visits_count' => (int) $row['visits_count'], 'done_count' => (int) $row['done_count'],
        ], $rows);
    }

    /** Los medios de Seguimiento que se pueden visitar (todos menos los retirados). */
    private function mediaOptions(): array
    {
        $query = $this->pdo->prepare('SELECT public_id, media_name, city, frequency_channel FROM media_profiles WHERE status <> ? ORDER BY media_name');
        $query->execute([self::ARCHIVED_MEDIA]);
        return array_map(static fn (array $row): array => ['public_id' => $row['public_id'], 'name' => $row['media_name'], 'city' => (string) $row['city'], 'frequency' => (string) $row['frequency_channel']], $query->fetchAll(PDO::FETCH_ASSOC));
    }

    private function totals(): array
    {
        $count = fn (string $where): int => (int) $this->pdo->query('SELECT COUNT(*) FROM media_tour_visits WHERE canceled_at IS NULL' . $where)->fetchColumn();
        return [
            'visits' => $count(''), 'done' => $count(" AND status = 'realizada'"), 'confirmed' => $count(" AND status = 'confirmada'"),
            'media' => (int) $this->pdo->query('SELECT COUNT(DISTINCT profile_id) FROM media_tour_visits WHERE canceled_at IS NULL')->fetchColumn(),
            'people' => (int) $this->pdo->query("SELECT COUNT(*) FROM media_tour_people WHERE status <> 'Retirada'")->fetchColumn(),
        ];
    }

    public function createPerson(array $input, int $actorId, string $ip): array
    {
        $data = self::personData($input);
        $publicId = bin2hex(random_bytes(16));
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('INSERT INTO media_tour_people (public_id, full_name, role, phone_enc, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $data['name'], $data['role'], $data['phone'] === '' ? null : $this->crypto->encrypt($data['phone']), $data['note'], 'Activa', $now, $now]);
        $this->audit->log('media.tour_person_created', $actorId, 'media_tour_person', $publicId, [], $ip);
        return $this->person($publicId);
    }

    public function updatePerson(string $publicId, array $input, int $actorId, string $ip): array
    {
        $this->personId($publicId);
        $data = self::personData($input);
        $this->pdo->prepare('UPDATE media_tour_people SET full_name = ?, role = ?, phone_enc = ?, note = ?, updated_at = ? WHERE public_id = ?')
            ->execute([$data['name'], $data['role'], $data['phone'] === '' ? null : $this->crypto->encrypt($data['phone']), $data['note'], gmdate('Y-m-d H:i:s'), $publicId]);
        $this->audit->log('media.tour_person_updated', $actorId, 'media_tour_person', $publicId, [], $ip);
        return $this->person($publicId);
    }

    /** Retirar no borra: la persona deja de aparecer y conserva su historial de citas. */
    public function retirePerson(string $publicId, int $actorId, string $ip): void
    {
        $this->personId($publicId);
        $this->pdo->prepare("UPDATE media_tour_people SET status = 'Retirada', updated_at = ? WHERE public_id = ?")->execute([gmdate('Y-m-d H:i:s'), $publicId]);
        $this->audit->log('media.tour_person_retired', $actorId, 'media_tour_person', $publicId, [], $ip);
    }

    public function createVisit(array $input, int $actorId, string $ip): array
    {
        $data = $this->visitData($input, null);
        $publicId = bin2hex(random_bytes(16));
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->beginTransaction();
        try {
            $this->assertFree($data['person_ids'], $data['starts_at'], $data['ends_at'], null);
            $this->pdo->prepare('INSERT INTO media_tour_visits (public_id, profile_id, starts_at, ends_at, kind, status, place, note, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$publicId, $data['profile_id'], $data['starts_at'], $data['ends_at'], $data['kind'], $data['status'], $data['place'], $data['note'], $actorId, $now, $now]);
            $visitId = (int) $this->pdo->lastInsertId();
            $this->setMembers($visitId, $data['person_ids']);
            $this->audit->log('media.tour_visit_created', $actorId, 'media_tour_visit', $publicId, ['count' => count($data['person_ids'])], $ip);
            $this->pdo->commit();
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
        return $this->visit($publicId);
    }

    /** Cambio parcial: mover, estirar, cambiar personas, medio, tipo, estado, lugar o nota. */
    public function updateVisit(string $publicId, array $input, int $actorId, string $ip): array
    {
        $current = $this->visitRow($publicId);
        $merged = [
            'media' => $input['media'] ?? $current['media_public_id'],
            'people' => $input['people'] ?? $this->memberIds((int) $current['id']),
            'starts_at' => $input['starts_at'] ?? substr((string) $current['starts_at'], 0, 16),
            'ends_at' => $input['ends_at'] ?? substr((string) $current['ends_at'], 0, 16),
            'kind' => $input['kind'] ?? $current['kind'], 'status' => $input['status'] ?? $current['status'],
            'place' => $input['place'] ?? $current['place'], 'note' => $input['note'] ?? $current['note'],
        ];
        $data = $this->visitData($merged, (int) $current['id']);
        $this->pdo->beginTransaction();
        try {
            $this->assertFree($data['person_ids'], $data['starts_at'], $data['ends_at'], (int) $current['id']);
            $this->pdo->prepare('UPDATE media_tour_visits SET profile_id = ?, starts_at = ?, ends_at = ?, kind = ?, status = ?, place = ?, note = ?, updated_at = ? WHERE id = ?')
                ->execute([$data['profile_id'], $data['starts_at'], $data['ends_at'], $data['kind'], $data['status'], $data['place'], $data['note'], gmdate('Y-m-d H:i:s'), (int) $current['id']]);
            $this->setMembers((int) $current['id'], $data['person_ids']);
            $this->audit->log('media.tour_visit_updated', $actorId, 'media_tour_visit', $publicId, ['count' => count($data['person_ids'])], $ip);
            $this->pdo->commit();
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
        return $this->visit($publicId);
    }

    /** Quitar una cita no la borra: queda marcada y deja de verse en el calendario. */
    public function cancelVisit(string $publicId, int $actorId, string $ip): void
    {
        $this->visitRow($publicId);
        $this->pdo->prepare('UPDATE media_tour_visits SET canceled_at = ?, updated_at = ? WHERE public_id = ?')->execute([gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'), $publicId]);
        $this->audit->log('media.tour_visit_canceled', $actorId, 'media_tour_visit', $publicId, [], $ip);
    }

    public function visit(string $publicId): array
    {
        $query = $this->pdo->prepare('SELECT v.*, m.public_id AS media_public_id, m.media_name, m.city AS media_city, m.frequency_channel FROM media_tour_visits v JOIN media_profiles m ON m.id = v.profile_id WHERE v.public_id = ? AND v.canceled_at IS NULL');
        $query->execute([$publicId]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new OutOfBoundsException();
        return $this->visitProjection($row);
    }

    private function visitProjection(array $row): array
    {
        $people = $this->pdo->prepare('SELECT p.public_id, p.full_name, p.role FROM media_tour_visit_people vp JOIN media_tour_people p ON p.id = vp.person_id WHERE vp.visit_id = ? ORDER BY p.full_name');
        $people->execute([(int) $row['id']]);
        return [
            'public_id' => $row['public_id'],
            'starts_at' => substr((string) $row['starts_at'], 0, 16), 'ends_at' => substr((string) $row['ends_at'], 0, 16),
            'kind' => $row['kind'], 'status' => $row['status'], 'place' => $row['place'], 'note' => $row['note'],
            'media' => ['public_id' => $row['media_public_id'], 'name' => $row['media_name'], 'city' => (string) $row['media_city'], 'frequency' => (string) $row['frequency_channel']],
            'people' => array_map(static fn (array $person): array => ['public_id' => $person['public_id'], 'name' => $person['full_name'], 'role' => $person['role']], $people->fetchAll(PDO::FETCH_ASSOC)),
        ];
    }

    private function person(string $publicId): array
    {
        foreach ($this->people() as $person) if ($person['public_id'] === $publicId) return $person;
        throw new OutOfBoundsException();
    }

    private function personId(string $publicId): int
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new OutOfBoundsException();
        $query = $this->pdo->prepare("SELECT id FROM media_tour_people WHERE public_id = ? AND status <> 'Retirada'");
        $query->execute([$publicId]);
        $id = $query->fetchColumn();
        if ($id === false) throw new OutOfBoundsException();
        return (int) $id;
    }

    private function visitRow(string $publicId): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new OutOfBoundsException();
        $query = $this->pdo->prepare('SELECT v.*, m.public_id AS media_public_id FROM media_tour_visits v JOIN media_profiles m ON m.id = v.profile_id WHERE v.public_id = ? AND v.canceled_at IS NULL');
        $query->execute([$publicId]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new OutOfBoundsException();
        return $row;
    }

    private function memberIds(int $visitId): array
    {
        $query = $this->pdo->prepare('SELECT p.public_id FROM media_tour_visit_people vp JOIN media_tour_people p ON p.id = vp.person_id WHERE vp.visit_id = ?');
        $query->execute([$visitId]);
        return $query->fetchAll(PDO::FETCH_COLUMN);
    }

    private function setMembers(int $visitId, array $personIds): void
    {
        $this->pdo->prepare('DELETE FROM media_tour_visit_people WHERE visit_id = ?')->execute([$visitId]);
        $insert = $this->pdo->prepare('INSERT INTO media_tour_visit_people (visit_id, person_id) VALUES (?, ?)');
        foreach ($personIds as $personId) $insert->execute([$visitId, $personId]);
    }

    /** Una persona no puede estar en dos medios a la vez. */
    private function assertFree(array $personIds, string $startsAt, string $endsAt, ?int $ignoreVisit): void
    {
        if ($personIds === []) return;
        $marks = implode(',', array_fill(0, count($personIds), '?'));
        $query = $this->pdo->prepare('SELECT COUNT(*) FROM media_tour_visits v JOIN media_tour_visit_people vp ON vp.visit_id = v.id WHERE v.canceled_at IS NULL AND vp.person_id IN (' . $marks . ') AND v.starts_at < ? AND v.ends_at > ?' . ($ignoreVisit === null ? '' : ' AND v.id <> ?'));
        $query->execute([...$personIds, $endsAt, $startsAt, ...($ignoreVisit === null ? [] : [$ignoreVisit])]);
        if ((int) $query->fetchColumn() > 0) throw new MediaTourConflict();
    }

    private function visitData(array $input, ?int $visitId): array
    {
        $media = $input['media'] ?? null;
        if (!is_string($media) || preg_match('/^[a-f0-9]{32}$/D', $media) !== 1) throw new InvalidArgumentException();
        $profile = $this->pdo->prepare('SELECT id FROM media_profiles WHERE public_id = ? AND status <> ?');
        $profile->execute([$media, self::ARCHIVED_MEDIA]);
        $profileId = $profile->fetchColumn();
        if ($profileId === false) throw new InvalidArgumentException();
        $people = $input['people'] ?? [];
        if (!is_array($people) || !array_is_list($people) || count($people) < 1 || count($people) > 20) throw new InvalidArgumentException();
        $personIds = [];
        foreach (array_unique($people) as $person) {
            if (!is_string($person)) throw new InvalidArgumentException();
            try { $personIds[] = $this->personId($person); } catch (OutOfBoundsException) { throw new InvalidArgumentException(); }
        }
        $starts = self::moment($input['starts_at'] ?? null);
        $ends = self::moment($input['ends_at'] ?? null);
        if (substr($starts, 0, 10) !== substr($ends, 0, 10) || $ends <= $starts
            || (strtotime($ends) - strtotime($starts)) < 15 * 60) throw new InvalidArgumentException();
        $kind = $input['kind'] ?? 'entrevista';
        $status = $input['status'] ?? 'programada';
        if (!is_string($kind) || !isset(self::KINDS[$kind]) || !is_string($status) || !isset(self::VISIT_STATUSES[$status])) throw new InvalidArgumentException();
        return ['profile_id' => (int) $profileId, 'person_ids' => $personIds, 'starts_at' => $starts, 'ends_at' => $ends, 'kind' => $kind, 'status' => $status,
            'place' => self::text($input['place'] ?? '', 160), 'note' => self::text($input['note'] ?? '', 1000)];
    }

    private static function personData(array $input): array
    {
        $name = self::text($input['name'] ?? null, 160);
        if ($name === '') throw new InvalidArgumentException();
        $phone = self::text($input['phone'] ?? '', 32);
        if ($phone !== '' && preg_match('/^[0-9+() -]{6,32}$/D', $phone) !== 1) throw new InvalidArgumentException();
        return ['name' => $name, 'role' => self::text($input['role'] ?? '', 120), 'phone' => $phone, 'note' => self::text($input['note'] ?? '', 1000)];
    }

    /** «2026-10-30 09:15», en hora de Ecuador y sin conversión, como los turnos de Creadoras. */
    private static function moment(mixed $value): string
    {
        if (!is_string($value) || preg_match('/^(\d{4})-(\d{2})-(\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)$/D', $value, $m) !== 1 || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) throw new InvalidArgumentException();
        return sprintf('%s-%s-%s %s:%s:00', $m[1], $m[2], $m[3], $m[4], $m[5]);
    }

    private static function range(string $from, string $to): array
    {
        foreach ([$from, $to] as $day) {
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/D', $day) !== 1 || !checkdate((int) substr($day, 5, 2), (int) substr($day, 8, 2), (int) substr($day, 0, 4))) throw new InvalidArgumentException();
        }
        if ($to <= $from || (strtotime($to) - strtotime($from)) / 86400 > self::MAX_RANGE_DAYS) throw new InvalidArgumentException();
        return [$from, $to];
    }

    private static function text(mixed $value, int $max): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $value = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '');
        if (mb_strlen($value) > $max) throw new InvalidArgumentException();
        return $value;
    }
}
