<?php

declare(strict_types=1);

namespace Flex\Tests\Installer;

use Flex\Installer\EnvironmentFileWriter;
use Flex\Installer\Exception\InstallerException;
use PHPUnit\Framework\TestCase;

final class EnvironmentFileWriterTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-env-writer-' . bin2hex(random_bytes(6));
        mkdir($this->directory, 0775, true);
        mkdir($this->directory . '/storage', 0775, true);
        file_put_contents($this->directory . '/.env.example', "APP_NAME=Flex CMS\nDB_PASSWORD=\n");
    }

    protected function tearDown(): void
    {
        @unlink($this->directory . '/storage/.env');
        @unlink($this->directory . '/.env.example');
        @unlink($this->directory . '/storage/.env.installing');
        @rmdir($this->directory . '/storage');
        @rmdir($this->directory);
    }

    public function testItWritesQuotedValuesAtomically(): void
    {
        $writer = new EnvironmentFileWriter($this->directory);
        $writer->write(['APP_NAME' => 'My "Site"', 'DB_PASSWORD' => 'secret#value']);

        $contents = file_get_contents($this->directory . '/storage/.env');
        self::assertIsString($contents);
        self::assertStringContainsString('APP_NAME="My \\"Site\\""', $contents);
        self::assertStringContainsString('DB_PASSWORD="secret#value"', $contents);

        $writer->remove();
        self::assertFileDoesNotExist($this->directory . '/storage/.env');
    }

    public function testItNeverOverwritesAnExistingEnvironment(): void
    {
        file_put_contents($this->directory . '/storage/.env', 'existing');

        $this->expectException(InstallerException::class);
        $this->expectExceptionMessage('The environment file already exists.');

        (new EnvironmentFileWriter($this->directory))->write(['APP_NAME' => 'New']);
    }

    public function testItKeepsTheConfiguredWorkerGroupAbleToReadTheEnvironment(): void
    {
        if (!function_exists('posix_getegid')) self::markTestSkipped('Requires POSIX permissions.');
        $previous = $_ENV['FLEX_CMS_GID'] ?? null;
        $_ENV['FLEX_CMS_GID'] = (string) posix_getegid();
        try {
            (new EnvironmentFileWriter($this->directory))->write(['APP_NAME' => 'Worker readable']);
            $path = $this->directory . '/storage/.env';
            clearstatcache(true, $path);
            self::assertSame(0640, fileperms($path) & 0777);
            self::assertSame(posix_getegid(), filegroup($path));
        } finally {
            if ($previous === null) unset($_ENV['FLEX_CMS_GID']);
            else $_ENV['FLEX_CMS_GID'] = $previous;
        }
    }
}
