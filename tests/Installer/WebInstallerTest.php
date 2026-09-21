<?php

declare(strict_types=1);

namespace Flex\Tests\Installer;

use Flex\Installer\Contracts\AdministratorCreatorInterface;
use Flex\Installer\Contracts\DatabaseProbeInterface;
use Flex\Installer\Contracts\EnvironmentWriterInterface;
use Flex\Installer\Contracts\MigrationRunnerInterface;
use Flex\Installer\DatabaseProbeResult;
use Flex\Installer\Exception\InstallerException;
use Flex\Installer\InstallationState;
use Flex\Installer\InstallerInput;
use Flex\Installer\RequirementsChecker;
use Flex\Installer\WebInstaller;
use Flex\Updates\Platform\PlatformVersionRegistry;
use PHPUnit\Framework\TestCase;

final class WebInstallerTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-web-installer-' . bin2hex(random_bytes(6));
        foreach (['storage/cache', 'storage/logs', 'storage/sessions', 'storage/tmp', 'public/media'] as $path) {
            mkdir($this->directory . '/' . $path, 0775, true);
        }
        file_put_contents($this->directory . '/platform.json', '{"name":"flex-cms","version":"1.0.0"}');
    }

    protected function tearDown(): void
    {
        @unlink($this->directory . '/storage/installed.json');
        @unlink($this->directory . '/storage/tmp/installer.lock');
        @unlink($this->directory . '/platform.json');
        foreach (['public/media', 'public', 'storage/tmp', 'storage/sessions', 'storage/logs', 'storage/cache', 'storage'] as $path) {
            @rmdir($this->directory . '/' . $path);
        }
        @rmdir($this->directory);
    }

    public function testItOrchestratesInstallationAndWritesTheMarker(): void
    {
        $environment = $this->environmentWriter();
        $migrations = $this->migrationRunner();
        $administrator = $this->administratorCreator();
        $state = new InstallationState($this->directory);
        $installer = $this->installer($state, $environment, $migrations, $administrator);

        $installer->install($this->input());

        self::assertTrue($environment->written);
        self::assertFalse($environment->removed);
        self::assertTrue($migrations->migrated);
        self::assertTrue($administrator->created);
        self::assertFalse($state->requiresInstallation());
        self::assertFileExists($state->markerPath());
    }

    public function testItRemovesEnvironmentWhenInstallationFails(): void
    {
        $environment = $this->environmentWriter();
        $migrations = new class implements MigrationRunnerInterface {
            public function migrate(): void
            {
                throw new \RuntimeException('Migration failed.');
            }
        };
        $administrator = $this->administratorCreator();
        $state = new InstallationState($this->directory);

        try {
            $this->installer($state, $environment, $migrations, $administrator)->install($this->input());
            self::fail('The installation was expected to fail.');
        } catch (InstallerException $exception) {
            self::assertSame('Flex CMS installation failed. You can correct the settings and try again.', $exception->getMessage());
        }

        self::assertTrue($environment->written);
        self::assertTrue($environment->removed);
        self::assertFalse($administrator->created);
        self::assertTrue($state->requiresInstallation());
        self::assertFileDoesNotExist($state->markerPath());
    }

    private function installer(
        InstallationState $state,
        EnvironmentWriterInterface $environment,
        MigrationRunnerInterface $migrations,
        AdministratorCreatorInterface $administrator,
    ): WebInstaller {
        return new WebInstaller(
            $this->directory,
            $state,
            new RequirementsChecker($this->directory),
            new class implements DatabaseProbeInterface {
                public function check(InstallerInput $input): DatabaseProbeResult
                {
                    return new DatabaseProbeResult(true, '8.0.46');
                }

                public function connect(InstallerInput $input): \PDO
                {
                    throw new \LogicException('The probe connection is not used by this test.');
                }
            },
            $environment,
            $migrations,
            $administrator,
            new PlatformVersionRegistry($this->directory),
        );
    }

    private function environmentWriter(): TestEnvironmentWriter
    {
        return new TestEnvironmentWriter();
    }

    private function migrationRunner(): TestMigrationRunner
    {
        return new TestMigrationRunner();
    }

    private function administratorCreator(): TestAdministratorCreator
    {
        return new TestAdministratorCreator();
    }

    private function input(): InstallerInput
    {
        return new InstallerInput(
            'Flex CMS',
            'https://example.test',
            'Europe/Sofia',
            'bg',
            'mysql',
            3306,
            'flex_cms',
            'flex_cms',
            'database-password',
            'Administrator',
            'admin@example.test',
            'administrator-password',
        );
    }
}

final class TestEnvironmentWriter implements EnvironmentWriterInterface
{
    public bool $written = false;
    public bool $removed = false;

    public function write(array $values): void
    {
        $this->written = true;
    }

    public function remove(): void
    {
        $this->removed = true;
    }
}

final class TestMigrationRunner implements MigrationRunnerInterface
{
    public bool $migrated = false;

    public function migrate(): void
    {
        $this->migrated = true;
    }
}

final class TestAdministratorCreator implements AdministratorCreatorInterface
{
    public bool $created = false;

    public function create(InstallerInput $input): void
    {
        $this->created = true;
    }
}
