<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;

final class Crypto
{
    public function __construct(private readonly Config $config)
    {
    }

    public function encrypt(string $value): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($value, 'aes-256-gcm', $this->config->encryptionKey(), OPENSSL_RAW_DATA, $iv, $tag, '', 16);
        if ($ciphertext === false) {
            throw new RuntimeException('Unable to encrypt protected data.');
        }
        return base64_encode($iv . $tag . $ciphertext);
    }

    public function decrypt(string $value): string
    {
        $raw = base64_decode($value, true);
        if ($raw === false || strlen($raw) < 28) {
            throw new RuntimeException('Invalid encrypted data.');
        }
        $plaintext = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $this->config->encryptionKey(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        if ($plaintext === false) {
            throw new RuntimeException('Invalid encrypted data.');
        }
        return $plaintext;
    }

    public function lookup(string $value): string
    {
        return hash_hmac('sha256', strtolower(trim($value)), $this->config->hmacKey());
    }
}
