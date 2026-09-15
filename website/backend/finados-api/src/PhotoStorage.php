<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;

final class PhotoStorage
{
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const MAX_PIXELS = 25_000_000;
    private const MAX_SIDE = 1600;
    private const KEY_PATTERN = '/^[a-f0-9]{64}$/D';

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
            if (!$this->isRegularFile($temporaryPath) || $declaredSize <= 0 || $declaredSize > self::MAX_BYTES) {
                throw new RuntimeException('Invalid photo upload.');
            }

            clearstatcache(true, $temporaryPath);
            $actualSize = filesize($temporaryPath);
            if ($actualSize === false || $actualSize <= 0 || $actualSize > self::MAX_BYTES || $actualSize !== $declaredSize) {
                throw new RuntimeException('Invalid photo upload.');
            }

            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($temporaryPath);
            if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
                throw new RuntimeException('Invalid photo upload.');
            }
            if ($mime === 'image/webp' && !function_exists('imagecreatefromwebp')) {
                throw new RuntimeException('Invalid photo upload.');
            }

            $details = $this->quiet(static fn (): array|false => getimagesize($temporaryPath));
            if (!is_array($details) || !isset($details[0], $details[1], $details['mime']) || $details['mime'] !== $mime) {
                throw new RuntimeException('Invalid photo upload.');
            }
            $width = $details[0];
            $height = $details[1];
            if (!is_int($width) || !is_int($height) || $width <= 0 || $height <= 0 || $width > intdiv(self::MAX_PIXELS, $height)) {
                throw new RuntimeException('Invalid photo upload.');
            }

            $contents = file_get_contents($temporaryPath);
            if ($contents === false) {
                throw new RuntimeException('Invalid photo upload.');
            }
            $source = $this->quiet(static fn (): \GdImage|false => imagecreatefromstring($contents));
            if ($source === false) {
                throw new RuntimeException('Invalid photo upload.');
            }

            try {
                if ($mime === 'image/jpeg') {
                    $source = $this->applyOrientation($source, $temporaryPath);
                }
                $normalized = $this->normalize($source);
                try {
                    $jpeg = $this->encodeJpeg($normalized);
                } finally {
                    $this->releaseImage($normalized);
                }
            } finally {
                $this->releaseImage($source);
            }

            $key = bin2hex(random_bytes(32));
            $ciphertext = $this->crypto->encrypt($jpeg);
            $this->writeExclusive($this->stagingPath($key), $ciphertext);

            $size = getimagesizefromstring($jpeg);
            if (!is_array($size) || !isset($size[0], $size[1])) {
                $this->removeFile($this->stagingPath($key));
                throw new RuntimeException('Photo storage operation failed.');
            }

            return [
                'storage_key' => $key,
                'mime_type' => 'image/jpeg',
                'bytes' => strlen($jpeg),
                'sha256' => hash('sha256', $jpeg),
                'width' => $size[0],
                'height' => $size[1],
            ];
        } catch (RuntimeException $exception) {
            throw $exception;
        } catch (\Throwable) {
            throw new RuntimeException('Photo storage operation failed.');
        }
    }

    /** @param array{storage_key:string} $photo */
    public function promote(array $photo): void
    {
        $key = $this->photoKey($photo);
        $source = $this->stagingPath($key);
        $destination = $this->filePath($key);
        if (!$this->isRegularFile($source) || file_exists($destination) || is_link($destination) || !$this->quiet(static fn (): bool => rename($source, $destination))) {
            throw new RuntimeException('Photo storage operation failed.');
        }
        if (!$this->quiet(static fn (): bool => chmod($destination, 0600))) {
            $this->removeFile($destination);
            throw new RuntimeException('Photo storage operation failed.');
        }
    }

    /** @param array{storage_key:string} $photo */
    public function discard(array $photo): void
    {
        $this->removeFile($this->stagingPath($this->photoKey($photo)));
    }

    public function delete(string $storageKey): void
    {
        $this->removeFile($this->filePath($this->validKey($storageKey)));
    }

    public function read(string $storageKey): string
    {
        $path = $this->filePath($this->validKey($storageKey));
        if (!$this->isRegularFile($path)) {
            throw new RuntimeException('Photo storage operation failed.');
        }
        $encrypted = file_get_contents($path);
        if ($encrypted === false) {
            throw new RuntimeException('Photo storage operation failed.');
        }

        try {
            $jpeg = $this->crypto->decrypt($encrypted);
        } catch (\Throwable) {
            throw new RuntimeException('Photo storage operation failed.');
        }
        $details = $this->quiet(static fn (): array|false => getimagesizefromstring($jpeg));
        if (!str_starts_with($jpeg, "\xFF\xD8") || !is_array($details) || ($details['mime'] ?? null) !== 'image/jpeg') {
            throw new RuntimeException('Photo storage operation failed.');
        }

        return $jpeg;
    }

    public function verify(string $storageKey, string $sha256): bool
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $sha256)) {
            return false;
        }

        try {
            return hash_equals($sha256, hash('sha256', $this->read($storageKey)));
        } catch (RuntimeException) {
            return false;
        }
    }

    private function ensureDirectories(): void
    {
        foreach ([$this->root, $this->stagingDirectory, $this->filesDirectory] as $directory) {
            if (is_link($directory) || (!is_dir($directory) && !$this->quiet(static fn (): bool => mkdir($directory, 0700)))) {
                throw new RuntimeException('Photo storage is unavailable.');
            }
            if (!is_dir($directory) || is_link($directory) || !$this->quiet(static fn (): bool => chmod($directory, 0700))) {
                throw new RuntimeException('Photo storage is unavailable.');
            }
        }
    }

    private function applyOrientation(\GdImage $source, string $path): \GdImage
    {
        if (!function_exists('exif_read_data')) {
            return $source;
        }
        $exif = $this->quiet(static fn (): array|false => exif_read_data($path, 'IFD0'));
        $orientation = is_array($exif) ? ($exif['Orientation'] ?? null) : null;
        $angle = match ($orientation) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => null,
        };
        if ($angle === null) {
            return $source;
        }
        $rotated = imagerotate($source, $angle, 0);
        if ($rotated === false) {
            throw new RuntimeException('Invalid photo upload.');
        }
        $this->releaseImage($source);

        return $rotated;
    }

    private function normalize(\GdImage $source): \GdImage
    {
        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
        $scale = min(1, self::MAX_SIDE / max($sourceWidth, $sourceHeight));
        $width = max(1, (int) round($sourceWidth * $scale));
        $height = max(1, (int) round($sourceHeight * $scale));
        $normalized = imagecreatetruecolor($width, $height);
        if ($normalized === false) {
            throw new RuntimeException('Photo storage operation failed.');
        }
        $white = imagecolorallocate($normalized, 255, 255, 255);
        imagefill($normalized, 0, 0, $white);
        if (!imagecopyresampled($normalized, $source, 0, 0, 0, 0, $width, $height, $sourceWidth, $sourceHeight)) {
            $this->releaseImage($normalized);
            throw new RuntimeException('Photo storage operation failed.');
        }

        return $normalized;
    }

    private function encodeJpeg(\GdImage $image): string
    {
        ob_start();
        $written = imagejpeg($image, null, 88);
        $jpeg = ob_get_clean();
        if (!$written || !is_string($jpeg) || $jpeg === '') {
            throw new RuntimeException('Photo storage operation failed.');
        }

        return $jpeg;
    }

    private function writeExclusive(string $path, string $contents): void
    {
        $handle = $this->quiet(static fn () => fopen($path, 'x'));
        if ($handle === false) {
            throw new RuntimeException('Photo storage operation failed.');
        }
        $complete = false;
        try {
            $complete = fwrite($handle, $contents) === strlen($contents);
        } finally {
            fclose($handle);
        }
        if (!$complete) {
            $this->removeFile($path);
            throw new RuntimeException('Photo storage operation failed.');
        }
        if (!$this->quiet(static fn (): bool => chmod($path, 0600))) {
            $this->removeFile($path);
            throw new RuntimeException('Photo storage operation failed.');
        }
    }

    private function photoKey(array $photo): string
    {
        return $this->validKey($photo['storage_key'] ?? '');
    }

    private function validKey(string $key): string
    {
        if (!preg_match(self::KEY_PATTERN, $key)) {
            throw new RuntimeException('Invalid photo reference.');
        }

        return $key;
    }

    private function stagingPath(string $key): string
    {
        return $this->stagingDirectory . '/' . $key;
    }

    private function filePath(string $key): string
    {
        return $this->filesDirectory . '/' . $key;
    }

    private function isRegularFile(string $path): bool
    {
        $stat = $this->quiet(static fn (): array|false => lstat($path));

        return $stat !== false && (($stat['mode'] & 0170000) === 0100000) && !is_link($path) && is_readable($path);
    }

    private function removeFile(string $path): void
    {
        $stat = $this->quiet(static fn (): array|false => lstat($path));
        if ($stat === false) {
            return;
        }
        if (($stat['mode'] & 0170000) !== 0100000 || is_link($path) || !$this->quiet(static fn (): bool => unlink($path))) {
            throw new RuntimeException('Photo storage operation failed.');
        }
    }

    private function quiet(callable $operation): mixed
    {
        set_error_handler(static fn (): bool => true);
        try {
            return $operation();
        } finally {
            restore_error_handler();
        }
    }

    private function releaseImage(\GdImage $image): void
    {
        if (PHP_VERSION_ID < 80500) {
            imagedestroy($image);
        }
    }
}
