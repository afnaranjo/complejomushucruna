<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;

final class PhotoStorage
{
    private const MAX_BYTES = 5242880;
    public const MAX_ENCRYPTED_BYTES = 8388608;
    private const MAX_PIXELS = 25000000;
    private const MAX_SIDE = 1600;
    private const KEY_PATTERN = '/^[a-f0-9]{64}$/D';
    private const MAGIC = "VPH\x01";
    private const HEADER = 73;

    private readonly string $root;
    private readonly string $stagingDirectory;
    private readonly string $filesDirectory;

    public function __construct(private readonly Config $config, private readonly Crypto $crypto)
    {
        $this->root = $config->privateDirectory() . '/voceros-photos';
        $this->stagingDirectory = $this->root . '/staging';
        $this->filesDirectory = $this->root . '/files';
        $this->ensureDirectories();
    }

    /** @return array{storage_key:string,mime_type:string,bytes:int,sha256:string,width:int,height:int} */
    public function stage(string $temporaryPath, int $declaredSize): array
    {
        try {
            if ($declaredSize <= 0 || $declaredSize > self::MAX_BYTES) {
                throw new RuntimeException('Invalid photo upload.');
            }
            $contents = $this->readRegularFile($temporaryPath, self::MAX_BYTES);
            if (strlen($contents) !== $declaredSize) {
                throw new RuntimeException('Invalid photo upload.');
            }
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($contents);
            if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || ($mime === 'image/webp' && !function_exists('imagecreatefromwebp'))) {
                throw new RuntimeException('Invalid photo upload.');
            }
            $details = $this->quiet(static fn (): array|false => getimagesizefromstring($contents));
            if (!is_array($details) || !isset($details[0], $details[1], $details['mime']) || $details['mime'] !== $mime || $details[0] <= 0 || $details[1] <= 0 || $details[0] > intdiv(self::MAX_PIXELS, $details[1])) {
                throw new RuntimeException('Invalid photo upload.');
            }
            $source = $this->quiet(static fn (): \GdImage|false => imagecreatefromstring($contents));
            if ($source === false) {
                throw new RuntimeException('Invalid photo upload.');
            }
            try {
                $source = $mime === 'image/jpeg' ? $this->orient($source, $this->jpegOrientation($contents)) : $source;
                $normalized = $this->normalize($source);
                try {
                    $jpeg = $this->encodeJpeg($normalized);
                } finally {
                    $this->releaseImage($normalized);
                }
            } finally {
                $this->releaseImage($source);
            }
            if ($jpeg === '' || strlen($jpeg) > self::MAX_BYTES) {
                throw new RuntimeException('Photo storage operation failed.');
            }
            $size = $this->quiet(static fn (): array|false => getimagesizefromstring($jpeg));
            if (!is_array($size) || !isset($size[0], $size[1])) {
                throw new RuntimeException('Photo storage operation failed.');
            }
            $key = bin2hex(random_bytes(32));
            $ciphertext = $this->crypto->encrypt($this->envelope($key, $jpeg));
            if ($ciphertext === '' || strlen($ciphertext) > self::MAX_ENCRYPTED_BYTES) {
                throw new RuntimeException('Photo storage operation failed.');
            }
            $this->locked(fn (): mixed => $this->writeExclusive($this->stagingPath($key), $ciphertext));
            return ['storage_key' => $key, 'mime_type' => 'image/jpeg', 'bytes' => strlen($jpeg), 'sha256' => hash('sha256', $jpeg), 'width' => $size[0], 'height' => $size[1]];
        } catch (RuntimeException $exception) {
            throw $exception;
        } catch (\Throwable) {
            throw new RuntimeException('Photo storage operation failed.');
        }
    }

    public function promote(array $photo): void
    {
        $key = $this->photoKey($photo);
        $this->locked(function () use ($key): void {
            $from = $this->stagingPath($key);
            $to = $this->filePath($key);
            if (!$this->isRegularFile($from) || $this->exists($to) || !$this->quiet(static fn (): bool => rename($from, $to))) {
                throw new RuntimeException('Photo storage operation failed.');
            }
            if (!$this->quiet(static fn (): bool => chmod($to, 0600))) {
                $this->removeFile($to);
                throw new RuntimeException('Photo storage operation failed.');
            }
        });
    }

    public function discard(array $photo): void
    {
        $key = $this->photoKey($photo);
        $this->locked(fn (): mixed => $this->removeFile($this->stagingPath($key)));
    }

    public function delete(string $storageKey): void
    {
        $key = $this->validKey($storageKey);
        $this->locked(fn (): mixed => $this->removeFile($this->filePath($key)));
    }

    public function read(string $storageKey): string
    {
        $key = $this->validKey($storageKey);
        return $this->decode($key, $this->readRegularFile($this->filePath($key), self::MAX_ENCRYPTED_BYTES));
    }

    /** Verify the exact ciphertext captured by a locked backup, without reopening its source. */
    public function decode(string $storageKey, string $ciphertext): string
    {
        $key = $this->validKey($storageKey);
        try {
            if (strlen($ciphertext) > self::MAX_ENCRYPTED_BYTES) throw new RuntimeException();
            $jpeg = $this->unpackEnvelope($key, $this->crypto->decrypt($ciphertext));
        } catch (\Throwable) {
            throw new RuntimeException('Photo storage operation failed.');
        }
        if (!str_starts_with($jpeg, "\xFF\xD8") || !str_ends_with($jpeg, "\xFF\xD9")) {
            throw new RuntimeException('Photo storage operation failed.');
        }
        $info = $this->quiet(static fn (): array|false => getimagesizefromstring($jpeg));
        $image = $this->quiet(static fn (): \GdImage|false => imagecreatefromstring($jpeg));
        if (!is_array($info) || ($info['mime'] ?? null) !== 'image/jpeg' || $image === false) {
            throw new RuntimeException('Photo storage operation failed.');
        }
        $this->releaseImage($image);
        return $jpeg;
    }

    public function verify(string $storageKey, string $sha256): bool
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $sha256)) return false;
        try { return hash_equals($sha256, hash('sha256', $this->read($storageKey))); } catch (RuntimeException) { return false; }
    }

    private function ensureDirectories(): void
    {
        foreach ([$this->root, $this->stagingDirectory, $this->filesDirectory] as $path) {
            if (is_link($path)) throw new RuntimeException('Photo storage is unavailable.');
            if (!is_dir($path)) {
                // A simultaneous first request may have created it after our initial check.
                $created = $this->quiet(static fn (): bool => mkdir($path, 0700));
                clearstatcache(true, $path);
                if (!$created && !is_dir($path)) throw new RuntimeException('Photo storage is unavailable.');
            }
            if (!is_dir($path) || is_link($path) || realpath($path) !== $path || !$this->quiet(static fn (): bool => chmod($path, 0700))) {
                throw new RuntimeException('Photo storage is unavailable.');
            }
        }
    }

    private function readRegularFile(string $path, int $maximum): string
    {
        $handle = $this->quiet(static fn () => fopen($path, 'rb'));
        if ($handle === false) throw new RuntimeException('Photo storage operation failed.');
        try {
            $pathStat = $this->quiet(static fn (): array|false => lstat($path));
            $handleStat = fstat($handle);
            if (!$this->sameRegularFile($pathStat, $handleStat)) throw new RuntimeException('Photo storage operation failed.');
            $contents = $this->readBounded($handle, $maximum);
        } finally {
            $closed = $this->quiet(static fn (): bool => fclose($handle));
        }
        if (!$closed) throw new RuntimeException('Photo storage operation failed.');
        return $contents;
    }

    private function readBounded($handle, int $maximum): string
    {
        $contents = ''; $limit = $maximum + 1;
        while (strlen($contents) < $limit) {
            $chunk = $this->quiet(static fn (): string|false => fread($handle, min(8192, $limit - strlen($contents))));
            if ($chunk === false || ($chunk === '' && !feof($handle))) throw new RuntimeException('Photo storage operation failed.');
            $contents .= $chunk;
            if ($chunk === '') break;
        }
        if (strlen($contents) > $maximum) throw new RuntimeException('Photo storage operation failed.');
        $extra = $this->quiet(static fn (): string|false => fread($handle, 1));
        if ($extra === false || $extra !== '' || !feof($handle)) throw new RuntimeException('Photo storage operation failed.');
        return $contents;
    }

    private function sameRegularFile(array|false $path, array|false $handle): bool
    {
        return $path !== false && $handle !== false && (($path['mode'] & 0170000) === 0100000) && (($handle['mode'] & 0170000) === 0100000) && $path['dev'] === $handle['dev'] && $path['ino'] === $handle['ino'];
    }

    private function envelope(string $key, string $jpeg): string
    {
        return self::MAGIC . $key . "\x01" . pack('N', strlen($jpeg)) . $jpeg;
    }

    private function unpackEnvelope(string $key, string $value): string
    {
        if (strlen($value) < self::HEADER || substr($value, 0, 4) !== self::MAGIC || !hash_equals($key, substr($value, 4, 64)) || ord($value[68]) !== 1) throw new RuntimeException('Photo storage operation failed.');
        $length = unpack('Nlength', substr($value, 69, 4))['length'] ?? null;
        if (!is_int($length) || $length <= 0 || $length > self::MAX_BYTES || strlen($value) !== self::HEADER + $length) throw new RuntimeException('Photo storage operation failed.');
        return substr($value, self::HEADER);
    }

    private function orient(\GdImage $image, ?int $orientation): \GdImage
    {
        $angle = match ($orientation) {3 => 180, 6 => -90, 8 => 90, default => null};
        if ($angle === null) return $image;
        $rotated = imagerotate($image, $angle, 0);
        if ($rotated === false) throw new RuntimeException('Invalid photo upload.');
        $this->releaseImage($image);
        return $rotated;
    }

    private function jpegOrientation(string $jpeg): ?int
    {
        $length = strlen($jpeg);
        for ($offset = 2; $offset + 4 <= $length;) {
            if ($jpeg[$offset] !== "\xFF") return null;
            while ($offset < $length && $jpeg[$offset] === "\xFF") $offset++;
            if ($offset >= $length) return null;
            $marker = ord($jpeg[$offset++]);
            if ($marker === 0xD9 || $marker === 0xDA) return null;
            if ($marker === 0xD8 || $marker === 1 || ($marker >= 0xD0 && $marker <= 0xD7)) continue;
            if ($offset + 2 > $length) return null;
            $segment = (ord($jpeg[$offset]) << 8) | ord($jpeg[$offset + 1]); $data = $offset + 2; $next = $data + $segment - 2;
            if ($segment < 2 || $next > $length) return null;
            if ($marker === 0xE1 && substr($jpeg, $data, 6) === "Exif\0\0") return $this->tiffOrientation($jpeg, $data + 6, $next);
            $offset = $next;
        }
        return null;
    }

    private function tiffOrientation(string $bytes, int $offset, int $limit): ?int
    {
        if ($offset + 8 > $limit) return null;
        $order = substr($bytes, $offset, 2); if ($order !== 'II' && $order !== 'MM') return null;
        $little = $order === 'II';
        if ($this->u16($bytes, $offset + 2, $little, $limit) !== 42) return null;
        $ifdOffset = $this->u32($bytes, $offset + 4, $little, $limit); if ($ifdOffset === null || $offset + $ifdOffset + 2 > $limit) return null;
        $ifd = $offset + $ifdOffset; $count = $this->u16($bytes, $ifd, $little, $limit);
        if ($count === null || $count > intdiv($limit - $ifd - 2, 12)) return null;
        for ($entry = $ifd + 2, $end = $entry + $count * 12; $entry < $end; $entry += 12) {
            if ($this->u16($bytes, $entry, $little, $limit) === 0x0112 && $this->u16($bytes, $entry + 2, $little, $limit) === 3 && $this->u32($bytes, $entry + 4, $little, $limit) === 1) {
                $value = $this->u16($bytes, $entry + 8, $little, $limit); return in_array($value, [3, 6, 8], true) ? $value : null;
            }
        }
        return null;
    }

    private function u16(string $bytes, int $offset, bool $little, int $limit): ?int
    {
        if ($offset < 0 || $offset + 2 > $limit) return null; $a = ord($bytes[$offset]); $b = ord($bytes[$offset + 1]); return $little ? $a | ($b << 8) : ($a << 8) | $b;
    }
    private function u32(string $bytes, int $offset, bool $little, int $limit): ?int
    {
        if ($offset < 0 || $offset + 4 > $limit) return null; $a = ord($bytes[$offset]); $b = ord($bytes[$offset + 1]); $c = ord($bytes[$offset + 2]); $d = ord($bytes[$offset + 3]); return $little ? $a | ($b << 8) | ($c << 16) | ($d << 24) : ($a << 24) | ($b << 16) | ($c << 8) | $d;
    }

    private function normalize(\GdImage $source): \GdImage
    {
        $sourceWidth = imagesx($source); $sourceHeight = imagesy($source); $scale = min(1, self::MAX_SIDE / max($sourceWidth, $sourceHeight)); $width = max(1, (int) round($sourceWidth * $scale)); $height = max(1, (int) round($sourceHeight * $scale));
        $image = imagecreatetruecolor($width, $height); if ($image === false) throw new RuntimeException('Photo storage operation failed.');
        imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
        if (!imagecopyresampled($image, $source, 0, 0, 0, 0, $width, $height, $sourceWidth, $sourceHeight)) { $this->releaseImage($image); throw new RuntimeException('Photo storage operation failed.'); }
        return $image;
    }
    private function encodeJpeg(\GdImage $image): string { ob_start(); $ok = imagejpeg($image, null, 88); $jpeg = ob_get_clean(); if (!$ok || !is_string($jpeg) || $jpeg === '') throw new RuntimeException('Photo storage operation failed.'); return $jpeg; }

    private function writeExclusive(string $path, string $contents): void
    {
        $previous = umask(0077); $handle = null;
        try {
            $handle = $this->quiet(static fn () => fopen($path, 'x'));
            if ($handle === false || !$this->secureHandle($handle)) throw new RuntimeException('Photo storage operation failed.');
            for ($offset = 0, $length = strlen($contents); $offset < $length;) { $written = $this->quiet(static fn (): int|false => fwrite($handle, substr($contents, $offset))); if ($written === false || $written === 0) throw new RuntimeException('Photo storage operation failed.'); $offset += $written; }
            if (!$this->quiet(static fn (): bool => fflush($handle)) || (function_exists('fsync') && !$this->quiet(static fn (): bool => fsync($handle))) || !$this->quiet(static fn (): bool => fclose($handle))) throw new RuntimeException('Photo storage operation failed.');
            $handle = null;
        } catch (\Throwable) {
            if (is_resource($handle)) $this->quiet(static fn (): bool => fclose($handle)); $this->removeFile($path); throw new RuntimeException('Photo storage operation failed.');
        } finally { umask($previous); }
    }

    private function locked(callable $operation): mixed
    {
        $handle = $this->quiet(fn () => fopen($this->root . '/.lock', 'c')); if ($handle === false) throw new RuntimeException('Photo storage operation failed.');
        try { if (!$this->secureHandle($handle) || !$this->quiet(static fn (): bool => flock($handle, LOCK_EX))) throw new RuntimeException('Photo storage operation failed.'); return $operation(); }
        finally { $this->quiet(static fn (): bool => flock($handle, LOCK_UN)); $this->quiet(static fn (): bool => fclose($handle)); }
    }
    private function photoKey(array $photo): string { return $this->validKey($photo['storage_key'] ?? ''); }
    private function validKey(string $key): string { if (!preg_match(self::KEY_PATTERN, $key)) throw new RuntimeException('Invalid photo reference.'); return $key; }
    private function stagingPath(string $key): string { return $this->stagingDirectory . '/' . $key; }
    private function filePath(string $key): string { return $this->filesDirectory . '/' . $key; }
    private function exists(string $path): bool { return $this->quiet(static fn (): array|false => lstat($path)) !== false; }
    private function isRegularFile(string $path): bool { $stat = $this->quiet(static fn (): array|false => lstat($path)); return $stat !== false && (($stat['mode'] & 0170000) === 0100000); }
    private function removeFile(string $path): void { $stat = $this->quiet(static fn (): array|false => lstat($path)); if ($stat === false) return; if (($stat['mode'] & 0170000) !== 0100000 || !$this->quiet(static fn (): bool => unlink($path))) throw new RuntimeException('Photo storage operation failed.'); }
    private function quiet(callable $operation): mixed { set_error_handler(static fn (): bool => true); try { return $operation(); } finally { restore_error_handler(); } }
    private function secureHandle($handle): bool { return !function_exists('fchmod') || $this->quiet(static fn (): bool => fchmod($handle, 0600)); }
    private function releaseImage(\GdImage $image): void { if (PHP_VERSION_ID < 80500) imagedestroy($image); }
}
