<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Contracts\Updates\PlatformDatabaseBackupInterface;
use Flex\Contracts\Updates\PlatformHealthCheckerInterface;
use Flex\Contracts\Updates\PlatformMigrationRunnerInterface;
use Flex\Updates\Exception\InvalidPlatformPackage;
use Flex\Updates\Exception\PlatformUpdateException;
use Flex\Updates\Platform\PlatformInstallOptions;
use Flex\Updates\Platform\PlatformPackageInspector;
use Flex\Updates\Platform\PlatformVersionInstaller;
use Flex\Updates\Platform\PlatformVersionRegistry;
use PHPUnit\Framework\TestCase;
use ZipArchive;

final class PlatformVersionInstallerTest extends TestCase
{
    private string $workspace;

    protected function setUp(): void
    {
        $this->workspace = sys_get_temp_dir() . '/flex-update-test-' . bin2hex(random_bytes(6));
        self::assertTrue(mkdir($this->workspace . '/storage/tmp', 0775, true));
        self::assertTrue(mkdir($this->workspace . '/src', 0775, true));
        self::assertTrue(mkdir($this->workspace . '/database/migrations', 0775, true));
        $this->writePlatformManifest('1.0.0');
        file_put_contents($this->workspace . '/src/example.php', 'old');
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->workspace);
    }

    public function testItInstallsAVerifiedPlatformPackageAndCreatesBackup(): void
    {
        $package = $this->createPackage('1.1.0', [
            'platform.json' => $this->platformManifest('1.1.0'),
            'src/example.php' => 'new',
        ]);

        $result = $this->installer()->install($package, new PlatformInstallOptions(
            expectedChecksum: $this->checksum($package),
        ));

        self::assertSame('1.0.0', $result->from->value);
        self::assertSame('1.1.0', $result->to->value);
        self::assertSame('new', file_get_contents($this->workspace . '/src/example.php'));
        self::assertSame('1.1.0', (new PlatformVersionRegistry($this->workspace))->current()->value);
        self::assertNotNull($result->backupPath);
        self::assertSame('old', file_get_contents($result->backupPath . '/files/src/example.php'));
        self::assertFileExists($this->workspace . '/storage/updates/history.jsonl');
        self::assertFileDoesNotExist($this->workspace . '/storage/maintenance.json');
    }

    public function testDryRunDoesNotChangeThePlatform(): void
    {
        $package = $this->createPackage('1.1.0', [
            'platform.json' => $this->platformManifest('1.1.0'),
        ]);

        $result = $this->installer()->install($package, new PlatformInstallOptions(
            expectedChecksum: $this->checksum($package),
            dryRun: true,
        ));

        self::assertTrue($result->dryRun);
        self::assertSame('1.0.0', (new PlatformVersionRegistry($this->workspace))->current()->value);
        self::assertDirectoryDoesNotExist($this->workspace . '/storage/backups');
    }

    public function testItRejectsProtectedPaths(): void
    {
        $package = $this->createPackage('1.1.0', [
            'platform.json' => $this->platformManifest('1.1.0'),
            '.env' => 'unsafe',
        ]);

        $this->expectException(InvalidPlatformPackage::class);
        $this->expectExceptionMessage('protected path');
        (new PlatformPackageInspector())->inspect($package);
    }

    public function testItRequiresTheExpectedPackageChecksum(): void
    {
        $package = $this->createPackage('1.1.0', [
            'platform.json' => $this->platformManifest('1.1.0'),
        ]);

        $this->expectException(InvalidPlatformPackage::class);
        $this->expectExceptionMessage('checksum is required');
        $this->installer()->install($package, new PlatformInstallOptions());
    }

    public function testItRestoresFilesWhenMigrationsFail(): void
    {
        $package = $this->createPackage('1.1.0', [
            'platform.json' => $this->platformManifest('1.1.0'),
            'database/migrations/20260922000001_example.php' => '<?php // migration',
            'src/example.php' => 'new',
        ], runMigrations: true);

        $migrationRunner = new class implements PlatformMigrationRunnerInterface {
            public function migrate(): void
            {
                throw new PlatformUpdateException('Migration failed.');
            }
        };
        $databaseBackup = new class implements PlatformDatabaseBackupInterface {
            public function backup(string $path): void {}
            public function restore(string $path): void {}
        };

        try {
            $this->installer($migrationRunner, databaseBackup: $databaseBackup)->install($package, new PlatformInstallOptions(
                expectedChecksum: $this->checksum($package),
            ));
            self::fail('The installer was expected to fail.');
        } catch (PlatformUpdateException $exception) {
            self::assertStringContainsString('backup was restored', $exception->getMessage());
        }

        self::assertSame('old', file_get_contents($this->workspace . '/src/example.php'));
        self::assertSame('1.0.0', (new PlatformVersionRegistry($this->workspace))->current()->value);
        self::assertFileDoesNotExist($this->workspace . '/storage/maintenance.json');
    }

    public function testItRunsTheHealthCheckBeforeCompletingTheUpdate(): void
    {
        $package = $this->createPackage('1.1.0', [
            'platform.json' => $this->platformManifest('1.1.0'),
            'src/example.php' => 'new',
        ]);
        $health = new class implements PlatformHealthCheckerInterface {
            public int $calls = 0;
            public function check(): void
            {
                ++$this->calls;
            }
        };

        $this->installer(healthChecker: $health)->install($package, new PlatformInstallOptions(
            expectedChecksum: $this->checksum($package),
        ));

        self::assertSame(1, $health->calls);
        self::assertFileDoesNotExist($this->workspace . '/storage/updates/state.json');
    }

    private function installer(
        ?PlatformMigrationRunnerInterface $migrationRunner = null,
        ?PlatformHealthCheckerInterface $healthChecker = null,
        ?PlatformDatabaseBackupInterface $databaseBackup = null,
    ): PlatformVersionInstaller {
        $migrationRunner ??= new class implements PlatformMigrationRunnerInterface {
            public function migrate(): void {}
        };

        return new PlatformVersionInstaller(
            basePath: $this->workspace,
            inspector: new PlatformPackageInspector(),
            versions: new PlatformVersionRegistry($this->workspace),
            migrationRunner: $migrationRunner,
            healthChecker: $healthChecker,
            databaseBackup: $databaseBackup,
        );
    }

    /**
     * @param array<string, string> $files
     */
    private function createPackage(string $version, array $files, bool $runMigrations = false): string
    {
        $packagePath = $this->workspace . '/flex-cms-' . $version . '-' . bin2hex(random_bytes(3)) . '.zip';
        $checksums = [];
        foreach ($files as $path => $contents) {
            $checksums[$path] = hash('sha256', $contents);
        }

        $manifest = json_encode([
            'schema' => 1,
            'package' => 'flex-cms',
            'version' => $version,
            'minimum_php' => '>=8.3',
            'compatible_from' => '>=1.0.0 <2.0.0',
            'files' => $checksums,
            'remove' => [],
            'run_migrations' => $runMigrations,
        ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

        $archive = new ZipArchive();
        self::assertTrue($archive->open($packagePath, ZipArchive::CREATE | ZipArchive::OVERWRITE));
        self::assertTrue($archive->addFromString('manifest.json', $manifest));
        foreach ($files as $path => $contents) {
            self::assertTrue($archive->addFromString('payload/' . $path, $contents));
        }
        self::assertTrue($archive->close());

        return $packagePath;
    }

    private function writePlatformManifest(string $version): void
    {
        file_put_contents($this->workspace . '/platform.json', $this->platformManifest($version));
    }

    private function platformManifest(string $version): string
    {
        return json_encode([
            'schema' => 1,
            'name' => 'flex-cms',
            'version' => $version,
            'api_version' => '1.0',
        ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    }

    private function checksum(string $path): string
    {
        $checksum = hash_file('sha256', $path);
        self::assertNotFalse($checksum);

        return $checksum;
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($iterator as $item) {
            if ($item->isDir()) {
                rmdir($item->getPathname());
            } else {
                unlink($item->getPathname());
            }
        }

        rmdir($path);
    }
}
