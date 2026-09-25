<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Auth\Middleware\{RequireAuthenticationMiddleware, RequireSuperAdminMiddleware};
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\Admin\{AdminDashboardController, AdminPagesController, AdminPagesFormController, AdminPluginActionController, AdminPluginsController, AdminProfileController, AdminSectionStateController, AdminSidebarWidthController, AdminUpdatesController, AdminUpdatesInspectController, AdminUpdatesInstallController, AdminUpdatesRollbackController};
use Flex\Http\Controller\Pages\{CreatePageController, DeletePageController, ForceDeletePageController, ListPagesController, RestorePageController, UpdatePageController, UpdatePageSettingsController};
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
        $r->add('GET', '/admin/plugins', AdminPluginsController::class, 'admin.plugins', $auth);
        $r->add('GET', '/admin/plugins/{id:.+}', AdminPluginsController::class, 'admin.plugins.detail', $auth);
        $r->add('GET', '/admin/pages/create', AdminPagesFormController::class, 'admin.pages.create', $auth);
        $r->add('GET', '/admin/pages/{id:number}/edit', AdminPagesFormController::class, 'admin.pages.edit', $auth);
        $r->add('GET', '/admin/pages/{id:number}/settings', AdminPagesFormController::class, 'admin.pages.settings', $auth);
        $r->add('GET', '/admin/pages', AdminPagesController::class, 'admin.pages', $auth);
        $r->add('POST', '/admin/sidebar-width', AdminSidebarWidthController::class, 'admin.sidebar.width', $write);
        $r->add('POST', '/admin/section-state', AdminSectionStateController::class, 'admin.section.state', $write);
        $r->add('GET', '/admin/updates', AdminUpdatesController::class, 'admin.updates', $auth);
        $r->add('POST', '/admin/updates/inspect', AdminUpdatesInspectController::class, 'admin.updates.inspect', $write);
        $r->add('POST', '/admin/updates/install', AdminUpdatesInstallController::class, 'admin.updates.install', $write);
        $r->add('POST', '/admin/updates/rollback', AdminUpdatesRollbackController::class, 'admin.updates.rollback', $write);
        $r->add('POST', '/api/plugins/action', AdminPluginActionController::class, 'api.plugins.action', $write);
        $r->add('GET', '/api/pages', ListPagesController::class, 'api.pages.index', $auth);
        $r->add('POST', '/api/pages', CreatePageController::class, 'api.pages.create', $write);
        $r->add(['PATCH', 'PUT'], '/api/pages/{id:number}', UpdatePageController::class, 'api.pages.update', $write);
        $r->add(['PATCH', 'PUT'], '/api/pages/{id:number}/settings', UpdatePageSettingsController::class, 'api.pages.settings.update', $write);
        $r->add('DELETE', '/api/pages/{id:number}', DeletePageController::class, 'api.pages.delete', $write);
        $r->add('DELETE', '/api/pages/{id:number}/force', ForceDeletePageController::class, 'api.pages.force-delete', $write);
        $r->add('POST', '/api/pages/{id:number}/restore', RestorePageController::class, 'api.pages.restore', $write);
    }
}
