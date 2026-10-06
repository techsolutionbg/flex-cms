<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Configuration\{ConfigurationRepository, ProjectPaths};
use Flex\Contracts\Updates\{RemoteCatalogTransportInterface, RemoteCatalogTransportResponse, RemotePackageTransportInterface};
use Flex\Database\DatabaseManager;
use Flex\Themes\ThemeManager;
use Flex\Updates\Remote\{CurlRemoteCatalogTransport, CurlRemotePackageTransport, RemoteReleaseManifestSigner, RemoteThemeCatalog, RemoteThemeInstaller, RemoteThemePackageDownloader, ThemeCatalogClient, ThemePackageInstaller};
use Flex\Updates\Platform\PlatformVersionRegistry;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;

final class RemoteThemeUpdateTest extends TestCase
{
    private string $root;
    private ConfigurationRepository $config;
    private DatabaseManager $database;
    private ThemeManager $themes;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/flex-theme-update-test-' . bin2hex(random_bytes(6));
        mkdir($this->root . '/themes/flex-starter', 0770, true);
        mkdir($this->root . '/themes/other');
        foreach (['flex-starter', 'other'] as $id) {
            file_put_contents($this->root . '/themes/' . $id . '/theme.json', json_encode(['id' => $id, 'name' => $id, 'version' => '1.0.0'], JSON_THROW_ON_ERROR));
            file_put_contents($this->root . '/themes/' . $id . '/index.php', '<?php echo "old";');
        }
        file_put_contents($this->root . '/platform.json', '{"name":"flex-cms","version":"0.1.47"}');
        $this->config = new ConfigurationRepository([
            'paths' => ['themes' => 'themes'], 'app' => ['active_theme' => 'other'],
            'extensions' => ['updates' => ['server_url' => 'https://updates-flex-cms.kriskata.com', 'channel' => 'stable', 'require_signature' => true, 'max_download_mb' => 10, 'signing_public_key' => 'f8jqe8uwSmPX8JKDKAxlTzAMYSnVcAuUHHRsUMd+5dQ=']],
            'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]],
        ]);
        $this->database = new DatabaseManager($this->config);
        $this->database->schema()->create('settings', static function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->text('value');
            $table->string('type')->default('string');
            $table->string('group')->default('site');
            $table->boolean('autoload')->default(true);
            $table->timestamps();
        });
        $this->themes = new ThemeManager(new ProjectPaths($this->root, $this->config), $this->config);
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->root, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) { $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname()); }
        rmdir($this->root);
    }

    private function installer(RemoteCatalogTransportInterface $catalog, RemotePackageTransportInterface $packages): RemoteThemeInstaller
    {
        return new RemoteThemeInstaller(new ThemeCatalogClient($this->config, $catalog, $this->root), new RemoteThemePackageDownloader($this->config, $packages, $this->root), new ThemePackageInstaller(new ProjectPaths($this->root, $this->config), $this->themes, $this->root), $this->config, $this->themes, new PlatformVersionRegistry($this->root));
    }

    public function testSignedUpdateUsesPlatformCompatibilityAndPreservesActiveTheme(): void
    {
        $archive = $this->root . '/release.zip';
        $zip = new \ZipArchive();
        $zip->open($archive, \ZipArchive::CREATE);
        $zip->addFromString('flex-starter/theme.json', '{"id":"flex-starter","name":"Flex Starter","version":"1.0.1"}');
        $zip->addFromString('flex-starter/index.php', '<?php echo "updated";');
        $zip->close();
        $keys = sodium_crypto_sign_keypair();
        $entry = RemoteReleaseManifestSigner::sign(['schema' => 1, 'package' => 'flex-starter', 'type' => 'theme', 'version' => '1.0.1', 'channel' => 'stable', 'download_url' => 'https://updates-flex-cms.kriskata.com/release.zip', 'checksum' => hash_file('sha256', $archive), 'size' => filesize($archive), 'minimum_php' => '>=8.3', 'compatible_from' => '>=0.1.47 <1.0.0', 'published_at' => '2026-10-06T00:00:00+00:00', 'release_notes' => 'Test'], base64_encode(sodium_crypto_sign_secretkey($keys)), 'test');
        $values = $this->config->all();
        $values['extensions']['updates']['signing_public_key'] = base64_encode(sodium_crypto_sign_publickey($keys));
        $this->config = new ConfigurationRepository($values);
        $transport = $this->createStub(RemoteCatalogTransportInterface::class);
        $transport->method('get')->willReturnCallback(static fn(string $url): RemoteCatalogTransportResponse => new RemoteCatalogTransportResponse(200, json_encode(str_ends_with($url, 'index.json') ? ['schema' => 1, 'repository' => 'flex-cms', 'type' => 'theme', 'themes' => [['id' => 'flex-starter', 'manifest_url' => 'https://updates-flex-cms.kriskata.com/manifest.json']]] : ['schema' => 1, 'repository' => 'flex-cms', 'type' => 'theme', 'releases' => [$entry]], JSON_THROW_ON_ERROR), []));
        $packages = $this->createStub(RemotePackageTransportInterface::class);
        $packages->method('download')->willReturnCallback(static function (string $url, string $destination) use ($archive): int { copy($archive, $destination); return (int) filesize($archive); });
        $installer = $this->installer($transport, $packages);
        $catalog = RemoteThemeCatalog::fromArray(['schema' => 1, 'repository' => 'flex-cms', 'type' => 'theme', 'releases' => [$entry]]);
        self::assertSame('1.0.1', $installer->latestCompatibleRelease($catalog, 'flex-starter', '1.0.0')?->version);
        self::assertNull($installer->latestCompatibleRelease($catalog, 'flex-starter', '1.0.1'));
        file_put_contents($this->root . '/platform.json', '{"name":"flex-cms","version":"0.1.46"}');
        self::assertNull($installer->latestCompatibleRelease($catalog, 'flex-starter', '1.0.0'));
        file_put_contents($this->root . '/platform.json', '{"name":"flex-cms","version":"0.1.47"}');
        $values['extensions']['updates']['channel'] = 'beta';
        $this->config = new ConfigurationRepository($values);
        self::assertNull($this->installer($transport, $packages)->latestCompatibleRelease($catalog, 'flex-starter', '1.0.0'));
        $this->themes->activate('flex-starter');
        $result = $installer->update('flex-starter');
        self::assertSame('1.0.0', $result['from']);
        self::assertSame('1.0.1', $result['to']);
        self::assertTrue($result['active']);
        self::assertFileExists($result['backup_path'] . '/theme.json');
        self::assertSame('flex-starter', $this->themes->activeTheme());
        self::assertCount(1, array_filter($this->themes->all(), static fn(array $theme): bool => $theme['active']));
        self::assertSame('updated', $this->themes->render('index.php'));
    }

    public function testLivePublishedReleaseUpdatesAndActivatesInAnIsolatedInstallation(): void
    {
        if (getenv('FLEX_THEME_LIVE_TEST') !== '1') { self::markTestSkipped('Explicit network integration test.'); }
        file_put_contents($this->root . '/themes/flex-starter/theme.json', '{"id":"flex-starter","name":"Flex Starter","version":"1.0.1"}');
        $catalog = new ThemeCatalogClient($this->config, new CurlRemoteCatalogTransport(), $this->root);
        $installer = $this->installer(new CurlRemoteCatalogTransport(), new CurlRemotePackageTransport());
        $expected = $installer->latestCompatibleRelease($catalog->manifest('flex-starter'), 'flex-starter', '1.0.1');
        self::assertNotNull($expected);
        $result = $installer->update('flex-starter');
        self::assertSame('1.0.1', $result['from']);
        self::assertSame($expected->version, $result['to']);
        self::assertFalse($result['active']);
        self::assertSame('other', $this->themes->activeTheme());
        $this->themes->activate('flex-starter');
        self::assertSame('flex-starter', $this->themes->activeTheme());
        self::assertCount(1, array_filter($this->themes->all(), static fn(array $theme): bool => $theme['active']));
        self::assertStringContainsString('Flex CMS', $this->themes->render('index.php'));
        self::assertFileExists($this->root . '/themes/flex-starter/assets/screenshot.png');
        $starter = array_values(array_filter($this->themes->all(), static fn(array $theme): bool => $theme['id'] === 'flex-starter'))[0];
        self::assertSame('/theme-assets/flex-starter/screenshot.png', $starter['screenshot_url']);
        self::assertSame([], glob($this->root . '/storage/tmp/theme-download-*'));
    }

    public function testDetailsSupportCatalogOnlyThemesLocalThemesAndCatalogFailures(): void
    {
        $authentication = $this->createStub(\Flex\Contracts\Auth\AuthenticationInterface::class);
        $authentication->method('user')->willReturn(new \Flex\Auth\AuthenticatedUser(1, 'Admin', 'admin@example.test', 'super_admin', 'active'));
        $transport = $this->createStub(RemoteCatalogTransportInterface::class);
        $transport->method('get')->willReturnCallback(static function (string $url): RemoteCatalogTransportResponse {
            $id = str_contains($url, 'catalog-only') ? 'catalog-only' : 'flex-starter';
            $data = str_ends_with($url, 'index.json')
                ? ['schema' => 1, 'repository' => 'flex-cms', 'type' => 'theme', 'themes' => array_map(static fn(string $id): array => ['id' => $id, 'name' => $id, 'manifest_url' => 'https://updates-flex-cms.kriskata.com/' . $id . '.json', 'license' => 'MIT', 'supports' => ['menus' => true], 'menu_locations' => ['primary' => 'Main']], ['flex-starter', 'catalog-only'])]
                : ['schema' => 1, 'repository' => 'flex-cms', 'type' => 'theme', 'releases' => [['schema' => 1, 'package' => $id, 'type' => 'theme', 'version' => '1.0.1', 'channel' => 'stable', 'download_url' => 'https://updates-flex-cms.kriskata.com/release.zip', 'checksum' => str_repeat('a', 64), 'size' => 100, 'minimum_php' => '>=8.3', 'compatible_from' => '>=0.1.47 <1.0.0', 'published_at' => '2026-10-06T00:00:00+00:00', 'release_notes' => 'Release']]];
            return new RemoteCatalogTransportResponse(200, json_encode($data, JSON_THROW_ON_ERROR), []);
        });
        $packages = $this->createMock(RemotePackageTransportInterface::class);
        $packages->expects(self::never())->method('download');
        $controller = new \Flex\Http\Controller\Admin\AdminThemeDetailController($authentication, $this->themes, new ThemeCatalogClient($this->config, $transport, $this->root), $this->installer($transport, $packages), new PlatformVersionRegistry($this->root), $this->config, new \Flex\Http\ResponseFactory(new \Nyholm\Psr7\Factory\Psr17Factory()));
        $request = new \Nyholm\Psr7\ServerRequest('GET', 'http://localhost/api/admin/themes/catalog-only');
        $response = $controller($request, ['id' => 'catalog-only']);
        self::assertSame(200, $response->getStatusCode());
        self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
        $theme = json_decode((string) $response->getBody(), true)['theme'];
        self::assertFalse($theme['installed']);
        self::assertSame('MIT', $theme['license']);
        self::assertSame(['primary' => 'Main'], $theme['menu_locations']);
        self::assertTrue($theme['releases'][0]['compatible']);
        $local = json_decode((string) $controller($request, ['id' => 'flex-starter'])->getBody(), true)['theme'];
        self::assertTrue($local['installed']);
        self::assertFalse($local['active']);
        self::assertTrue($local['update_available']);
        $this->themes->activate('flex-starter');
        self::assertTrue(json_decode((string) $controller($request, ['id' => 'flex-starter'])->getBody(), true)['theme']['active']);
        self::assertSame(404, $controller($request, ['id' => '../private'])->getStatusCode());
        self::assertSame(404, $controller($request, ['id' => 'missing'])->getStatusCode());
        $offline = $this->createStub(RemoteCatalogTransportInterface::class);
        $offline->method('get')->willThrowException(new \Flex\Updates\Exception\RemoteCatalogException('Offline'));
        $offlineController = new \Flex\Http\Controller\Admin\AdminThemeDetailController($authentication, $this->themes, new ThemeCatalogClient($this->config, $offline, $this->root . '/offline'), $this->installer($transport, $packages), new PlatformVersionRegistry($this->root), $this->config, new \Flex\Http\ResponseFactory(new \Nyholm\Psr7\Factory\Psr17Factory()));
        self::assertSame(200, $offlineController($request, ['id' => 'flex-starter'])->getStatusCode());
        self::assertNotNull(json_decode((string) $offlineController($request, ['id' => 'flex-starter'])->getBody(), true)['theme']['catalog_error']);
        self::assertSame(502, $offlineController($request, ['id' => 'catalog-only'])->getStatusCode());
        $guest = $this->createStub(\Flex\Contracts\Auth\AuthenticationInterface::class);
        $guest->method('user')->willReturn(null);
        $guestController = new \Flex\Http\Controller\Admin\AdminThemeDetailController($guest, $this->themes, new ThemeCatalogClient($this->config, $transport, $this->root), $this->installer($transport, $packages), new PlatformVersionRegistry($this->root), $this->config, new \Flex\Http\ResponseFactory(new \Nyholm\Psr7\Factory\Psr17Factory()));
        self::assertSame(403, $guestController($request, ['id' => 'flex-starter'])->getStatusCode());
    }
}
