<?php

declare(strict_types=1);

namespace Flex\Tests\Settings;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Settings\PlatformDiagnostics;
use Flex\Updates\Exception\PlatformUpdateException;
use Flex\Updates\Platform\PlatformVersionRegistry;
use PHPUnit\Framework\TestCase;

final class PlatformDiagnosticsTest extends TestCase
{
    public function testCheckSurvivesMissingPlatformManifest(): void
    {
        $root = sys_get_temp_dir() . '/flex-diagnostics-' . bin2hex(random_bytes(4));
        mkdir($root . '/storage/logs', 0775, true);
        $config = new ConfigurationRepository(['paths' => ['storage' => 'storage', 'config' => 'config']]);
        $database = $this->createMock(DatabaseManager::class);
        $connection = new class {
            public function select(string $sql): void {}
        };
        $database->method('connection')->willReturn($connection);
        $versions = $this->createMock(PlatformVersionRegistry::class);
        $versions->method('current')->willThrowException(new PlatformUpdateException('missing manifest'));
        $diagnostics = new PlatformDiagnostics(
            $database,
            new ProjectPaths($root, $config),
            $versions,
        );

        $report = $diagnostics->check();

        self::assertSame('Непозната', $report['Версия на платформата']);
        self::assertArrayHasKey('Дневник на операционни грешки', $report);
    }
}
