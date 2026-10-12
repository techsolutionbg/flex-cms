<?php

declare(strict_types=1);

namespace Flex\Tests\Http;

use Flex\Admin\AdminPluginsSnapshotCache;
use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extensions\PluginRegistry;
use Flex\Http\Controller\Admin\AdminPluginsDataController;
use Flex\Updates\Remote\RemoteCatalogClient;
use Illuminate\Database\Eloquent\Collection;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;

final class AdminPluginsDataControllerTest extends TestCase
{
    public function testForbiddenForNonSuperAdmin(): void
    {
        $auth = $this->createMock(AuthenticationInterface::class);
        $auth->method('user')->willReturn(null);
        $responses = $this->createMock(ResponseFactoryInterface::class);
        $responses->expects(self::once())
            ->method('json')
            ->with(self::callback(static fn(array $body): bool => ($body['error']['status'] ?? null) === 403), 403)
            ->willReturn(new \Nyholm\Psr7\Response());

        $controller = new AdminPluginsDataController(
            $auth,
            $this->createStub(PluginRegistry::class),
            $this->createStub(RemoteCatalogClient::class),
            $this->createStub(AdminPluginsSnapshotCache::class),
            $responses,
        );
        $controller($this->createStub(ServerRequestInterface::class));
    }

    public function testUsesSuperAdminSession(): void
    {
        $user = $this->createMock(AuthenticatedUser::class);
        $user->method('isSuperAdmin')->willReturn(true);

        $registry = $this->createMock(PluginRegistry::class);
        $registry->method('discover')->willReturn([]);
        $registry->method('all')->willReturn(new Collection([]));

        $remote = $this->createMock(RemoteCatalogClient::class);
        $remote->expects(self::never())->method('pluginManifest');

        $auth = $this->createMock(AuthenticationInterface::class);
        $auth->method('user')->willReturn($user);

        $responses = $this->createMock(ResponseFactoryInterface::class);
        $responses->expects(self::once())
            ->method('json')
            ->with(['plugins' => []], 200, self::anything())
            ->willReturn(new \Nyholm\Psr7\Response());

        $snapshot = $this->createMock(AdminPluginsSnapshotCache::class);
        $snapshot->method('wantsHardRefresh')->willReturn(false);
        $snapshot->method('read')->willReturn(null);
        $snapshot->expects(self::once())->method('write');

        $controller = new AdminPluginsDataController($auth, $registry, $remote, $snapshot, $responses);
        $controller($this->createStub(ServerRequestInterface::class));
    }
}
