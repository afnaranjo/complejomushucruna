<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;

/**
 * Invitaciones digitales separadas por evento. Las rutas anteriores siguen apuntando a Guaynaa.
 *  - «Creadores»: coordinación escribe los nombres y cada uno recibe su enlace personal para confirmar.
 *  - «Nuevos creadores»: un enlace general; la persona deja sus datos, confirma y coordinación la aprueba.
 * Nada se borra: retirar una invitación la archiva y conserva su respuesta.
 */
/** El plazo para confirmar ya terminó: la respuesta no se guarda. */
final class InvitationClosed extends \RuntimeException {}

final class InfluencerRepository
{
    /** Hasta cuándo se puede confirmar cada evento (UTC). La inauguración cierra el lunes 26 de octubre a las 09:00 de Ecuador. */
    public const RSVP_DEADLINES = ['inauguracion' => '2026-10-26 14:00:00'];

    public const DEFAULT_EVENT = 'guaynaa';
    public const KINDS = ['creador', 'nuevo', 'vocero'];
    public const MESSAGE_VARIANTS = ['apoyo', 'registro'];
    private const EVENT_KINDS = [
        'guaynaa' => ['creador', 'nuevo'],
        'inauguracion' => ['vocero', 'creador'],
    ];
    public const RESPONSES = ['pendiente', 'si', 'no'];
    public const APPROVALS = ['aprobado', 'pendiente', 'rechazado'];
    private const MAX_BULK = 200;
    /** Código del enlace: 10 letras y números sin los que se confunden (l, i, o, 0, 1). Los de 32 caracteres anteriores siguen sirviendo. */
    public const TOKEN_PATTERN = '/^(?:[a-f0-9]{32}|[a-hjkmnp-z2-9]{10})$/D';
    private const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

    /** $now permite fijar el reloj en las pruebas; en producción es la hora actual. */
    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, private readonly Audit $audit, private readonly ?int $now = null) {}

    /** «2026-10-26T09:00:00-05:00» para mostrar el contador; null si el evento no tiene plazo. */
    public static function rsvpDeadline(string $slug): ?string
    {
        $deadline = self::RSVP_DEADLINES[$slug] ?? null;
        return $deadline === null ? null : gmdate('Y-m-d\\TH:i:s', strtotime($deadline . ' UTC') - 5 * 3600) . '-05:00';
    }

    private function rsvpClosed(string $slug): bool
    {
        $deadline = self::RSVP_DEADLINES[$slug] ?? null;
        return $deadline !== null && ($this->now ?? time()) >= strtotime($deadline . ' UTC');
    }

    /* ---------- Evento ---------- */

    public function event(string $slug = self::DEFAULT_EVENT): array
    {
        $row = $this->eventRow($slug);
        return [
            'slug' => (string) $row['slug'], 'title' => (string) $row['title'], 'date' => substr((string) $row['event_date'], 0, 10), 'time' => (string) $row['event_time'],
            'place' => (string) $row['place'], 'details' => (string) $row['details'],
            'rsvp_deadline' => self::rsvpDeadline((string) $row['slug']), 'rsvp_closed' => $this->rsvpClosed((string) $row['slug']),
        ];
    }

    public function updateEvent(array $input, int $actorId, string $ip, string $slug = self::DEFAULT_EVENT): array
    {
        $event = $this->eventRow($slug);
        $title = self::text($input['title'] ?? null, 1, 160);
        $date = $input['date'] ?? null;
        if (!is_string($date) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $parts) !== 1 || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) throw new InvalidArgumentException();
        $time = $input['time'] ?? '';
        if (!is_string($time) || ($time !== '' && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $time) !== 1)) throw new InvalidArgumentException();
        $place = self::text($input['place'] ?? null, 1, 240);
        $details = self::text($input['details'] ?? '', 0, 2000);
        $this->pdo->prepare('UPDATE influencer_event SET title = ?, event_date = ?, event_time = ?, place = ?, details = ?, updated_at = ? WHERE id = ?')
            ->execute([$title, $date, $time, $place, $details, gmdate('Y-m-d H:i:s'), (int) $event['id']]);
        $this->audit->log('influencer.event_updated', $actorId, 'influencer', null, [], $ip);
        return $this->event((string) $event['slug']);
    }

    /* ---------- Panel ---------- */

    public function list(string $kind, string $eventSlug = self::DEFAULT_EVENT): array
    {
        $event = $this->eventRow($eventSlug);
        $kind = self::kind($kind, (string) $event['slug']);
        $query = $this->pdo->prepare('SELECT g.*, e.slug AS event_slug FROM influencer_guests g JOIN influencer_event e ON e.id = g.event_id WHERE g.event_id = ? AND g.kind = ? AND g.archived_at IS NULL ORDER BY g.created_at DESC, g.id DESC');
        $query->execute([(int) $event['id'], $kind]);
        $guests = array_map(fn (array $row): array => $this->projection($row), $query->fetchAll(PDO::FETCH_ASSOC));
        $count = static fn (callable $test): int => count(array_filter($guests, $test));
        return [
            'event' => $this->event((string) $event['slug']),
            'guests' => $guests,
            'totals' => [
                'total' => count($guests),
                'si' => $count(static fn (array $guest): bool => $guest['response'] === 'si'),
                'no' => $count(static fn (array $guest): bool => $guest['response'] === 'no'),
                'pendiente' => $count(static fn (array $guest): bool => $guest['response'] === 'pendiente'),
                'abrieron' => $count(static fn (array $guest): bool => $guest['opened_at'] !== null),
                'por_aprobar' => $count(static fn (array $guest): bool => $guest['approval'] === 'pendiente'),
                'aprobados_si' => $count(static fn (array $guest): bool => $guest['approval'] === 'aprobado' && $guest['response'] === 'si'),
            ],
        ];
    }

    /** Compatibilidad: la creación sin evento explícito conserva el flujo de creadores de Guaynaa. */
    public function createCreators(mixed $names, int $actorId, string $ip): array
    {
        return $this->createGuests($names, 'creador', 'registro', self::DEFAULT_EVENT, $actorId, $ip);
    }

    /** Coordinación pega los nombres, uno por línea: cada persona recibe su enlace personal. */
    public function createGuests(mixed $names, mixed $kind, mixed $messageVariant, string $eventSlug, int $actorId, string $ip): array
    {
        $event = $this->eventRow($eventSlug);
        $kind = self::kind($kind, (string) $event['slug']);
        $messageVariant = self::messageVariant($messageVariant);
        if (!is_string($names)) throw new InvalidArgumentException();
        $lines = array_values(array_filter(array_map(static fn (string $line): string => trim(preg_replace('/\s+/u', ' ', $line) ?? ''), preg_split('/\R/u', $names) ?: []), static fn (string $line): bool => $line !== ''));
        if ($lines === [] || count($lines) > self::MAX_BULK) throw new InvalidArgumentException();
        foreach ($lines as $line) self::text($line, 1, 160);
        $created = [];
        $now = gmdate('Y-m-d H:i:s');
        $insert = $this->pdo->prepare("INSERT INTO influencer_guests (event_id, public_id, kind, message_variant, invite_token, full_name, approval, note, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'aprobado', '', ?, ?, ?)");
        $this->pdo->beginTransaction();
        try {
            foreach ($lines as $line) {
                $publicId = bin2hex(random_bytes(16));
                $insert->execute([(int) $event['id'], $publicId, $kind, $messageVariant, $this->newToken(), $line, $actorId, $now, $now]);
                $this->audit->log('influencer.created', $actorId, 'influencer', $publicId, [], $ip);
                $created[] = $publicId;
            }
            $this->pdo->commit();
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
        return array_map(fn (string $id): array => $this->find($id), $created);
    }

    public function update(string $publicId, array $input, int $actorId, string $ip): array
    {
        $row = $this->row($publicId);
        $sets = []; $values = [];
        if (array_key_exists('full_name', $input)) { $sets[] = 'full_name = ?'; $values[] = self::text($input['full_name'], 1, 160); }
        if (array_key_exists('whatsapp', $input)) {
            $phone = self::phone($input['whatsapp'], true);
            $sets[] = 'whatsapp_enc = ?'; $values[] = $phone === '' ? null : $this->crypto->encrypt($phone);
            $sets[] = 'whatsapp_lookup = ?'; $values[] = $phone === '' ? null : $this->crypto->lookup($phone);
        }
        if (array_key_exists('social_link', $input)) { $sets[] = 'social_link = ?'; $values[] = self::social($input['social_link'], true); }
        if (array_key_exists('followers', $input)) { $sets[] = 'followers = ?'; $values[] = self::followers($input['followers'], true); }
        if (array_key_exists('city', $input)) { $sets[] = 'city = ?'; $values[] = self::text($input['city'], 0, 120); }
        if (array_key_exists('note', $input)) { $sets[] = 'note = ?'; $values[] = self::text($input['note'], 0, 2000); }
        if (array_key_exists('message_variant', $input)) { $sets[] = 'message_variant = ?'; $values[] = self::messageVariant($input['message_variant']); }
        if (array_key_exists('approval', $input)) {
            if (!in_array($input['approval'], self::APPROVALS, true)) throw new InvalidArgumentException();
            $sets[] = 'approval = ?'; $values[] = $input['approval'];
            // Al aprobar a un nuevo creador recibe su enlace propio, con el que descarga su gafete.
            if ($input['approval'] === 'aprobado' && ($row['invite_token'] ?? null) === null) { $sets[] = 'invite_token = ?'; $values[] = $this->newToken(); }
            // Un nuevo creador aprobado pasa a la lista de Creadores; conserva sus datos, su respuesta y su enlace.
            if ($input['approval'] === 'aprobado' && $row['kind'] === 'nuevo') { $sets[] = 'kind = ?'; $values[] = 'creador'; }
        }
        if (array_key_exists('response', $input)) {
            // Coordinación también registra la respuesta que le llega por teléfono o en persona.
            if (!in_array($input['response'], self::RESPONSES, true)) throw new InvalidArgumentException();
            $sets[] = 'response = ?'; $values[] = $input['response'];
            $sets[] = 'responded_at = ?'; $values[] = $input['response'] === 'pendiente' ? null : gmdate('Y-m-d H:i:s');
        }
        if ($sets === []) throw new InvalidArgumentException();
        $sets[] = 'updated_at = ?'; $values[] = gmdate('Y-m-d H:i:s');
        $values[] = (int) $row['id'];
        $this->pdo->prepare('UPDATE influencer_guests SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($values);
        $this->audit->log('influencer.updated', $actorId, 'influencer', $publicId, [], $ip);
        return $this->find($publicId);
    }

    public function archive(string $publicId, int $actorId, string $ip): void
    {
        $row = $this->row($publicId);
        $this->pdo->prepare('UPDATE influencer_guests SET archived_at = ?, updated_at = ? WHERE id = ?')->execute([gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'), (int) $row['id']]);
        $this->audit->log('influencer.archived', $actorId, 'influencer', $publicId, [], $ip);
    }

    /** Un enlace nuevo deja sin efecto el anterior (por si se envió a la persona equivocada). */
    public function newLink(string $publicId, int $actorId, string $ip): array
    {
        $row = $this->row($publicId);
        $this->pdo->prepare('UPDATE influencer_guests SET invite_token = ?, opened_at = NULL, updated_at = ? WHERE id = ?')->execute([$this->newToken(), gmdate('Y-m-d H:i:s'), (int) $row['id']]);
        $this->audit->log('influencer.link_created', $actorId, 'influencer', $publicId, [], $ip);
        return $this->find($publicId);
    }

    public function find(string $publicId): array
    {
        return $this->projection($this->row($publicId));
    }

    /* ---------- Invitación pública ---------- */

    /** Lo que ve un creador al abrir su enlace: el evento, su nombre y su respuesta. */
    public function openInvitation(string $token, string $eventSlug = self::DEFAULT_EVENT): array
    {
        $row = $this->byToken($token, $eventSlug);
        if ($row['opened_at'] === null) {
            $this->pdo->prepare('UPDATE influencer_guests SET opened_at = ? WHERE id = ? AND opened_at IS NULL')->execute([gmdate('Y-m-d H:i:s'), (int) $row['id']]);
        }
        return ['event' => $this->event((string) $row['event_slug']), 'guest' => ['name' => (string) $row['full_name'], 'response' => (string) $row['response'], 'kind' => (string) $row['kind'], 'message_variant' => (string) $row['message_variant'], 'badge' => self::badgeReady($row)]];
    }

    public function respond(string $token, mixed $response, string $ip, string $eventSlug = self::DEFAULT_EVENT): array
    {
        if (!in_array($response, ['si', 'no'], true)) throw new InvalidArgumentException();
        $row = $this->byToken($token, $eventSlug);
        if ($this->rsvpClosed((string) $row['event_slug'])) throw new InvitationClosed();
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('UPDATE influencer_guests SET response = ?, responded_at = ?, opened_at = COALESCE(opened_at, ?), updated_at = ? WHERE id = ?')
            ->execute([$response, $now, $now, $now, (int) $row['id']]);
        // En la inauguración, confirmar «sí» acepta las condiciones de la invitación (incluido el uso de imagen): queda la fecha como evidencia.
        if ($response === 'si' && ($row['event_slug'] ?? '') === 'inauguracion') {
            $this->pdo->prepare('UPDATE influencer_guests SET consent_at = ? WHERE id = ?')->execute([$now, (int) $row['id']]);
        }
        $this->audit->log('influencer.responded', null, 'influencer', (string) $row['public_id'], [], $ip);
        return ['name' => (string) $row['full_name'], 'response' => $response, 'kind' => (string) $row['kind'], 'message_variant' => (string) $row['message_variant'], 'badge' => self::badgeReady([...$row, 'response' => $response])];
    }

    /**
     * Enlace único para voceros: con su sesión, el vocero recibe el código de su invitación personal a la inauguración.
     * Se busca por número de WhatsApp (mismo número aunque el nombre esté escrito distinto) o por nombre idéntico.
     * Si tiene ficha pero aún no tiene invitación (se registró después del envío), se crea en ese momento.
     * Devuelve ['token' => …] o ['missing' => 'ficha' | 'invitacion'].
     */
    public function voceroInvitation(int $accountId, string $ip = ''): array
    {
        $query = $this->pdo->prepare("SELECT v.id, v.full_name, v.whatsapp_enc FROM vocero_account_links l JOIN voceros v ON v.id = l.vocero_id WHERE l.account_id = ? AND v.status IN ('Aprobado', 'Nuevo') LIMIT 1");
        $query->execute([$accountId]);
        $vocero = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($vocero)) return ['missing' => 'ficha'];
        $phoneKey = function (?string $encrypted): string {
            if ($encrypted === null || $encrypted === '') return '';
            try { $digits = preg_replace('/\D/', '', $this->crypto->decrypt($encrypted)) ?? ''; } catch (\Throwable) { return ''; }
            return strlen($digits) >= 9 ? substr($digits, -9) : '';
        };
        $name = static fn (string $value): string => mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? ''), 'UTF-8');
        $phone = $phoneKey($vocero['whatsapp_enc'] ?? null);
        $event = $this->eventRow('inauguracion');
        $guests = $this->pdo->prepare('SELECT full_name, whatsapp_enc, invite_token FROM influencer_guests WHERE event_id = ? AND archived_at IS NULL AND invite_token IS NOT NULL ORDER BY id');
        $guests->execute([(int) $event['id']]);
        $byName = null;
        foreach ($guests->fetchAll(PDO::FETCH_ASSOC) as $guest) {
            if ($phone !== '' && $phoneKey($guest['whatsapp_enc'] ?? null) === $phone) return ['token' => (string) $guest['invite_token']];
            if ($byName === null && $name((string) $guest['full_name']) === $name((string) $vocero['full_name'])) $byName = (string) $guest['invite_token'];
        }
        if ($byName !== null) return ['token' => $byName];
        // Después del cierre ya no se crean invitaciones nuevas.
        if ($this->rsvpClosed('inauguracion')) return ['missing' => 'invitacion'];
        $videos = $this->pdo->prepare("SELECT COUNT(*) FROM vocero_videos WHERE vocero_id = ? AND status = 'submitted'");
        $videos->execute([(int) $vocero['id']]);
        $variant = (int) $videos->fetchColumn() > 0 ? 'apoyo' : 'registro';
        $plainPhone = '';
        try { $plainPhone = $vocero['whatsapp_enc'] ? $this->crypto->decrypt((string) $vocero['whatsapp_enc']) : ''; } catch (\Throwable) { $plainPhone = ''; }
        $normalized = preg_replace('/[\s().-]/', '', $plainPhone) ?? '';
        $validPhone = preg_match('/^\+?\d{9,15}$/D', $normalized) === 1;
        $publicId = bin2hex(random_bytes(16));
        $token = $this->newToken();
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare("INSERT INTO influencer_guests (event_id, public_id, kind, message_variant, invite_token, full_name, whatsapp_enc, whatsapp_lookup, approval, note, created_by_admin_id, created_at, updated_at) VALUES (?, ?, 'vocero', ?, ?, ?, ?, ?, 'aprobado', 'Creada al iniciar sesión en el enlace de voceros.', NULL, ?, ?)")
            ->execute([(int) $event['id'], $publicId, $variant, $token, self::text(trim(preg_replace('/\s+/u', ' ', (string) $vocero['full_name']) ?? ''), 1, 160),
                $validPhone ? $this->crypto->encrypt($normalized) : null, $validPhone ? $this->crypto->lookup($normalized) : null, $now, $now]);
        $this->audit->log('influencer.created', null, 'influencer', $publicId, [], $ip);
        return ['token' => $token];
    }

    /** El gafete existe cuando la persona confirmó que asiste y su lugar está aprobado. */
    public function badge(string $token, string $eventSlug = self::DEFAULT_EVENT): array
    {
        $row = $this->byToken($token, $eventSlug);
        $ready = self::badgeReady($row);
        return [
            'event' => $this->event((string) $row['event_slug']),
            'ready' => $ready,
            'reason' => $ready ? null : ($row['response'] !== 'si' ? 'respuesta' : 'aprobacion'),
            'guest' => ['name' => (string) $row['full_name'], 'kind' => (string) $row['kind'], 'message_variant' => (string) $row['message_variant'], 'public_id' => $ready ? (string) $row['public_id'] : null, 'social_link' => (string) $row['social_link']],
        ];
    }

    /** Lo que ve el equipo al escanear el QR del gafete en la puerta. Sin teléfonos ni datos privados. */
    public function verification(string $publicId, string $eventSlug = self::DEFAULT_EVENT): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new OutOfBoundsException();
        $event = $this->eventRow($eventSlug);
        $query = $this->pdo->prepare('SELECT g.*, e.slug AS event_slug FROM influencer_guests g JOIN influencer_event e ON e.id = g.event_id WHERE g.public_id = ? AND g.event_id = ?');
        $query->execute([$publicId, (int) $event['id']]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) throw new OutOfBoundsException();
        $active = $row['archived_at'] === null;
        return [
            'valid' => $active && self::badgeReady($row),
            'name' => (string) $row['full_name'],
            'kind' => match ($row['kind']) { 'creador' => 'Creador invitado', 'vocero' => 'Vocero invitado', default => 'Nuevo creador' },
            // Guaynaa ya publicaba este dato y conserva su contrato; los eventos nuevos no lo exponen en el QR.
            ...((string) $row['event_slug'] === self::DEFAULT_EVENT ? ['social_link' => (string) $row['social_link']] : []),
            'response' => (string) $row['response'],
            'approval' => (string) $row['approval'],
            'retired' => !$active,
            'event' => $this->event((string) $row['event_slug'])['title'],
        ];
    }

    private static function badgeReady(array $row): bool
    {
        return ($row['response'] ?? '') === 'si' && ($row['approval'] ?? '') === 'aprobado';
    }

    /** Nuevo creador: deja sus datos y confirma; si vuelve con el mismo WhatsApp se actualiza su registro. */
    public function register(array $input, string $ip, string $eventSlug = self::DEFAULT_EVENT): array
    {
        $event = $this->eventRow($eventSlug);
        self::kind('nuevo', (string) $event['slug']);
        if (($input['consent'] ?? null) !== true) throw new InvalidArgumentException();
        $response = $input['response'] ?? null;
        if (!in_array($response, ['si', 'no'], true)) throw new InvalidArgumentException();
        $name = self::text($input['full_name'] ?? null, 2, 160);
        $phone = self::phone($input['whatsapp'] ?? null, false);
        $social = self::social($input['social_link'] ?? null, false);
        $followers = self::followers($input['followers'] ?? null, false);
        $city = self::text($input['city'] ?? null, 2, 120);
        $now = gmdate('Y-m-d H:i:s');
        $ipHash = $this->crypto->lookup($ip);
        $lookup = $this->crypto->lookup($phone);

        // Si ya fue aprobado y pasó a Creadores, solo se actualiza su respuesta: no se duplica en Nuevos creadores.
        $promoted = $this->pdo->prepare("SELECT id, public_id FROM influencer_guests WHERE event_id = ? AND kind = 'creador' AND consent_at IS NOT NULL AND whatsapp_lookup = ? AND archived_at IS NULL ORDER BY id DESC LIMIT 1");
        $promoted->execute([(int) $event['id'], $lookup]);
        $moved = $promoted->fetch(PDO::FETCH_ASSOC);
        if (is_array($moved)) {
            $this->pdo->prepare('UPDATE influencer_guests SET response = ?, responded_at = ?, consent_at = ?, updated_at = ? WHERE id = ?')
                ->execute([$response, $now, $now, $now, (int) $moved['id']]);
            $this->audit->log('influencer.registered', null, 'influencer', (string) $moved['public_id'], [], $ip);
            return ['name' => $name, 'response' => $response];
        }

        $existing = $this->pdo->prepare("SELECT id, public_id FROM influencer_guests WHERE event_id = ? AND kind = 'nuevo' AND whatsapp_lookup = ? AND archived_at IS NULL ORDER BY id DESC LIMIT 1");
        $existing->execute([(int) $event['id'], $lookup]);
        $found = $existing->fetch(PDO::FETCH_ASSOC);
        if (is_array($found)) {
            $this->pdo->prepare('UPDATE influencer_guests SET full_name = ?, whatsapp_enc = ?, social_link = ?, followers = ?, city = ?, response = ?, responded_at = ?, consent_at = ?, updated_at = ? WHERE id = ?')
                ->execute([$name, $this->crypto->encrypt($phone), $social, $followers, $city, $response, $now, $now, $now, (int) $found['id']]);
            $this->audit->log('influencer.registered', null, 'influencer', (string) $found['public_id'], [], $ip);
            return ['name' => $name, 'response' => $response];
        }

        $recent = $this->pdo->prepare("SELECT COUNT(*) FROM influencer_guests WHERE ip_hash = ? AND created_at >= ?");
        $recent->execute([$ipHash, gmdate('Y-m-d H:i:s', time() - 600)]);
        if ((int) $recent->fetchColumn() >= 5) throw new RateLimitException();
        $burst = $this->pdo->prepare("SELECT COUNT(*) FROM influencer_guests WHERE ip_hash IS NOT NULL AND created_at >= ?");
        $burst->execute([gmdate('Y-m-d H:i:s', time() - 600)]);
        if ((int) $burst->fetchColumn() >= 150) throw new RateLimitException();

        $publicId = bin2hex(random_bytes(16));
        $this->pdo->prepare("INSERT INTO influencer_guests (event_id, public_id, kind, message_variant, invite_token, full_name, whatsapp_enc, whatsapp_lookup, social_link, followers, city, response, responded_at, approval, note, consent_at, ip_hash, created_at, updated_at) VALUES (?, ?, 'nuevo', 'registro', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', '', ?, ?, ?, ?)")
            ->execute([(int) $event['id'], $publicId, $this->newToken(), $name, $this->crypto->encrypt($phone), $lookup, $social, $followers, $city, $response, $now, $now, $ipHash, $now, $now]);
        $this->audit->log('influencer.registered', null, 'influencer', $publicId, [], $ip);
        return ['name' => $name, 'response' => $response];
    }

    /* ---------- Internos ---------- */

    private function newToken(): string
    {
        do {
            $token = '';
            for ($i = 0; $i < 10; $i++) $token .= self::TOKEN_ALPHABET[random_int(0, strlen(self::TOKEN_ALPHABET) - 1)];
            $exists = $this->pdo->prepare('SELECT 1 FROM influencer_guests WHERE invite_token = ?');
            $exists->execute([$token]);
        } while ($exists->fetchColumn() !== false);
        return $token;
    }

    private function row(string $publicId): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new OutOfBoundsException();
        $query = $this->pdo->prepare('SELECT g.*, e.slug AS event_slug FROM influencer_guests g JOIN influencer_event e ON e.id = g.event_id WHERE g.public_id = ? AND g.archived_at IS NULL');
        $query->execute([$publicId]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) throw new OutOfBoundsException();
        return $row;
    }

    private function byToken(string $token, string $eventSlug): array
    {
        if (preg_match(self::TOKEN_PATTERN, $token) !== 1) throw new OutOfBoundsException();
        $event = $this->eventRow($eventSlug);
        $query = $this->pdo->prepare('SELECT g.*, e.slug AS event_slug FROM influencer_guests g JOIN influencer_event e ON e.id = g.event_id WHERE g.invite_token = ? AND g.event_id = ? AND g.archived_at IS NULL');
        $query->execute([$token, (int) $event['id']]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) throw new OutOfBoundsException();
        return $row;
    }

    private function projection(array $row): array
    {
        $phone = '';
        if (is_string($row['whatsapp_enc'] ?? null) && $row['whatsapp_enc'] !== '') {
            try { $phone = $this->crypto->decrypt($row['whatsapp_enc']); } catch (\Throwable) { $phone = ''; }
        }
        return [
            'public_id' => (string) $row['public_id'], 'event' => (string) $row['event_slug'], 'kind' => (string) $row['kind'], 'message_variant' => (string) $row['message_variant'],
            'invite_token' => $row['invite_token'] === null ? null : (string) $row['invite_token'],
            'full_name' => (string) $row['full_name'], 'whatsapp' => $phone, 'social_link' => (string) $row['social_link'],
            'followers' => $row['followers'] === null ? null : (int) $row['followers'], 'city' => (string) $row['city'],
            'response' => (string) $row['response'], 'responded_at' => $row['responded_at'] === null ? null : (string) $row['responded_at'],
            'opened_at' => $row['opened_at'] === null ? null : (string) $row['opened_at'],
            'approval' => (string) $row['approval'], 'note' => (string) $row['note'], 'created_at' => (string) $row['created_at'],
            // Creador que llegó por el registro abierto y fue aprobado.
            'from_open' => $row['kind'] === 'creador' && $row['consent_at'] !== null,
        ];
    }

    public static function eventSlug(mixed $slug): string
    {
        if ($slug === null || $slug === '') return self::DEFAULT_EVENT;
        if (!is_string($slug) || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug) !== 1 || strlen($slug) > 64) throw new InvalidArgumentException();
        return $slug;
    }

    public static function kind(mixed $kind, string $eventSlug = self::DEFAULT_EVENT): string
    {
        $eventSlug = self::eventSlug($eventSlug);
        if (!is_string($kind) || !in_array($kind, self::EVENT_KINDS[$eventSlug] ?? [], true)) throw new InvalidArgumentException();
        return $kind;
    }

    public static function messageVariant(mixed $variant): string
    {
        if (!is_string($variant) || !in_array($variant, self::MESSAGE_VARIANTS, true)) throw new InvalidArgumentException();
        return $variant;
    }

    private function eventRow(string $slug): array
    {
        $query = $this->pdo->prepare('SELECT id, slug, title, event_date, event_time, place, details, updated_at FROM influencer_event WHERE slug = ?');
        $query->execute([self::eventSlug($slug)]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) throw new OutOfBoundsException();
        return $row;
    }

    private static function text(mixed $value, int $min, int $max): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $value = trim($value);
        $length = mb_strlen($value, 'UTF-8');
        if ($length < $min || $length > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value) === 1) throw new InvalidArgumentException();
        return $value;
    }

    private static function phone(mixed $value, bool $optional): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $phone = preg_replace('/[\s().-]/', '', $value) ?? '';
        if ($phone === '' && $optional) return '';
        if (preg_match('/^\+?\d{9,15}$/D', $phone) !== 1) throw new InvalidArgumentException();
        return $phone;
    }

    /** Un enlace https a su cuenta o su usuario con @. */
    private static function social(mixed $value, bool $optional): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $value = trim($value);
        if ($value === '' && $optional) return '';
        if (preg_match('/^@?[A-Za-z0-9._]{2,40}$/D', $value) === 1) return str_starts_with($value, '@') ? $value : '@' . $value;
        if (strlen($value) > 500 || !str_starts_with($value, 'https://') || filter_var($value, FILTER_VALIDATE_URL) === false) throw new InvalidArgumentException();
        return $value;
    }

    private static function followers(mixed $value, bool $optional): ?int
    {
        if (($value === null || $value === '') && $optional) return null;
        if (is_string($value) && preg_match('/^\d{1,10}$/D', $value) === 1) $value = (int) $value;
        if (!is_int($value) || $value < 0 || $value > 1000000000) throw new InvalidArgumentException();
        return $value;
    }
}
