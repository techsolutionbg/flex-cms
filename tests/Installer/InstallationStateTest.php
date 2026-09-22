<?php

declare(strict_types=1);

namespace Flex\Tests\Installer;

use Flex\Installer\InstallationState;
use PHPUnit\Framework\TestCase;

final class InstallationStateTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-installer-state-' . bin2hex(random_bytes(6));
        mkdir($this->directory . '/storage', 0775, true);
    }

    protected function tearDown(): void
    {
        @unlink($this->directory . '/storage/.env');
        @unlink($this->directory . '/storage/installed.json');
        @rmdir($this->directory . '/storage');
        @rmdir($this->directory);
    }

    public function testItRequiresInstallationOnlyWithoutEnvironmentOrMarker(): void
    {
        $state = new InstallationState($this->directory);
        self::assertTrue($state->requiresInstallation());

        file_put_contents($state->environmentPath(), 'APP_ENV=production');
        self::assertFalse($state->requiresInstallation());

        unlink($state->environmentPath());
        file_put_contents($state->markerPath(), '{}');
        self::assertFalse($state->requiresInstallation());
    }

    public function testItTreatsAnEmptyEnvironmentFileAsNotInstalled(): void
    {
        file_put_contents($this->directory . '/storage/.env', '');

        self::assertTrue((new InstallationState($this->directory))->requiresInstallation());
    }
}
