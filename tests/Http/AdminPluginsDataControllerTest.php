<?php

declare(strict_types=1);

namespace Flex\Tests\Http;

use Flex\Admin\AdminPluginsSnapshotCache;
use Flex\Auth\AuthenticatedUser;
use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportResponse;
use Flex\Database\DatabaseManager;
use Flex\Extensions\PluginRegistry;
use Flex\Http\Controller\Admin\AdminPluginsDataController;
use Flex\Updates\Exception\RemoteCatalogException;
use Flex\Updates\Remote\RemoteCatalogClient;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;

final class AdminPluginsDataControllerTest extends TestCase
{
    private string $directory;

    private DatabaseManager $database;

    private PluginRegistry $plugins;

    private AdminPluginsSnapshotCache $snapshot;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-admin-plugins-' . bin2hex(random_bytes(5));
        mkdir($this->directory . '/plugins', 0775, true);

        $configuration = new ConfigurationRepository([
            'database' => [
                'default' => 'sqlite',
                'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']],
            ],
            'paths' => ['plugins' => 'plugins'],
        ]);
        $this->database = new DatabaseManager($configuration);
        $this->database->schema()->create('plugins', static function (Blueprint $table): void {
            $table->string('id', 190)->primary();
        });

        $this->plugins = new PluginRegistry(new ProjectPaths($this->directory, $configuration));
        $this->snapshot = new AdminPluginsSnapshotCache($this->directory);
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
        $this->deleteDirectory($this->directory);
    }

    public function testForbiddenForNonSuperAdmin(): void
    {
        $auth = $this->createStub(AuthenticationInterface::class);
        $auth->method('user')->willReturn(new AuthenticatedUser(4, 'Admin', 'admin@example.test', 'admin', 'active'));
        $responses = $this->createMock(ResponseFactoryInterface::class);
        $responses->expects(self::once())
            ->method('json')
            ->with(self::callback(static fn(array $body): bool => ($body['error']['status'] ?? null) === 403), 403)
            ->willReturn(new \Nyholm\Psr7\Response());

        $controller = new AdminPluginsDataController(
            $auth,
            $this->plugins,
            $this->remoteCatalog(),
            $this->snapshot,
            $responses,
        );
        $controller($this->createStub(ServerRequestInterface::class));
    }

    public function testUsesSuperAdminSession(): void
    {
        $auth = $this->createStub(AuthenticationInterface::class);
        $auth->method('user')->willReturn(new AuthenticatedUser(1, 'Owner', 'owner@example.test', 'super_admin', 'active'));

        $remote = $this->remoteCatalog();

        $responses = $this->createMock(ResponseFactoryInterface::class);
        $responses->expects(self::once())
            ->method('json')
            ->with(['plugins' => []], 200, self::anything())
            ->willReturn(new \Nyholm\Psr7\Response());

        $controller = new AdminPluginsDataController($auth, $this->plugins, $remote, $this->snapshot, $responses);
        $controller($this->createStub(ServerRequestInterface::class));

        self::assertSame([], $this->snapshot->read());
    }

    public function testIncludesDiscoveredLocalPluginsNotYetInstalled(): void
    {
        $pluginDirectory = $this->directory . '/plugins/flex/theme-content';
        mkdir($pluginDirectory, 0775, true);
        file_put_contents($pluginDirectory . '/plugin.json', json_encode([
            'id' => 'flex/theme-content',
            'name' => 'Flex Theme Content',
            'version' => '1.0.0',
            'entrypoint' => 'Flex\\Plugin\\ThemeContent\\Plugin',
            'permissions' => ['admin.ui'],
        ], JSON_THROW_ON_ERROR));

        $auth = $this->createStub(AuthenticationInterface::class);
        $auth->method('user')->willReturn(new AuthenticatedUser(1, 'Owner', 'owner@example.test', 'super_admin', 'active'));

        $remote = $this->remoteCatalog();

        $responses = $this->createMock(ResponseFactoryInterface::class);
        $responses->expects(self::once())
            ->method('json')
            ->with(
                self::callback(static function (array $body): bool {
                    return ($body['plugins'][0]['id'] ?? '') === 'flex/theme-content'
                        && ($body['plugins'][0]['status'] ?? '') === 'discovered';
                }),
                200,
                self::anything(),
            )
            ->willReturn(new \Nyholm\Psr7\Response());

        $controller = new AdminPluginsDataController($auth, $this->plugins, $remote, $this->snapshot, $responses);
        $controller($this->createStub(ServerRequestInterface::class));

        self::assertSame('flex/theme-content', $this->snapshot->read()[0]['id'] ?? null);
    }

    private function deleteDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($path);
    }

    private function remoteCatalog(): RemoteCatalogClient
    {
        return new RemoteCatalogClient(
            new ConfigurationRepository(['extensions' => ['updates' => ['server_url' => 'https://updates.example.test']]]),
            new UnavailableCatalogTransport(),
            $this->directory,
        );
    }
}

final class UnavailableCatalogTransport implements RemoteCatalogTransportInterface
{
    /** @param list<string> $headers */
    public function get(string $url, array $headers = []): RemoteCatalogTransportResponse
    {
        throw new RemoteCatalogException('Remote catalog is unavailable in this test.');
    }
}
