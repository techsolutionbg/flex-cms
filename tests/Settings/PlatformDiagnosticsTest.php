<?php

declare(strict_types=1);

namespace Flex\Tests\Settings;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Settings\PlatformDiagnostics;
use Flex\Updates\Platform\PlatformVersionRegistry;
use PHPUnit\Framework\TestCase;

final class PlatformDiagnosticsTest extends TestCase
{
    public function testCheckSurvivesMissingPlatformManifest(): void
    {
        $root = sys_get_temp_dir() . '/flex-diagnostics-' . bin2hex(random_bytes(4));
        mkdir($root . '/storage/logs', 0775, true);
        $configuration = new ConfigurationRepository([
            'paths' => ['storage' => 'storage', 'config' => 'config'],
            'database' => [
                'default' => 'sqlite',
                'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']],
            ],
        ]);
        $database = new DatabaseManager($configuration);

        try {
            $diagnostics = new PlatformDiagnostics(
                $database,
                new ProjectPaths($root, $configuration),
                new PlatformVersionRegistry($root),
            );

            $report = $diagnostics->check();

            self::assertSame('Непозната', $report['Версия на платформата']);
            self::assertSame('Достъпна', $report['База данни']);
            self::assertArrayHasKey('Дневник на операционни грешки', $report);
        } finally {
            $database->disconnect();
        }
    }
}
