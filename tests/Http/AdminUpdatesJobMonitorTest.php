<?php

declare(strict_types=1);

namespace Flex\Tests\Http;

use Flex\Auth\AuthenticatedUser;
use Flex\Bootstrap;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\Controller\Admin\AdminUpdatesDataController;
use Flex\Updates\Jobs\UpdateJobStore;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Platform\PlatformUpdateState;
use Flex\Updates\Platform\PlatformUpdateStateStore;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Updates\Remote\RemoteCatalogClient;
use Flex\Updates\Remote\RemotePlatformUpdater;
use Nyholm\Psr7\ServerRequest;
use PHPUnit\Framework\TestCase;

final class AdminUpdatesJobMonitorTest extends TestCase
{
    public function testItReadsProgressWithoutFetchingTheCatalogOrExposingRecoveryPaths(): void
    {
        $directory = sys_get_temp_dir() . '/flex-monitor-' . bin2hex(random_bytes(6));
        $jobs = new UpdateJobStore($directory);
        $queued = $jobs->queuePlatformUpdate(false, '0.1.46');
        $job = $jobs->claimNext();
        self::assertNotNull($job);
        $jobs->progress($job, 'verifying');
        $states = new PlatformUpdateStateStore($directory);
        $states->write(new PlatformUpdateState($job->id, 'staged', '0.1.45', '0.1.46', str_repeat('a', 64), '/private/backup', '/private/work', null, [], gmdate(DATE_ATOM), 100, 500));

        $container = Bootstrap::boot(dirname(__DIR__, 2))->container();
        $authentication = $this->createStub(AuthenticationInterface::class);
        $authenticatedUser = new AuthenticatedUser(1, 'Test', 'test@example.test', 'super_admin', 'active');
        $authentication->method('user')->willReturnCallback(static function () use (&$authenticatedUser): ?AuthenticatedUser { return $authenticatedUser; });
        $controller = new AdminUpdatesDataController(
            $authentication,
            $container->get(ConfigRepositoryInterface::class),
            // No platform.json exists here: status polling must not read it.
            new PlatformVersionRegistry($directory),
            $container->get(RemoteCatalogClient::class),
            new PlatformHistory($directory),
            $container->get(RemotePlatformUpdater::class),
            $jobs,
            $container->get(ResponseFactoryInterface::class),
            $states,
        );
        try {
            $request = (new ServerRequest('GET', 'http://localhost/api/admin/updates'))->withQueryParams(['job_id' => $queued->id]);
            $response = $controller($request);
            self::assertSame(200, $response->getStatusCode());
            self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
            $body = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
            self::assertSame('staged', $body['job']['phase']);
            self::assertSame(100, $body['job']['files_processed']);
            self::assertSame(500, $body['job']['files_total']);
            self::assertArrayNotHasKey('backup_path', $body['job']);
            self::assertSame(404, $controller($request->withQueryParams(['job_id' => 'missing']))->getStatusCode());
            $jobs->complete($job, ['version' => '0.1.46']);
            $completed = json_decode((string) $controller($request)->getBody(), true, 512, JSON_THROW_ON_ERROR);
            self::assertSame('completed', $completed['job']['phase']);
            self::assertSame(0, $completed['job']['files_total']);
            $authenticatedUser = null;
            self::assertSame(403, $controller($request)->getStatusCode());
        } finally {
            foreach (glob($directory . '/storage/updates/*') ?: [] as $file) unlink($file);
            rmdir($directory . '/storage/updates');
            rmdir($directory . '/storage');
            rmdir($directory);
        }
    }
}
