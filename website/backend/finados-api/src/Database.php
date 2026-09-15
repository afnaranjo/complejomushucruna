<?php

declare(strict_types=1);

namespace Finados;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    public static function connect(Config $config): PDO
    {
        $sqlite = str_starts_with($config->databaseDsn(), 'sqlite:');
        if ($sqlite && $config->isProduction()) {
            throw new RuntimeException('Production requires MySQL or MariaDB.');
        }
        try {
            $pdo = new PDO($config->databaseDsn(), $config->databaseUser(), $config->databasePassword(), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            if ($sqlite) {
                $pdo->exec('PRAGMA foreign_keys = ON');
            }
            return $pdo;
        } catch (PDOException) {
            // Do not expose credentials or the server address through connection errors.
            throw new RuntimeException('Database connection is unavailable.');
        }
    }
}
