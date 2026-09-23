<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginRegistry;
use PHPUnit\Framework\TestCase;

final class PluginManagerTest extends TestCase
{
    private string $directory;
    private DatabaseManager $database;
    private PluginManager $manager;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-plugin-manager-' . bin2hex(random_bytes(5));
        mkdir($this->directory . '/plugins/acme/forms', 0775, true);
        file_put_contents($this->directory . '/plugins/acme/forms/plugin.json', json_encode([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Acme\\Forms\\Plugin',
        ], JSON_THROW_ON_ERROR));

        $this->database = new DatabaseManager(new ConfigurationRepository([
            'database' => [
                'default' => 'sqlite',
                'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']],
            ],
        ]));
        $this->database->schema()->create('plugins', static function ($table): void {
            $table->string('id', 190)->primary();
            $table->string('name', 190);
            $table->string('version', 80);
            $table->text('description')->nullable();
            $table->string('entrypoint', 255);
            $table->string('path', 500);
            $table->string('status', 30)->default('inactive');
            $table->text('manifest')->nullable();
            $table->dateTime('installed_at')->nullable();
            $table->dateTime('activated_at')->nullable();
            $table->timestamps();
        });

        $paths = new ProjectPaths($this->directory, new ConfigurationRepository(['paths' => ['plugins' => 'plugins']]));
        $this->manager = new PluginManager(new PluginRegistry($paths));
    }

    protected function tearDown(): void
    {
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($this->directory);
        $this->database->disconnect();
    }

    public function testItInstallsAndChangesPluginLifecycleState(): void
    {
        $plugin = $this->manager->install('acme/forms');
        self::assertSame(PluginManager::STATUS_INSTALLED, $plugin->getAttribute('status'));

        $plugin = $this->manager->activate('acme/forms');
        self::assertSame(PluginManager::STATUS_ACTIVE, $plugin->getAttribute('status'));
        self::assertNotNull($plugin->getAttribute('activated_at'));

        $plugin = $this->manager->deactivate('acme/forms');
        self::assertSame(PluginManager::STATUS_INACTIVE, $plugin->getAttribute('status'));
        self::assertNull($plugin->getAttribute('activated_at'));
    }
}
