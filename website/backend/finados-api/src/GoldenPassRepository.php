<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;

/**
 * Pase dorado: coordinación registra nombre y cédula de cada persona con pase dorado.
 *  - Con la cédula se consulta en la puerta si el pase es «válido» o «no permitido».
 *  - Cada pase tiene un QR propio que lleva a su validación; el QR no contiene la cédula.
 * Nada se borra: retirar un pase lo archiva y deja de ser válido.
 */
final class GoldenPassRepository
{
    public const STATUSES = ['valido', 'anulado'];
    private const MAX_BULK = 200;

    public function __construct(private readonly PDO $pdo, private readonly Crypto $crypto, private readonly Audit $audit) {}

    /* ---------- Panel ---------- */

    public function list(): array
    {
        $rows = $this->pdo->query('SELECT * FROM golden_passes WHERE archived_at IS NULL ORDER BY created_at DESC, id DESC')->fetchAll(PDO::FETCH_ASSOC);
        $passes = array_map(fn (array $row): array => $this->projection($row), $rows);
        $valid = count(array_filter($passes, static fn (array $pass): bool => $pass['status'] === 'valido'));
        return ['passes' => $passes, 'totals' => ['total' => count($passes), 'valido' => $valid, 'anulado' => count($passes) - $valid]];
    }

    /**
     * Coordinación pega una persona por línea: su nombre y su cédula, en cualquier orden.
     * Las cédulas que ya tienen pase no se duplican: se devuelven en «skipped».
     */
    public function createMany(mixed $lines, int $actorId, string $ip): array
    {
        if (!is_string($lines)) throw new InvalidArgumentException();
        $entries = [];
        foreach (preg_split('/\R/u', $lines) ?: [] as $line) {
            if (trim($line) === '') continue;
            $entries[] = self::parseLine($line);
        }
        if ($entries === [] || count($entries) > self::MAX_BULK) throw new InvalidArgumentException();
        $created = []; $skipped = []; $seen = [];
        $now = gmdate('Y-m-d H:i:s');
        $insert = $this->pdo->prepare("INSERT INTO golden_passes (public_id, full_name, cedula_enc, cedula_idx, status, note, created_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'valido', '', ?, ?, ?)");
        $this->pdo->beginTransaction();
        try {
            foreach ($entries as [$name, $cedula]) {
                $index = $this->crypto->lookup($cedula);
                if (isset($seen[$index]) || $this->activeByIndex($index) !== null) { $skipped[] = ['full_name' => $name, 'cedula' => $cedula]; continue; }
                $seen[$index] = true;
                $publicId = bin2hex(random_bytes(16));
                $insert->execute([$publicId, $name, $this->crypto->encrypt($cedula), $index, $actorId, $now, $now]);
                $this->audit->log('golden_pass.created', $actorId, 'golden_pass', $publicId, [], $ip);
                $created[] = $publicId;
            }
            $this->pdo->commit();
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
        return ['passes' => array_map(fn (string $id): array => $this->find($id), $created), 'skipped' => $skipped];
    }

    public function update(string $publicId, array $input, int $actorId, string $ip): array
    {
        $row = $this->row($publicId);
        $sets = []; $values = [];
        if (array_key_exists('full_name', $input)) { $sets[] = 'full_name = ?'; $values[] = self::name($input['full_name']); }
        if (array_key_exists('cedula', $input)) {
            $cedula = self::cedula($input['cedula']);
            $index = $this->crypto->lookup($cedula);
            $other = $this->activeByIndex($index);
            if ($other !== null && (int) $other['id'] !== (int) $row['id']) throw new DuplicateRegistration();
            $sets[] = 'cedula_enc = ?'; $values[] = $this->crypto->encrypt($cedula);
            $sets[] = 'cedula_idx = ?'; $values[] = $index;
        }
        if (array_key_exists('status', $input)) {
            if (!in_array($input['status'], self::STATUSES, true)) throw new InvalidArgumentException();
            $sets[] = 'status = ?'; $values[] = $input['status'];
        }
        if (array_key_exists('note', $input)) { $sets[] = 'note = ?'; $values[] = self::text($input['note'], 0, 2000); }
        if ($sets === []) throw new InvalidArgumentException();
        $sets[] = 'updated_at = ?'; $values[] = gmdate('Y-m-d H:i:s');
        $values[] = (int) $row['id'];
        $this->pdo->prepare('UPDATE golden_passes SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($values);
        $this->audit->log('golden_pass.updated', $actorId, 'golden_pass', $publicId, [], $ip);
        return $this->find($publicId);
    }

    public function archive(string $publicId, int $actorId, string $ip): void
    {
        $row = $this->row($publicId);
        $now = gmdate('Y-m-d H:i:s');
        $this->pdo->prepare('UPDATE golden_passes SET archived_at = ?, updated_at = ? WHERE id = ?')->execute([$now, $now, (int) $row['id']]);
        $this->audit->log('golden_pass.archived', $actorId, 'golden_pass', $publicId, [], $ip);
    }

    public function find(string $publicId): array
    {
        return $this->projection($this->row($publicId));
    }

    /** Lo que ve el equipo al escribir una cédula en el panel: válido o no permitido. */
    public function checkCedula(mixed $cedula): array
    {
        $cedula = self::cedula($cedula);
        $row = $this->activeByIndex($this->crypto->lookup($cedula));
        if ($row === null) return ['valid' => false, 'found' => false, 'cedula_masked' => self::maskCedula($cedula)];
        return ['valid' => $row['status'] === 'valido', 'found' => true, 'name' => (string) $row['full_name'], 'cedula_masked' => self::maskCedula($cedula), 'public_id' => (string) $row['public_id']];
    }

    /** Lo que muestra la página a la que lleva el QR: válido o no, el nombre y la cédula enmascarada. */
    public function publicVerification(string $publicId): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new OutOfBoundsException();
        $query = $this->pdo->prepare('SELECT * FROM golden_passes WHERE public_id = ?');
        $query->execute([$publicId]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) throw new OutOfBoundsException();
        return [
            'valid' => $row['archived_at'] === null && $row['status'] === 'valido',
            'name' => (string) $row['full_name'],
            'cedula_masked' => self::maskCedula($this->crypto->decrypt((string) $row['cedula_enc'])),
        ];
    }

    /* ---------- Internos ---------- */

    /** «Ana Pérez 1801234567», «1801234567, Ana Pérez» o «Ana Pérez; 1801234567». */
    public static function parseLine(string $line): array
    {
        if (preg_match_all('/(?<!\d)\d{10}(?!\d)/', $line, $found) !== 1) throw new InvalidArgumentException();
        $cedula = $found[0][0];
        $rest = str_replace($cedula, ' ', $line);
        if (preg_match('/\d/', $rest) === 1) throw new InvalidArgumentException();
        $name = trim(preg_replace('/\s+/u', ' ', $rest) ?? '', " \t,;:|-–—");
        return [self::name($name), $cedula];
    }

    /** Cédula para mostrar: primeros tres y últimos dos dígitos. */
    public static function maskCedula(string $cedula): string
    {
        $digits = preg_replace('/\D/', '', $cedula) ?? '';
        if (strlen($digits) <= 5) return str_repeat('•', strlen($digits));
        return substr($digits, 0, 3) . str_repeat('•', strlen($digits) - 5) . substr($digits, -2);
    }

    private function activeByIndex(string $index): ?array
    {
        $query = $this->pdo->prepare('SELECT * FROM golden_passes WHERE cedula_idx = ? AND archived_at IS NULL ORDER BY id DESC LIMIT 1');
        $query->execute([$index]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function row(string $publicId): array
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $publicId) !== 1) throw new OutOfBoundsException();
        $query = $this->pdo->prepare('SELECT * FROM golden_passes WHERE public_id = ? AND archived_at IS NULL');
        $query->execute([$publicId]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) throw new OutOfBoundsException();
        return $row;
    }

    private function projection(array $row): array
    {
        return [
            'public_id' => (string) $row['public_id'], 'full_name' => (string) $row['full_name'],
            'cedula' => $this->crypto->decrypt((string) $row['cedula_enc']), 'status' => (string) $row['status'],
            'note' => (string) $row['note'], 'created_at' => (string) $row['created_at'], 'updated_at' => (string) $row['updated_at'],
        ];
    }

    private static function cedula(mixed $value): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $value = preg_replace('/[\s.-]/', '', $value) ?? '';
        if (preg_match('/^\d{10}$/D', $value) !== 1) throw new InvalidArgumentException();
        return $value;
    }

    private static function name(mixed $value): string
    {
        $name = self::text($value, 2, 160);
        if (preg_match('/\d/', $name) === 1) throw new InvalidArgumentException();
        return $name;
    }

    private static function text(mixed $value, int $min, int $max): string
    {
        if (!is_string($value)) throw new InvalidArgumentException();
        $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
        $length = mb_strlen($value, 'UTF-8');
        if ($length < $min || $length > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value) === 1) throw new InvalidArgumentException();
        return $value;
    }
}
