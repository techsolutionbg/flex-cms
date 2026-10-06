<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Extensions\PluginRegistry;
use PHPUnit\Framework\TestCase;

final class PluginRegistryTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-plugin-registry-' . bin2hex(random_bytes(5));
        mkdir($this->directory . '/plugins/acme/forms', 0775, true);
        file_put_contents($this->directory . '/plugins/acme/forms/plugin.json', json_encode([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Acme\\Forms\\Plugin',
        ], JSON_THROW_ON_ERROR));
    }

    protected function tearDown(): void
    {
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($this->directory);
    }

    public function testItDiscoversManifestsWithoutExecutingPluginCode(): void
    {
        $discovered = (new PluginRegistry($this->paths()))->discover();

        self::assertCount(1, $discovered);
        self::assertSame('acme/forms', $discovered[0]['manifest']->id);
        self::assertSame($this->directory . '/plugins/acme/forms', $discovered[0]['path']);
    }

    public function testItIgnoresDirectoriesWithoutAManifest(): void
    {
        mkdir($this->directory . '/plugins/not-a-plugin', 0775, true);

        self::assertCount(1, (new PluginRegistry($this->paths()))->discover());
    }

    public function testSourceBrowserReturnsFullCodeAndExcludesPrivateAndBinaryFiles(): void
    {
        $root = $this->directory . '/plugins/acme/forms';
        file_put_contents($root . '/Plugin.php', '<?php echo "Преглед";');
        file_put_contents($root . '/.env', 'SECRET=value');
        file_put_contents($root . '/image.png', 'binary');
        mkdir($root . '/vendor');
        file_put_contents($root . '/vendor/dependency.php', '<?php');
        $source = new \Flex\Extensions\PluginSourceBrowser(new PluginRegistry($this->paths()));
        self::assertSame(['Plugin.php', 'plugin.json'], $source->files('acme/forms'));
        self::assertSame('<?php echo "Преглед";', $source->read('acme/forms', 'Plugin.php'));
    }

    public function testSourceBrowserRejectsTraversal(): void
    {
        $source = new \Flex\Extensions\PluginSourceBrowser(new PluginRegistry($this->paths()));
        $this->expectException(\InvalidArgumentException::class);
        $source->read('acme/forms', '../../../outside.php');
    }

    public function testSourceBrowserIncludesNestedAndEmptyDirectories(): void
    {
        $root = $this->directory . '/plugins/acme/forms';
        mkdir($root . '/src/nested', 0775, true);
        mkdir($root . '/empty');
        mkdir($root . '/.private');
        file_put_contents($root . '/src/nested/Example.php', '<?php');
        $source = new \Flex\Extensions\PluginSourceBrowser(new PluginRegistry($this->paths()));
        self::assertSame(['empty', 'src', 'src/nested'], $source->directories('acme/forms'));
        self::assertContains('src/nested/Example.php', $source->files('acme/forms'));
    }

    public function testSourceBrowserRejectsLinksOutsidePlugin(): void
    {
        file_put_contents($this->directory . '/outside.php', '<?php echo "secret";');
        symlink($this->directory . '/outside.php', $this->directory . '/plugins/acme/forms/linked.php');
        $source = new \Flex\Extensions\PluginSourceBrowser(new PluginRegistry($this->paths()));
        self::assertNotContains('linked.php', $source->files('acme/forms'));
        $this->expectException(\InvalidArgumentException::class);
        $source->read('acme/forms', 'linked.php');
    }

    private function paths(): ProjectPaths
    {
        return new ProjectPaths($this->directory, new ConfigurationRepository([
            'paths' => ['plugins' => 'plugins'],
        ]));
    }
}
