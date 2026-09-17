<?php
declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use RuntimeException;
use Throwable;

foreach (['VoceroAuth', 'PhotoStorage', 'PublicRegistration', 'VocerosRepository', 'VoceroMediaLock'] as $dependency) require_once __DIR__ . '/' . $dependency . '.php';

final class VoceroProfile
{
    private readonly Crypto $crypto;
    private readonly VocerosRepository $repository;
    private readonly PhotoStorage $storage;
    private readonly Audit $audit;

    public function __construct(private readonly PDO $pdo, private readonly Config $config)
    {
        $this->crypto = new Crypto($config);
        $this->repository = new VocerosRepository($pdo, $this->crypto);
        $this->storage = new PhotoStorage($config, $this->crypto);
        $this->audit = new Audit($pdo, $this->crypto);
    }

    /** accountId is supplied only by the authenticated guard, never by request fields. */
    public function get(int $accountId): ?array
    {
        $account = $this->account($accountId);
        $linked = $this->linked($accountId);
        if ($linked === null) return null;
        $record = $this->repository->find($linked['public_id']);
        $result = [];
        foreach (['public_id', 'submission_id', 'status', 'full_name', 'cedula', 'birth_date', 'age_at_submission',
            'whatsapp', 'city', 'main_network', 'tiktok', 'instagram', 'facebook', 'previous_participation',
            'community_source', 'kit_pickup', 'representative_name', 'representative_cedula', 'representative_phone',
            'representative_email', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $field) $result[$field] = $record[$field];
        $result['email'] = $this->crypto->decrypt($account['email_enc']);
        $photo = $this->photoRow((int) $linked['id']);
        $result['photo'] = $photo === null ? ['available' => false, 'width' => null, 'height' => null, 'created_at' => null]
            : ['available' => true, 'width' => (int) $photo['width'], 'height' => (int) $photo['height'], 'created_at' => $photo['created_at']];
        // Return only the accepted state needed to restore the authenticated form.
        // Evidence such as IP, hashes and internal identifiers never leaves the server.
        $result['consents'] = array_map(static fn (array $consent): array => [
            'consent_type' => (string) ($consent['consent_type'] ?? ''),
            'accepted' => (int) ($consent['accepted'] ?? 0),
            'text_version' => (string) ($consent['text_version'] ?? ''),
        ], $record['consents'] ?? []);
        $result['progress'] = $record['progress'] ?? $this->repository->progressForVocero((int) $linked['id']);
        $required = ['full_name', 'cedula', 'birth_date', 'whatsapp', 'city', 'main_network', 'previous_participation', 'community_source', 'kit_pickup'];
        $hasRequired = array_reduce($required, static fn (bool $complete, string $field): bool => $complete && trim((string) ($result[$field] ?? '')) !== '', true);
        $acceptedConsents = count(array_filter($record['consents'] ?? [], static fn (array $consent): bool => (int) ($consent['accepted'] ?? 0) === 1));
        $result['profile_complete'] = $hasRequired && $photo !== null && $acceptedConsents >= 3;
        return $result;
    }

    public function saveVideo(int $accountId, int $slot, string $url, string $ip): array
    {
        if (inet_pton($ip) === false) throw new Forbidden('Invalid request.');
        $this->account($accountId);
        $linked = $this->linked($accountId);
        if ($linked === null) throw new Forbidden('Complete your profile first.');
        if (!in_array($linked['status'], ['Nuevo', 'Pendiente de autorización', 'Aprobado'], true)) throw new Forbidden('Registration is read-only.');
        $this->repository->saveVideoByVoceroId((int) $linked['id'], $slot, $url, $ip);
        return $this->get($accountId) ?? throw new OutOfBoundsException('Registration not found.');
    }

    public function save(int $accountId, array $fields, array $files, string $ip, string $userAgent): array
    {
        if (inet_pton($ip) === false) throw new Forbidden('Invalid request.');
        $account = $this->account($accountId);
        // Social links help verify reach but are optional for authenticated voceros.
        // Anonymous intake keeps its stricter requirement through the default validator flag.
        $record = PublicRegistration::validate($fields, $this->crypto->decrypt($account['email_enc']), false);
        $consents = $this->consents($ip, $userAgent, $record['submitted_at']);
        $upload = $this->upload($files);
        $prepared = null; $promoted = false; $committed = false; $lock = null;
        $transactionStarted = false; $commitAttempted = false; $rollbackConfirmed = false; $commitUnknown = false;
        try {
            // Decode, normalize and encrypt before taking any database transaction or media lock.
            if ($upload !== null) {
                try { $prepared = $this->storage->stage($upload['tmp_name'], $upload['size']); }
                catch (RuntimeException) { throw new InvalidArgumentException('Invalid photo upload.'); }
            }
            $lock = VoceroMediaLock::acquire($this->pdo, $this->config, true);
            $this->pdo->beginTransaction();
            $transactionStarted = true;
            if (!$this->mysql()) $this->pdo->exec('UPDATE schema_migrations SET applied_at = applied_at WHERE 1 = 0');
            $account = $this->account($accountId, true);
            // Re-read protected account data under lock, including deactivation during staging.
            $record['email'] = $this->crypto->decrypt($account['email_enc']);
            $linked = $this->linked($accountId, true);
            if ($linked !== null) {
                if (!in_array($linked['status'], ['Nuevo', 'Pendiente de autorización'], true)) throw new Forbidden('Registration is read-only.');
                if (!hash_equals($linked['submission_id'], $record['submission_id'])) throw new InvalidArgumentException('Use the existing submission identifier.');
                if ($record['status'] === 'Nuevo') $record['status'] = $linked['status'];
            } else {
                if ($prepared === null) throw new InvalidArgumentException('A photo is required.');
                $query = $this->pdo->prepare('SELECT id FROM voceros WHERE submission_id = ?');
                $query->execute([$record['submission_id']]);
                if ($query->fetchColumn() !== false) throw new InvalidArgumentException('Submission identifier unavailable.');
            }
            // Retired test/history rows must not block a fresh profile for a
            // reactivated account; active registrations remain unique.
            $query = $this->pdo->prepare('SELECT id FROM voceros WHERE status <> ? AND (cedula_idx = ? OR email_idx = ? OR whatsapp_idx = ?) AND id <> ?');
            $query->execute(['Eliminado', $this->crypto->lookup($record['cedula']), $this->crypto->lookup($record['email']), $this->crypto->lookup($record['whatsapp']), $linked['id'] ?? 0]);
            if ($query->fetchColumn() !== false) throw new DuplicateRegistration('Registration already exists.');
            if ($linked === null) {
                $record['registration_ip'] = $ip;
                // A public intake racing this request must not turn repository replay into ownership.
                $publicId = $this->repository->create($record, $consents, false);
                $query = $this->pdo->prepare('SELECT id FROM voceros WHERE public_id = ?');
                $query->execute([$publicId]);
                $voceroId = (int) $query->fetchColumn();
                $this->pdo->prepare('INSERT INTO vocero_account_links (account_id, vocero_id, created_at) VALUES (?, ?, ?)')->execute([$accountId, $voceroId, gmdate('Y-m-d H:i:s')]);
                $changed = true;
            } else {
                $voceroId = (int) $linked['id']; $publicId = $linked['public_id'];
                $changed = $this->repository->updateProfile($voceroId, $record, $consents);
            }
            $oldPhoto = $this->photoRow($voceroId);
            $photoChanged = $prepared !== null && ($oldPhoto === null || !hash_equals($oldPhoto['sha256'], $prepared['sha256']));
            if ($photoChanged) {
                $values = [$prepared['storage_key'], $prepared['mime_type'], $prepared['bytes'], $prepared['sha256'], $prepared['width'], $prepared['height'], gmdate('Y-m-d H:i:s'), $voceroId];
                if ($oldPhoto === null) $sql = 'INSERT INTO vocero_photos (storage_key, content_type, bytes, sha256, width, height, created_at, vocero_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
                else $sql = 'UPDATE vocero_photos SET storage_key = ?, content_type = ?, bytes = ?, sha256 = ?, width = ?, height = ?, created_at = ? WHERE vocero_id = ?';
                $this->pdo->prepare($sql)->execute($values);
            }
            if ($changed || $photoChanged) $this->audit->log('vocero.profile_saved', null, 'vocero', $publicId, ['account_public_id' => $account['public_id']], $ip);
            // Preserve the durable intake delivery when registration moves behind authentication.
            // ensure() is idempotent and its explicit payload allowlist excludes photo metadata.
            (new SheetsOutbox($this->pdo, $this->crypto))->ensure($publicId);
            if ($photoChanged) { $this->storage->promote($prepared); $promoted = true; }
            $commitAttempted = true;
            $commitUnknown = true;
            if (!$this->pdo->commit()) throw new RuntimeException('Commit outcome unavailable.');
            $committed = true;
            $commitUnknown = false;
            // The old file remains available throughout rollback; only a committed replacement removes it.
            if ($photoChanged && $oldPhoto !== null) $this->storage->delete($oldPhoto['storage_key']);
            return $this->get($accountId);
        } finally {
            try {
                if (!$committed && $transactionStarted) {
                    try {
                        if ($this->pdo->inTransaction()) {
                            $rollbackConfirmed = $this->pdo->rollBack() && !$this->pdo->inTransaction();
                        }
                    } catch (Throwable) {
                        // A lost connection or acknowledgement cannot prove that the transaction rolled back.
                        $rollbackConfirmed = false;
                    }
                    $commitUnknown = $commitAttempted && !$rollbackConfirmed;
                }
            } finally {
                try {
                    if ($prepared !== null) {
                        try { $this->storage->discard($prepared); }
                        finally {
                            // A safe encrypted orphan is preferable to deleting a possibly committed reference.
                            if ($promoted && $rollbackConfirmed && !$commitUnknown && !$committed) $this->storage->delete($prepared['storage_key']);
                        }
                    }
                } finally {
                    if ($lock !== null) $lock->release();
                }
            }
        }
    }

    public function photo(int $accountId): string
    {
        $lock = VoceroMediaLock::acquire($this->pdo, $this->config);
        try {
            $this->account($accountId);
            $linked = $this->linked($accountId);
            $photo = $linked === null ? null : $this->photoRow((int) $linked['id']);
            if ($photo === null) throw new OutOfBoundsException('Photo unavailable.');
            return $this->storage->read($photo['storage_key']);
        } finally { $lock->release(); }
    }

    private function account(int $accountId, bool $lock = false): array
    {
        $query = $this->pdo->prepare('SELECT id, public_id, email_enc FROM vocero_accounts WHERE id = ? AND active = 1' . ($lock && $this->mysql() ? ' FOR UPDATE' : ''));
        $query->execute([$accountId]);
        $account = $query->fetch();
        if ($account === false) throw new Unauthorized('Account unavailable.');
        return $account;
    }

    private function linked(int $accountId, bool $lock = false): ?array
    {
        $query = $this->pdo->prepare('SELECT v.id, v.public_id, v.submission_id, v.status FROM vocero_account_links l JOIN voceros v ON v.id = l.vocero_id WHERE l.account_id = ?' . ($lock && $this->mysql() ? ' FOR UPDATE' : ''));
        $query->execute([$accountId]);
        $row = $query->fetch();
        return $row === false ? null : $row;
    }

    private function photoRow(int $voceroId): ?array
    {
        $query = $this->pdo->prepare('SELECT * FROM vocero_photos WHERE vocero_id = ?');
        $query->execute([$voceroId]);
        $row = $query->fetch();
        return $row === false ? null : $row;
    }

    private function upload(array $files): ?array
    {
        if (array_diff(array_keys($files), ['fotografia']) !== []) throw new InvalidArgumentException('Invalid photo upload.');
        if ($files === []) return null;
        $upload = $files['fotografia'];
        if (!is_array($upload) || !is_int($upload['error'] ?? null) || !is_string($upload['tmp_name'] ?? null)
            || !is_int($upload['size'] ?? null) || !is_string($upload['name'] ?? null) || !is_string($upload['type'] ?? null)) throw new InvalidArgumentException('Invalid photo upload.');
        if ($upload['error'] === UPLOAD_ERR_NO_FILE && $upload['tmp_name'] === '' && $upload['size'] === 0) return null;
        if ($upload['error'] !== UPLOAD_ERR_OK || $upload['tmp_name'] === '' || $upload['size'] <= 0 || $upload['size'] > 5242880) throw new InvalidArgumentException('Invalid photo upload.');
        return $upload;
    }

    private function consents(string $ip, string $userAgent, string $acceptedAt): array
    {
        $catalogue = json_decode((string) file_get_contents(__DIR__ . '/../resources/vocero-consents.json'), true, 16, JSON_THROW_ON_ERROR);
        $consents = [];
        // Cut by characters only after UTF-8 validation; neither metadata nor versions come from the client.
        if (preg_match('//u', $userAgent) !== 1) $userAgent = '';
        preg_match('/^.{0,500}/us', $userAgent, $agent);
        foreach (['policies' => 'politicas', 'image' => 'imagen', 'data' => 'datos'] as $key => $type) {
            $definition = $catalogue[$key] ?? null;
            if (!is_array($definition) || !is_string($definition['version'] ?? null) || !is_string($definition['text'] ?? null) || $definition['text'] === '') throw new RuntimeException('Consent catalogue unavailable.');
            $consents[] = ['consent_type' => $type, 'accepted' => 1, 'text_version' => $definition['version'],
                'text_hash' => hash('sha256', $definition['text']), 'accepted_at' => $acceptedAt, 'ip' => $ip,
                'user_agent' => $agent[0] ?? '', 'source_url' => 'https://complejomushucruna.com/finados/voceros/mi-registro/', 'method' => 'formulario_web'];
        }
        return $consents;
    }

    private function mysql(): bool { return $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'; }
}
