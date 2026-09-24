<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/FinadosNameQueue.php';

$dbPath = tempnam(sys_get_temp_dir(), 'finados-name-queue-');
$pdo = new PDO('sqlite:' . $dbPath, '', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/027_finados_name_queue_sqlite.sql'));
$queue = new Finados\FinadosNameQueue($pdo);

$first = $queue->enqueue('  María <Luz>  ', true);
same(true, $first['queued']);
same('María &lt;Luz&gt;', $first['display_name']);

$duplicate = $queue->enqueue('María <Luz>', true);
same($first['public_id'], $duplicate['public_id']);
same(1, count($queue->pending(20)));
same(0, count($queue->pending(20)));

throws(static fn (): array => $queue->enqueue('', true), InvalidArgumentException::class);
throws(static fn (): array => $queue->enqueue(str_repeat('x', 61), true), InvalidArgumentException::class);
throws(static fn (): array => $queue->enqueue('Sin permiso', false), InvalidArgumentException::class);

$expired = $queue->enqueue('Caducado', true);
$pdo->prepare('UPDATE finados_name_queue SET expires_at = ? WHERE public_id = ?')->execute(['2000-01-01 00:00:00', $expired['public_id']]);
same(0, count($queue->pending(20)));

unlink($dbPath);
