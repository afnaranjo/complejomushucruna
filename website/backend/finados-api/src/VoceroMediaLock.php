<?php
declare(strict_types=1);

namespace Finados;

use PDO;
use RuntimeException;
use Throwable;

/** Shared by photo readers, profile writers and the media backup protocol. */
final class VoceroMediaLock
{
    private array $namedLocks = [];
    private mixed $file = null;

    private function __construct(private readonly PDO $pdo) {}

    public static function acquire(PDO $pdo, Config $config, bool $registration = false): self
    {
        $lease = new self($pdo);
        try {
            self::opaque(function () use ($lease, $pdo, $config, $registration): void {
                if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
                    // No reader or backup may request deduplication while already holding media.
                    $names = $registration ? ['finados.voceros.public-registration', 'finados.voceros.media'] : ['finados.voceros.media'];
                    foreach ($names as $name) {
                        // Include attempted acquisition: its acknowledgement could be lost after success.
                        $lease->namedLocks[] = $name;
                        $query = $pdo->prepare('SELECT GET_LOCK(?, 10)');
                        $query->execute([$name]);
                        if ((int) $query->fetchColumn() !== 1) throw new RuntimeException();
                    }
                } else {
                    $path = $config->privateDirectory() . '/finados.voceros.media.lock';
                    $mask = umask(0077);
                    try { $lease->file = fopen($path, 'c'); } finally { umask($mask); }
                    if (!is_resource($lease->file)) throw new RuntimeException();
                    $pathStat = lstat($path); $fileStat = fstat($lease->file);
                    if ($pathStat === false || $fileStat === false || ($pathStat['mode'] & 0170000) !== 0100000
                        || ($fileStat['mode'] & 0170000) !== 0100000 || $pathStat['dev'] !== $fileStat['dev']
                        || $pathStat['ino'] !== $fileStat['ino'] || $fileStat['nlink'] !== 1) throw new RuntimeException();
                    $secured = function_exists('fchmod') ? fchmod($lease->file, 0600) : chmod($path, 0600);
                    if (!$secured || !flock($lease->file, LOCK_EX)) throw new RuntimeException();
                }
            });
        } catch (Throwable) {
            try { $lease->release(); } catch (Throwable) { /* Every attempted lock was released independently. */ }
            throw new RuntimeException('Media lock is unavailable.');
        }
        return $lease;
    }

    public function release(): void
    {
        $failed = false;
        foreach (array_reverse($this->namedLocks) as $name) {
            try {
                self::opaque(function () use ($name): void {
                    $query = $this->pdo->prepare('SELECT RELEASE_LOCK(?)');
                    $query->execute([$name]);
                    // NULL/0 is valid if an attempted acquisition was never acknowledged or granted.
                    $query->fetchColumn();
                });
            } catch (Throwable) { $failed = true; }
        }
        $this->namedLocks = [];
        if (is_resource($this->file)) {
            try { self::opaque(function (): void { if (!flock($this->file, LOCK_UN)) throw new RuntimeException(); }); }
            catch (Throwable) { $failed = true; }
            finally {
                try { self::opaque(function (): void { if (!fclose($this->file)) throw new RuntimeException(); }); }
                catch (Throwable) { $failed = true; }
                $this->file = null;
            }
        }
        if ($failed) throw new RuntimeException('Media lock could not be released.');
    }

    private static function opaque(callable $operation): mixed
    {
        set_error_handler(static function (): never { throw new RuntimeException('Media lock operation failed.'); });
        try { return $operation(); }
        catch (Throwable) { throw new RuntimeException('Media lock operation failed.'); }
        finally { restore_error_handler(); }
    }
}
