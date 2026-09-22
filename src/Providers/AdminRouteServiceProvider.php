<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Auth\Middleware\{RequireAuthenticationMiddleware, RequireSuperAdminMiddleware};
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\Admin\{AdminDashboardController, AdminPagesController, AdminProfileController, AdminSidebarWidthController, AdminUpdatesController, AdminUpdatesInspectController, AdminUpdatesInstallController, AdminUpdatesRollbackController};
use Flex\Http\Controller\Pages\{CreatePageController, ListPagesController, UpdatePageController};
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
        $r->add('GET', '/admin/profile', AdminProfileController::class, 'admin.profile', $auth);
        $r->add('GET', '/admin/pages', AdminPagesController::class, 'admin.pages', $auth);
        $r->add('POST', '/admin/sidebar-width', AdminSidebarWidthController::class, 'admin.sidebar.width', $write);
        $r->add('GET', '/admin/updates', AdminUpdatesController::class, 'admin.updates', $auth);
        $r->add('POST', '/admin/updates/inspect', AdminUpdatesInspectController::class, 'admin.updates.inspect', $write);
        $r->add('POST', '/admin/updates/install', AdminUpdatesInstallController::class, 'admin.updates.install', $write);
        $r->add('POST', '/admin/updates/rollback', AdminUpdatesRollbackController::class, 'admin.updates.rollback', $write);
        $r->add('GET', '/api/pages', ListPagesController::class, 'api.pages.index', $auth);
        $r->add('POST', '/api/pages', CreatePageController::class, 'api.pages.create', $write);
        $r->add(['PATCH', 'PUT'], '/api/pages/{id:number}', UpdatePageController::class, 'api.pages.update', $write);
    }
}
