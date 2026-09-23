<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use PDO;

require_once __DIR__ . '/Audit.php';

/**
 * Noticias de la campaña: el tema central de cada tramo de fechas y los avisos puntuales.
 * Todos los paneles lo muestran arriba para que el equipo sepa qué toca grabar esta semana.
 */
final class NewsRepository
{
    private const MAX_PHASES = 40;
    private const MAX_NOTICES = 20;
    /** Las fechas de la campaña viven en 2026 y algo de 2027 por si se extiende el cierre. */
    private const MIN_DAY = '2026-01-01';
    private const MAX_DAY = '2027-12-31';

    public function __construct(private readonly PDO $pdo, private readonly Audit $audit)
    {
    }

    /** Lo que necesita la banda superior: hoy, el tramo en curso, el que sigue y todo el mapa. */
    public function overview(): array
    {
        $today = $this->today();
        $phases = $this->phases();
        $current = null;
        $next = null;
        foreach ($phases as $phase) {
            if ($current === null && $phase['starts_on'] <= $today && $today <= $phase['ends_on']) { $current = $phase; continue; }
            if ($next === null && $phase['starts_on'] > $today) $next = $phase;
        }
        // Si hoy cae fuera de todo tramo, el siguiente sigue siendo el próximo que empiece.
        if ($current === null) foreach ($phases as $phase) if ($phase['starts_on'] > $today) { $next = $next ?? $phase; break; }
        return ['today' => $today, 'current' => $current, 'next' => $next, 'phases' => $phases,
            'notices' => $this->notices($today), 'all_notices' => $this->allNotices()];
    }

    public function phases(): array
    {
        $statement = $this->pdo->query('SELECT public_id, starts_on, ends_on, title, detail, accent, position FROM campaign_phases ORDER BY starts_on, position, id');
        return array_map(static fn (array $row): array => [
            'public_id' => $row['public_id'],
            'starts_on' => $row['starts_on'],
            'ends_on' => $row['ends_on'],
            'title' => $row['title'],
            'detail' => $row['detail'],
            'accent' => $row['accent'],
            'position' => (int) $row['position'],
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    /** Los avisos vigentes hoy; los que tienen fechas se apagan solos al pasar. */
    public function notices(?string $today = null): array
    {
        $today ??= $this->today();
        $statement = $this->pdo->prepare('SELECT public_id, body, starts_on, ends_on, created_at FROM campaign_notices'
            . ' WHERE (starts_on IS NULL OR starts_on <= ?) AND (ends_on IS NULL OR ends_on >= ?) ORDER BY created_at DESC, id DESC LIMIT ' . self::MAX_NOTICES);
        $statement->execute([$today, $today]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function allNotices(): array
    {
        $statement = $this->pdo->query('SELECT public_id, body, starts_on, ends_on, created_at FROM campaign_notices ORDER BY created_at DESC, id DESC LIMIT ' . self::MAX_NOTICES);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function createPhase(array $input, ?int $adminId, mixed $ip): array
    {
        $values = $this->validatePhase($input);
        $count = (int) $this->pdo->query('SELECT COUNT(*) FROM campaign_phases')->fetchColumn();
        if ($count >= self::MAX_PHASES) throw new InvalidArgumentException('Ya hay demasiados tramos en el mapa.');
        $now = gmdate('Y-m-d H:i:s');
        $publicId = bin2hex(random_bytes(16));
        $this->pdo->prepare('INSERT INTO campaign_phases (public_id, starts_on, ends_on, title, detail, accent, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $values['starts_on'], $values['ends_on'], $values['title'], $values['detail'], $values['accent'], $count + 1, $now, $now]);
        $this->audit->log('campaign.phase_created', $adminId, 'campaign_phase', $publicId, [], $ip);
        return $this->overview();
    }

    public function updatePhase(string $publicId, array $input, ?int $adminId, mixed $ip): array
    {
        $current = $this->phaseRow($publicId);
        $values = $this->validatePhase($input, $current);
        $this->pdo->prepare('UPDATE campaign_phases SET starts_on = ?, ends_on = ?, title = ?, detail = ?, accent = ?, updated_at = ? WHERE id = ?')
            ->execute([$values['starts_on'], $values['ends_on'], $values['title'], $values['detail'], $values['accent'], gmdate('Y-m-d H:i:s'), $current['id']]);
        $this->audit->log('campaign.phase_updated', $adminId, 'campaign_phase', $publicId, [], $ip);
        return $this->overview();
    }

    public function deletePhase(string $publicId, ?int $adminId, mixed $ip): array
    {
        $current = $this->phaseRow($publicId);
        $this->pdo->prepare('DELETE FROM campaign_phases WHERE id = ?')->execute([$current['id']]);
        $this->audit->log('campaign.phase_deleted', $adminId, 'campaign_phase', $publicId, [], $ip);
        return $this->overview();
    }

    public function createNotice(array $input, ?int $adminId, mixed $ip): array
    {
        $body = $this->text($input['body'] ?? '', 400);
        if ($body === '') throw new InvalidArgumentException('Escribe el aviso.');
        $starts = $this->optionalDay($input['starts_on'] ?? '');
        $ends = $this->optionalDay($input['ends_on'] ?? '');
        if ($starts !== null && $ends !== null && $ends < $starts) throw new InvalidArgumentException('La fecha final no puede ser anterior a la inicial.');
        $publicId = bin2hex(random_bytes(16));
        $this->pdo->prepare('INSERT INTO campaign_notices (public_id, body, starts_on, ends_on, created_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $body, $starts, $ends, $adminId, gmdate('Y-m-d H:i:s')]);
        $this->audit->log('campaign.notice_created', $adminId, 'campaign_notice', $publicId, [], $ip);
        return $this->overview();
    }

    public function deleteNotice(string $publicId, ?int $adminId, mixed $ip): array
    {
        if (!preg_match('~^[a-f0-9]{32}$~D', $publicId)) throw new InvalidArgumentException('Aviso no encontrado.');
        $statement = $this->pdo->prepare('SELECT id FROM campaign_notices WHERE public_id = ?');
        $statement->execute([$publicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new InvalidArgumentException('Aviso no encontrado.');
        $this->pdo->prepare('DELETE FROM campaign_notices WHERE id = ?')->execute([$row['id']]);
        $this->audit->log('campaign.notice_deleted', $adminId, 'campaign_notice', $publicId, [], $ip);
        return $this->overview();
    }

    // --- Interno -----------------------------------------------------------------------------

    /** El día de hoy en Ecuador: la banda habla del calendario del equipo, no del de UTC. */
    private function today(): string
    {
        return gmdate('Y-m-d', strtotime('-5 hours', time()));
    }

    private function validatePhase(array $input, ?array $current = null): array
    {
        $title = $this->text($input['title'] ?? ($current['title'] ?? ''), 160);
        if ($title === '') throw new InvalidArgumentException('Escribe el tema del tramo.');
        $starts = $this->day($input['starts_on'] ?? ($current['starts_on'] ?? ''));
        $ends = $this->day($input['ends_on'] ?? ($current['ends_on'] ?? ''));
        if ($ends < $starts) throw new InvalidArgumentException('La fecha final no puede ser anterior a la inicial.');
        $accent = $this->text($input['accent'] ?? ($current['accent'] ?? '#94165e'), 7);
        if (!preg_match('~^#[0-9a-fA-F]{6}$~D', $accent)) throw new InvalidArgumentException('El color no es válido.');
        return [
            'title' => $title,
            'detail' => $this->text($input['detail'] ?? ($current['detail'] ?? ''), 300),
            'starts_on' => $starts,
            'ends_on' => $ends,
            'accent' => strtolower($accent),
        ];
    }

    private function day(mixed $value): string
    {
        $text = is_string($value) ? trim($value) : '';
        if (!preg_match('~^(\d{4})-(\d{2})-(\d{2})$~D', $text, $parts) || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
            throw new InvalidArgumentException('Fecha no válida.');
        }
        if ($text < self::MIN_DAY || $text > self::MAX_DAY) throw new InvalidArgumentException('La fecha está fuera del rango de la campaña.');
        return $text;
    }

    private function optionalDay(mixed $value): ?string
    {
        $text = is_string($value) ? trim($value) : '';
        return $text === '' ? null : $this->day($text);
    }

    private function text(mixed $value, int $max): string
    {
        $text = is_string($value) ? trim(preg_replace('/\s+/u', ' ', $value) ?? '') : '';
        return mb_substr($text, 0, $max);
    }

    private function phaseRow(string $publicId): array
    {
        if (!preg_match('~^[a-f0-9]{32}$~D', $publicId)) throw new InvalidArgumentException('Tramo no encontrado.');
        $statement = $this->pdo->prepare('SELECT * FROM campaign_phases WHERE public_id = ?');
        $statement->execute([$publicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new InvalidArgumentException('Tramo no encontrado.');
        return $row;
    }
}
