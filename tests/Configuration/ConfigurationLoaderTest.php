<?php

declare(strict_types=1);

namespace Flex\Tests\Configuration;

use Flex\Configuration\ConfigurationCache;
use Flex\Configuration\ConfigurationLoader;
use PHPUnit\Framework\TestCase;

final class ConfigurationLoaderTest extends TestCase
{
    private string $workspace;

    protected function setUp(): void
    {
        $this->workspace = sys_get_temp_dir() . '/flex-config-test-' . bin2hex(random_bytes(6));
        self::assertTrue(mkdir($this->workspace . '/config', 0775, true));
        self::assertTrue(mkdir($this->workspace . '/storage/cache', 0775, true));
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->workspace);
    }

    public function testItLoadsSortedConfigurationFiles(): void
    {
        file_put_contents($this->workspace . '/config/app.php', "<?php return ['name' => 'Flex CMS'];");
        file_put_contents($this->workspace . '/config/cache.php', "<?php return ['driver' => 'file'];");

        $configuration = (new ConfigurationLoader())->load($this->workspace, false);

        self::assertSame('Flex CMS', $configuration->string('app.name'));
        self::assertSame('file', $configuration->string('cache.driver'));
    }

    public function testItWritesAndLoadsConfigurationCache(): void
    {
        file_put_contents($this->workspace . '/config/app.php', "<?php return ['name' => 'Flex CMS'];");
        $configuration = (new ConfigurationLoader())->load($this->workspace, false);
        $cache = new ConfigurationCache($this->workspace, $configuration);
        $cache->write();
        file_put_contents($this->workspace . '/config/app.php', "<?php return ['name' => 'Changed'];");

        $cached = (new ConfigurationLoader())->load($this->workspace, true);

        self::assertSame('Flex CMS', $cached->string('app.name'));
        self::assertTrue($cache->clear());
        self::assertFileDoesNotExist($cache->path());
    }

    private function removeDirectory(string $path): void
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($path);
    }
}
