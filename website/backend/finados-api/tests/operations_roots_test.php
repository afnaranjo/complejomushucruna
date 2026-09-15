<?php

declare(strict_types=1);
require_once __DIR__ . '/OperationsTest.php';

// Production operations must stop before any write unless both docroots are explicitly verified.
[$rootsRoot] = operations_fixture(['environment' => 'production', 'allowedOrigin' => 'https://example.invalid',
    'databaseDsn' => 'mysql:host=127.0.0.1;dbname=synthetic']);
mkdir($rootsRoot . '/domain-one', 0700);
mkdir($rootsRoot . '/domain-two', 0700);
$publicRoots = [realpath($rootsRoot . '/domain-one'), realpath($rootsRoot . '/domain-two')];
[$rootsVoceros, $rootsConsents] = historical_rows();
write_historical_files($rootsRoot, $rootsVoceros, $rootsConsents);
file_put_contents($rootsRoot . '/mysqldump', '#!' . PHP_BINARY . "\n<?php echo \"-- synthetic dump\\nCREATE TABLE fixture (id INT);\\n\";\n");
chmod($rootsRoot . '/mysqldump', 0700);
$rootsEnv = array_replace(getenv(), ['FINADOS_CONFIG_PATH' => $rootsRoot . '/config.json', 'PATH' => $rootsRoot]);
unset($rootsEnv['FINADOS_PUBLIC_ROOTS'], $rootsEnv['DOCUMENT_ROOT']);
$rootsImportArgs = array_slice(import_arguments($rootsRoot), 2);
same(1, operations_cli('import-voceros', [...$rootsImportArgs, '--dry-run'], $rootsEnv)['code']);
same(1, operations_cli('backup', ['--output', $rootsRoot . '/missing-roots-backup'], $rootsEnv)['code']);
same(false, file_exists($rootsRoot . '/imports'));
same(false, file_exists($rootsRoot . '/missing-roots-backup'));

symlink($publicRoots[1], $rootsRoot . '/domain-alias');
foreach (['not-json', '{}', '[]', json_encode([$publicRoots[0]]), json_encode([$publicRoots[0], $publicRoots[0]]),
    json_encode([$publicRoots[0], $rootsRoot . '/nonexistent']), json_encode([$publicRoots[0], 'relative/root']),
    json_encode([$publicRoots[0], $rootsRoot . '/domain-alias'])] as $invalidRoots) {
    $invalidRootsEnv = array_replace($rootsEnv, ['FINADOS_PUBLIC_ROOTS' => $invalidRoots]);
    same(1, operations_cli('import-voceros', [...$rootsImportArgs, '--dry-run'], $invalidRootsEnv)['code']);
    same(1, operations_cli('backup', ['--output', $rootsRoot . '/invalid-roots-backup'], $invalidRootsEnv)['code']);
    same(false, file_exists($rootsRoot . '/invalid-roots-backup'));
}
$rootsEnv['FINADOS_PUBLIC_ROOTS'] = json_encode($publicRoots);
same(0, operations_cli('import-voceros', [...$rootsImportArgs, '--dry-run'], $rootsEnv)['code']);
// A fake dump executable cannot replace the live PDO connection needed to hold the media lock.
same(1, operations_cli('backup', ['--output', $rootsRoot . '/private-backup'], $rootsEnv)['code']);
same(false, file_exists($rootsRoot . '/private-backup'));

foreach ([...$publicRoots, $rootsRoot . '/domain-alias'] as $publicDestination) {
    same(1, operations_cli('backup', ['--output', $publicDestination . '/leaked-backup'], $rootsEnv)['code']);
    same(false, file_exists($publicDestination . '/leaked-backup'));
}

// A public config or config alias must be rejected for both domains before imports or backups.
foreach ($publicRoots as $publicRoot) {
    copy($rootsRoot . '/config.json', $publicRoot . '/config.json');
    $publicConfigEnv = array_replace($rootsEnv, ['FINADOS_CONFIG_PATH' => $publicRoot . '/config.json']);
    same(1, operations_cli('import-voceros', $rootsImportArgs, $publicConfigEnv)['code']);
    same(false, file_exists($publicRoot . '/imports'));
    same(1, operations_cli('backup', ['--output', $rootsRoot . '/public-config-backup'], $publicConfigEnv)['code']);
    same(false, file_exists($rootsRoot . '/public-config-backup'));
}
symlink($publicRoots[1] . '/config.json', $rootsRoot . '/config-alias.json');
same(1, operations_cli('import-voceros', [...$rootsImportArgs, '--dry-run'],
    array_replace($rootsEnv, ['FINADOS_CONFIG_PATH' => $rootsRoot . '/config-alias.json']))['code']);

// Imports resolve aliases too; private configuration does not make its sibling alias private.
symlink($publicRoots[1], $rootsRoot . '/imports');
same(1, operations_cli('import-voceros', $rootsImportArgs, $rootsEnv)['code']);
same([], glob($publicRoots[1] . '/*/*.csv'));

// Test configurations may inject the same roots, covering SQLite output without production access.
[$injectedRoot] = operations_fixture();
$injectedEnv = array_replace(getenv(), ['FINADOS_PUBLIC_ROOTS' => json_encode($publicRoots)]);
same(0, operations_cli('backup', ['--config', $injectedRoot . '/config.json', '--output', $injectedRoot . '/private-backup'], $injectedEnv)['code']);
same(1, operations_cli('backup', ['--config', $injectedRoot . '/config.json', '--output', $publicRoots[1] . '/test-backup'], $injectedEnv)['code']);
same(false, file_exists($publicRoots[1] . '/test-backup'));
