<?php

declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Crypto.php';
require_once __DIR__ . '/../src/PhotoStorage.php';

use Finados\Config;
use Finados\Crypto;
use Finados\PhotoStorage;

function photo_test_root(): string
{
    $root = tempnam(sys_get_temp_dir(), 'finados-photo-storage-');
    if ($root === false || !unlink($root) || !mkdir($root, 0700)) {
        throw new RuntimeException('Unable to create temporary photo storage root.');
    }

    register_shutdown_function(static function () use ($root): void {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $entry) {
            $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
        }
        rmdir($root);
    });

    return $root;
}

function photo_test_config(string $root): Config
{
    $path = $root . '/finados-backend.json';
    $config = json_encode([
        'environment' => 'test',
        'databaseDsn' => 'sqlite::memory:',
        'databaseUser' => '',
        'databasePassword' => '',
        'allowedOrigin' => 'http://127.0.0.1:4173',
        'encryptionKey' => base64_encode(str_repeat('e', 32)),
        'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], JSON_THROW_ON_ERROR);
    if (file_put_contents($path, $config) === false) {
        throw new RuntimeException('Unable to create temporary photo storage configuration.');
    }

    return Config::fromFile($path);
}

function jpeg_photo(int $width, int $height): string
{
    $path = tempnam(sys_get_temp_dir(), 'vocero-photo-');
    if ($path === false) {
        throw new RuntimeException('Unable to create temporary JPEG.');
    }
    $image = imagecreatetruecolor($width, $height);
    if ($image === false || !imagejpeg($image, $path, 95)) {
        throw new RuntimeException('Unable to create JPEG fixture.');
    }
    if (PHP_VERSION_ID < 80500) {
        imagedestroy($image);
    }
    register_shutdown_function(static fn (): bool => unlink($path));

    return $path;
}

function oriented_jpeg_photo(int $orientation): string
{
    $path = jpeg_photo(100, 200);
    $jpeg = file_get_contents($path);
    if ($jpeg === false) {
        throw new RuntimeException('Unable to read JPEG fixture.');
    }
    $exif = "Exif\0\0II*\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0" . pack('v', $orientation) . "\0\0\0\0";
    if (file_put_contents($path, substr($jpeg, 0, 2) . "\xFF\xE1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2)) === false) {
        throw new RuntimeException('Unable to write oriented JPEG fixture.');
    }

    return $path;
}

function png_photo(int $width, int $height): string
{
    $path = tempnam(sys_get_temp_dir(), 'vocero-png-');
    if ($path === false) {
        throw new RuntimeException('Unable to create temporary PNG.');
    }
    $image = imagecreatetruecolor($width, $height);
    if ($image === false || !imagepng($image, $path)) {
        throw new RuntimeException('Unable to create PNG fixture.');
    }
    if (PHP_VERSION_ID < 80500) {
        imagedestroy($image);
    }
    register_shutdown_function(static fn (): bool => unlink($path));

    return $path;
}

function invalid_photo_path(string $contents, string $suffix = ''): string
{
    $path = tempnam(sys_get_temp_dir(), 'vocero-invalid-' . $suffix);
    if ($path === false || file_put_contents($path, $contents) === false) {
        throw new RuntimeException('Unable to create invalid photo fixture.');
    }
    register_shutdown_function(static fn (): bool => unlink($path));

    return $path;
}

function photo_error(callable $callback, string $sourcePath = ''): void
{
    try {
        $callback();
    } catch (RuntimeException $exception) {
        if ($sourcePath !== '' && str_contains($exception->getMessage(), $sourcePath)) {
            throw new RuntimeException('Photo error leaked its source path.');
        }
        return;
    }

    throw new RuntimeException('Expected photo storage to reject input.');
}

$root = photo_test_root();
$config = photo_test_config($root);
$storage = new PhotoStorage($config, new Crypto($config));

$source = jpeg_photo(2000, 1000);
$prepared = $storage->stage($source, filesize($source));
same(1600, $prepared['width']);
same(800, $prepared['height']);
same('image/jpeg', $prepared['mime_type']);
same(true, preg_match('/^[a-f0-9]{64}$/D', $prepared['storage_key']) === 1);
same(0700, fileperms($root . '/voceros-photos') & 0777);
same(0700, fileperms($root . '/voceros-photos/staging') & 0777);
same(0700, fileperms($root . '/voceros-photos/files') & 0777);
$stagedPath = $root . '/voceros-photos/staging/' . $prepared['storage_key'];
same(true, is_file($stagedPath));
same(0600, fileperms($stagedPath) & 0777);
$ciphertext = file_get_contents($stagedPath);
if ($ciphertext === false) {
    throw new RuntimeException('Unable to read staged ciphertext.');
}
same(false, str_starts_with($ciphertext, "\xFF\xD8"));

$storage->promote($prepared);
same(false, file_exists($stagedPath));
same(true, is_file($root . '/voceros-photos/files/' . $prepared['storage_key']));
$jpeg = $storage->read($prepared['storage_key']);
same(true, str_starts_with($jpeg, "\xFF\xD8"));
same($prepared['sha256'], hash('sha256', $jpeg));
same(true, $storage->verify($prepared['storage_key'], $prepared['sha256']));
same(false, $storage->verify($prepared['storage_key'], hash('sha256', 'different')));
$decoded = imagecreatefromstring($jpeg);
if ($decoded === false) {
    throw new RuntimeException('Stored JPEG did not decode.');
}
same(1600, imagesx($decoded));
same(800, imagesy($decoded));
same(true, imageistruecolor($decoded));
if (PHP_VERSION_ID < 80500) {
    imagedestroy($decoded);
}
$storage->delete($prepared['storage_key']);
same(false, file_exists($root . '/voceros-photos/files/' . $prepared['storage_key']));

foreach ([3 => [100, 200], 6 => [200, 100], 8 => [200, 100]] as $orientation => $dimensions) {
    $orientedPath = oriented_jpeg_photo($orientation);
    $oriented = $storage->stage($orientedPath, filesize($orientedPath));
    same($dimensions[0], $oriented['width']);
    same($dimensions[1], $oriented['height']);
    $storage->promote($oriented);
    same(false, str_contains($storage->read($oriented['storage_key']), 'Exif'));
    $storage->delete($oriented['storage_key']);
}

$pngPath = png_photo(100, 50);
$pngPrepared = $storage->stage($pngPath, filesize($pngPath));
same('image/jpeg', $pngPrepared['mime_type']);
$storage->discard($pngPrepared);

$discardPath = jpeg_photo(20, 20);
$discarded = $storage->stage($discardPath, filesize($discardPath));
$storage->discard($discarded);
same(false, file_exists($root . '/voceros-photos/staging/' . $discarded['storage_key']));

$empty = invalid_photo_path('');
photo_error(fn () => $storage->stage($empty, 0), $empty);
$oversize = jpeg_photo(20, 20);
photo_error(fn () => $storage->stage($oversize, (5 * 1024 * 1024) + 1), $oversize);
$symlinkTarget = jpeg_photo(20, 20);
$symlinkSource = $root . '/source-link.jpg';
if (!symlink($symlinkTarget, $symlinkSource)) {
    throw new RuntimeException('Unable to create source symlink fixture.');
}
photo_error(fn () => $storage->stage($symlinkSource, filesize($symlinkTarget)), $symlinkSource);
$text = invalid_photo_path('not an image', '.jpg');
photo_error(fn () => $storage->stage($text, filesize($text)), $text);
$corrupt = invalid_photo_path("\xFF\xD8\xFF\xE0corrupt", '.jpg');
photo_error(fn () => $storage->stage($corrupt, filesize($corrupt)), $corrupt);
$tooManyPixels = invalid_photo_path("\x89PNG\r\n\x1A\n\0\0\0\rIHDR" . pack('N2', 5001, 5001) . "\x08\x02\0\0\0", '.png');
photo_error(fn () => $storage->stage($tooManyPixels, filesize($tooManyPixels)), $tooManyPixels);

if (function_exists('imagecreatefromwebp')) {
    $webp = tempnam(sys_get_temp_dir(), 'vocero-webp-');
    if ($webp === false) {
        throw new RuntimeException('Unable to create WebP fixture.');
    }
    $webpImage = imagecreatetruecolor(100, 50);
    if ($webpImage === false || !imagewebp($webpImage, $webp, 90)) {
        throw new RuntimeException('Unable to create WebP fixture.');
    }
    if (PHP_VERSION_ID < 80500) {
        imagedestroy($webpImage);
    }
    register_shutdown_function(static fn (): bool => unlink($webp));
    $webpPrepared = $storage->stage($webp, filesize($webp));
    same('image/jpeg', $webpPrepared['mime_type']);
    $storage->discard($webpPrepared);
}

photo_error(fn () => $storage->read('../' . $prepared['storage_key']));
photo_error(fn () => $storage->delete(str_repeat('z', 64)));
$symlinkKey = str_repeat('a', 64);
if (!symlink($symlinkTarget, $root . '/voceros-photos/files/' . $symlinkKey)) {
    throw new RuntimeException('Unable to create stored symlink fixture.');
}
photo_error(fn () => $storage->read($symlinkKey));

$promoteFailurePath = jpeg_photo(20, 20);
$promoteFailure = $storage->stage($promoteFailurePath, filesize($promoteFailurePath));
unlink($root . '/voceros-photos/staging/' . $promoteFailure['storage_key']);
photo_error(fn () => $storage->promote($promoteFailure));
