<?php
declare(strict_types=1);

namespace Finados;

use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/SheetsTransport.php';

/** Durable at-least-once delivery. Receiver deduplication is required across lost acknowledgements. */
final class SheetsOutbox
{
    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto) {}

    /** Called under the registration transaction/lock; historical imports remain opt-in. */
    public function ensure(string $publicId): string
    {
        if (!$this->pdo->inTransaction()) throw new RuntimeException('Outbox requires a transaction.');
        $query = $this->pdo->prepare('SELECT state FROM sheets_outbox WHERE public_id = ?');
        $query->execute([$publicId]);
        $state = $query->fetchColumn();
        if ($state !== false) return $state === 'synced' ? 'synced' : 'queued';
        $query = $this->pdo->prepare("SELECT COUNT(*) FROM audit_log WHERE subject_public_id = ? AND event_type = 'vocero.sheets_synced'");
        $query->execute([$publicId]);
        $synced = (int) $query->fetchColumn() > 0;
        $record = (new VocerosRepository($this->pdo, $this->crypto))->find($publicId);
        if ($record === null) throw new RuntimeException('Registration unavailable.');
        $query = $this->pdo->prepare('INSERT INTO sheets_outbox (submission_id, public_id, payload_enc, state, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)');
        $now = gmdate('Y-m-d H:i:s');
        $query->execute([$record['submission_id'], $publicId,
            $synced ? null : $this->crypto->encrypt(json_encode($this->payload($record), JSON_THROW_ON_ERROR)),
            $synced ? 'synced' : 'pending', $now, $synced ? $now : null]);
        return $synced ? 'synced' : 'queued';
    }

    private function payload(array $record): array
    {
        $timestamp = static fn (string $utc): string => (new \DateTimeImmutable($utc, new \DateTimeZone('UTC')))
            ->setTimezone(new \DateTimeZone('America/Guayaquil'))->format(\DateTimeInterface::ATOM);
        $payload = ['id' => $record['submission_id'], 'submission_id' => $record['submission_id'],
            'submittedAt' => $timestamp($record['submitted_at']), 'status' => $record['status']];
        foreach (['nombre_completo' => 'full_name', 'cedula' => 'cedula', 'fecha_nacimiento' => 'birth_date',
            'edad' => 'age_at_submission', 'whatsapp' => 'whatsapp', 'correo' => 'email', 'ciudad' => 'city',
            'tiktok' => 'tiktok', 'instagram' => 'instagram', 'facebook' => 'facebook', 'red_principal' => 'main_network',
            'vocero_previo' => 'previous_participation', 'fuente_comunidad' => 'community_source', 'retiro_kit' => 'kit_pickup',
            'representante_nombre' => 'representative_name', 'representante_cedula' => 'representative_cedula',
            'representante_telefono' => 'representative_phone', 'representante_correo' => 'representative_email'] as $target => $source) {
            $payload[$target] = $record[$source] ?? '';
        }
        foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $field) $payload[$field] = $record[$field];
        foreach ($record['consents'] as $consent) {
            $field = ['politicas' => 'consentimiento_politicas', 'imagen' => 'autorizacion_imagen', 'datos' => 'consentimiento_datos'][$consent['consent_type']] ?? null;
            if ($field !== null) $payload[$field] = $consent['accepted'] ? 'Sí' : 'No';
        }
        $payload['consents'] = array_map(static fn (array $consent): array => [
            'consentimiento_tipo' => $consent['consent_type'], 'aceptado' => $consent['accepted'] ? 'true' : 'false',
            'texto_version' => $consent['text_version'], 'texto_hash' => $consent['text_hash'],
            'fecha_hora' => $timestamp($consent['accepted_at']), 'ip_origen' => $consent['ip'],
            'user_agent' => $consent['user_agent'], 'url_origen' => $consent['source_url'],
            'metodo' => $consent['method'], 'id_registro' => $record['submission_id'],
        ], $record['consents']);
        return $payload;
    }

    public function deliver(string $submissionId, callable $send): string
    {
        $token = bin2hex(random_bytes(16));
        // Atomic compare-and-set works with both SQLite and InnoDB. A crashed worker loses its lease.
        $query = $this->pdo->prepare("UPDATE sheets_outbox SET lease_token = ?, lease_until = ?, attempts = attempts + 1 WHERE submission_id = ? AND state = 'pending' AND lease_until <= ?");
        $query->execute([$token, time() + 120, $submissionId, time()]);
        if ($query->rowCount() !== 1) {
            $query = $this->pdo->prepare('SELECT state FROM sheets_outbox WHERE submission_id = ?');
            $query->execute([$submissionId]);
            $state = $query->fetchColumn();
            if ($state === false) throw new RuntimeException('Durable Sheets job is unavailable.');
            return $state === 'synced' ? 'synced' : 'queued';
        }
        try {
            $query = $this->pdo->prepare('SELECT public_id, payload_enc FROM sheets_outbox WHERE submission_id = ? AND lease_token = ?');
            $query->execute([$submissionId, $token]);
            $job = $query->fetch();
            $query->closeCursor();
            $payload = json_decode($this->crypto->decrypt($job['payload_enc']), true, 512, JSON_THROW_ON_ERROR);
            if ($send($payload) !== 'synced') return 'queued';
            $this->pdo->beginTransaction();
            $query = $this->pdo->prepare("UPDATE sheets_outbox SET state = 'synced', payload_enc = NULL, completed_at = ?, lease_token = NULL, lease_until = 0 WHERE submission_id = ? AND lease_token = ? AND state = 'pending'");
            $query->execute([gmdate('Y-m-d H:i:s'), $submissionId, $token]);
            $completed = $query->rowCount() === 1;
            if ($completed) (new Audit($this->pdo, $this->crypto))->log('vocero.sheets_synced', null, 'vocero', $job['public_id']);
            $this->pdo->commit();
            return $completed ? 'synced' : 'queued';
        } catch (Throwable) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            // Keep encrypted work after transport or audit failure. No exception payload reaches logs.
            error_log('Voceros: Sheets delivery deferred; durable job retained.');
            return 'queued';
        } finally {
            $query = $this->pdo->prepare('UPDATE sheets_outbox SET lease_token = NULL, lease_until = 0 WHERE submission_id = ? AND lease_token = ?');
            $query->execute([$submissionId, $token]);
        }
    }

    public function reconcile(callable $send, int $maximum = 100): array
    {
        if ($maximum < 1 || $maximum > 1000) throw new RuntimeException('Invalid batch size.');
        $query = $this->pdo->prepare("SELECT submission_id FROM sheets_outbox WHERE state = 'pending' AND lease_until <= ? ORDER BY created_at, submission_id LIMIT ?");
        $query->bindValue(1, time(), PDO::PARAM_INT);
        $query->bindValue(2, $maximum, PDO::PARAM_INT);
        $query->execute();
        $counts = ['synced' => 0, 'queued' => 0];
        foreach ($query->fetchAll(PDO::FETCH_COLUMN) as $id) $counts[$this->deliver($id, $send)]++;
        return $counts;
    }
}
