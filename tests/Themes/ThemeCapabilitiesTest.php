<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Auth\AuthenticatedUser;
use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Database\DatabaseManager;
use Flex\Http\Controller\Admin\AdminThemeCapabilitiesController;
use Flex\Http\Controller\Admin\AdminMenusDataController;
use Flex\Http\ResponseFactory;
use Flex\Settings\Setting;
use Flex\Themes\ThemeManager;
use Illuminate\Database\Schema\Blueprint;
use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7\ServerRequest;
use PHPUnit\Framework\TestCase;

final class ThemeCapabilitiesTest extends TestCase
{
    public function testOnlyTheActiveThemeGrantsMenuAccessAndChangingThemesRevokesIt(): void
    {
        $directory = sys_get_temp_dir() . '/flex-theme-capabilities-' . bin2hex(random_bytes(5));
        $config = new ConfigurationRepository([
            'paths' => ['themes' => 'themes'], 'app' => ['active_theme' => 'supported'],
            'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]],
        ]);
        $database = new DatabaseManager($config);
        $database->schema()->create('settings', static function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->text('value');
            $table->string('type')->default('string');
            $table->string('group')->default('site');
            $table->boolean('autoload')->default(true);
            $table->timestamps();
        });
        foreach (['supported', 'plain'] as $id) {
            mkdir($directory . '/themes/' . $id, 0770, true);
            file_put_contents($directory . '/themes/' . $id . '/index.php', '<?php echo "theme";');
            file_put_contents($directory . '/themes/' . $id . '/theme.json', json_encode(['id' => $id, 'name' => $id, 'version' => '1.0.0', ...($id === 'supported' ? ['supports' => ['menus' => true], 'menu_locations' => ['primary' => 'Главно меню']] : [])], JSON_THROW_ON_ERROR));
        }
        try {
            $themes = new ThemeManager(new ProjectPaths($directory, $config), $config);
            \Flex\Tests\Support\MenuSchema::create($database);
            $authentication = $this->createStub(AuthenticationInterface::class);
            $user = new AuthenticatedUser(1, 'Admin', 'admin@example.test', 'super_admin', 'active');
            $authentication->method('user')->willReturnCallback(static function () use (&$user) {
                return $user;
            });
            $controller = new AdminMenusDataController($authentication, $themes, new ResponseFactory(new Psr17Factory()), new \Flex\Menus\MenuService($database, $themes), new \Flex\Pages\PageRepository(), new \Flex\Http\RequestInput());
            $capabilitiesController = new AdminThemeCapabilitiesController($authentication, $themes, new ResponseFactory(new Psr17Factory()));
            $menus = new ServerRequest('GET', 'http://localhost/api/admin/menus');
            $response = $controller($menus);
            self::assertSame(200, $response->getStatusCode());
            self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
            self::assertSame(['primary' => 'Главно меню'], json_decode((string) $response->getBody(), true)['menu_locations']);
            $themes->activate('plain');
            self::assertFalse($themes->capabilities()['supports']['menus']);
            self::assertSame(403, $controller($menus)->getStatusCode());
            self::assertSame(200, $capabilitiesController(new ServerRequest('GET', 'http://localhost/api/admin/theme-capabilities'))->getStatusCode());
            $themes->activate('supported');
            self::assertSame(200, $controller($menus)->getStatusCode());
            $themes->deactivate('supported');
            self::assertNull($themes->capabilities()['theme']);
            self::assertSame(403, $controller($menus)->getStatusCode());
            $user = null;
            self::assertSame(403, $controller($menus)->getStatusCode());
        } finally {
            $database->disconnect();
            foreach (['supported', 'plain'] as $id) {
                unlink($directory . '/themes/' . $id . '/theme.json');
                unlink($directory . '/themes/' . $id . '/index.php');
                rmdir($directory . '/themes/' . $id);
            }
            rmdir($directory . '/themes');
            rmdir($directory);
        }
    }
}
