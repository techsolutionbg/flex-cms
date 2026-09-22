<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Auth\Middleware\{RequireAuthenticationMiddleware, RequireSuperAdminMiddleware};
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\Admin\{AdminDashboardController, AdminSidebarWidthController, AdminUpdatesController, AdminUpdatesInspectController, AdminUpdatesInstallController, AdminUpdatesRollbackController};
use Flex\Session\CsrfMiddleware;
use Psr\Container\ContainerInterface;

final class AdminRouteServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [];
    } public function boot(ContainerInterface $container): void
    {
        $r = $container->get(RouteRegistryInterface::class);
        $auth = [RequireAuthenticationMiddleware::class,RequireSuperAdminMiddleware::class];
        $write = [CsrfMiddleware::class,...$auth];
        $r->add('GET', '/admin', AdminDashboardController::class, 'admin.dashboard', $auth);
        $r->add('POST', '/admin/sidebar-width', AdminSidebarWidthController::class, 'admin.sidebar.width', $write);
        $r->add('GET', '/admin/updates', AdminUpdatesController::class, 'admin.updates', $auth);
        $r->add('POST', '/admin/updates/inspect', AdminUpdatesInspectController::class, 'admin.updates.inspect', $write);
        $r->add('POST', '/admin/updates/install', AdminUpdatesInstallController::class, 'admin.updates.install', $write);
        $r->add('POST', '/admin/updates/rollback', AdminUpdatesRollbackController::class, 'admin.updates.rollback', $write);
    }
}
