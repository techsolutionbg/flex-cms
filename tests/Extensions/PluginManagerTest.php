<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginEntrypointLoader;
use Flex\Extensions\PluginRegistry;
use Flex\Extensions\ExtensionApi;
use Flex\Extensions\PluginRuntime;
use PHPUnit\Framework\TestCase;

final class PluginManagerTest extends TestCase
{
    private string $directory;
    private DatabaseManager $database;
    private PluginManager $manager;
    private PluginRuntime $runtime;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-plugin-manager-' . bin2hex(random_bytes(5));
        mkdir($this->directory . '/plugins/acme/forms', 0775, true);
        mkdir($this->directory . '/plugins/acme/forms/src', 0775, true);
        file_put_contents($this->directory . '/plugins/acme/forms/src/Plugin.php', <<<'PHP'
<?php

namespace Flex\Tests\PluginLifecycle;

use Flex\Extension\V1\PluginContext;
use Flex\Extension\V1\PluginInterface;
use Flex\Extension\V1\UninstallablePluginInterface;
use Flex\Extension\V1\UpdatablePluginInterface;
use Flex\Extension\V1\BootablePluginInterface;
final class Plugin implements PluginInterface, UninstallablePluginInterface, UpdatablePluginInterface, BootablePluginInterface
{
    public static array $events = [];

    public function install(PluginContext $context): void { self::$events[] = 'install'; }
    public function activate(PluginContext $context): void { self::$events[] = 'activate'; }
    public function deactivate(PluginContext $context): void { self::$events[] = 'deactivate'; }
    public function uninstall(PluginContext $context): void { self::$events[] = 'uninstall'; }
    public function update(PluginContext $context, string $fromVersion): void { self::$events[] = 'update:' . $fromVersion; }
    public function boot(PluginContext $context): void { self::$events[] = 'boot'; }
}
PHP);
        file_put_contents($this->directory . '/plugins/acme/forms/plugin.json', json_encode([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Flex\\Tests\\PluginLifecycle\\Plugin',
            'autoload' => ['Flex\\Tests\\PluginLifecycle\\' => 'src'],
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
            $table->text('last_error')->nullable();
            $table->dateTime('installed_at')->nullable();
            $table->dateTime('activated_at')->nullable();
            $table->timestamps();
        });

        $paths = new ProjectPaths($this->directory, new ConfigurationRepository(['paths' => ['plugins' => 'plugins']]));
        $registry = new PluginRegistry($paths);
        $api = new ExtensionApi();
        $this->manager = new PluginManager($registry, new PluginEntrypointLoader(), $api);
        $this->runtime = new PluginRuntime($registry, new PluginEntrypointLoader(), $api);
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
        self::assertSame(['install'], \Flex\Tests\PluginLifecycle\Plugin::$events);

        $plugin = $this->manager->activate('acme/forms');
        self::assertSame(PluginManager::STATUS_ACTIVE, $plugin->getAttribute('status'));
        self::assertNotNull($plugin->getAttribute('activated_at'));
        self::assertSame(['install', 'activate'], \Flex\Tests\PluginLifecycle\Plugin::$events);

        $this->runtime->bootActive();
        self::assertSame(['install', 'activate', 'boot'], \Flex\Tests\PluginLifecycle\Plugin::$events);

        $plugin = $this->manager->deactivate('acme/forms');
        self::assertSame(PluginManager::STATUS_INACTIVE, $plugin->getAttribute('status'));
        self::assertNull($plugin->getAttribute('activated_at'));
        self::assertSame(['install', 'activate', 'boot', 'deactivate'], \Flex\Tests\PluginLifecycle\Plugin::$events);

        file_put_contents($this->directory . '/plugins/acme/forms/plugin.json', json_encode([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.1.0',
            'entrypoint' => 'Flex\\Tests\\PluginLifecycle\\Plugin',
            'autoload' => ['Flex\\Tests\\PluginLifecycle\\' => 'src'],
        ], JSON_THROW_ON_ERROR));
        $plugin = $this->manager->install('acme/forms');
        self::assertSame('1.1.0', $plugin->getAttribute('version'));
        self::assertSame(['install', 'activate', 'boot', 'deactivate', 'update:1.0.0'], \Flex\Tests\PluginLifecycle\Plugin::$events);

        $this->manager->uninstall('acme/forms');
        self::assertSame(['install', 'activate', 'boot', 'deactivate', 'update:1.0.0', 'uninstall'], \Flex\Tests\PluginLifecycle\Plugin::$events);
        self::assertFileDoesNotExist($this->directory . '/plugins/acme/forms');
    }

}
