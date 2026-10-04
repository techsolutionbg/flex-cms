<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Auth\Middleware\{RequireAuthenticationMiddleware, RequireSuperAdminMiddleware};
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\Admin\{AdminDashboardSummaryController, AdminPagesDataController, AdminPluginActionController, AdminPluginCatalogDataController, AdminPluginUploadController, AdminPluginsDataController, AdminThemeActionController, AdminThemeCatalogDataController, AdminThemePreviewController, AdminThemesDataController, AdminUpdatesActionController, AdminUpdatesDataController};
use Flex\Http\Controller\Pages\{CreatePageController, DeletePageController, ForceDeletePageController, ListPagesController, RestorePageController, UpdatePageController, UpdatePageSettingsController, UpdatePageStatusController};
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
        $r->add('GET', '/api/admin/dashboard', AdminDashboardSummaryController::class, 'api.admin.dashboard', $auth);
        $r->add('GET', '/api/admin/pages', AdminPagesDataController::class, 'api.admin.pages', $auth);
        $r->add('GET', '/api/admin/plugins', AdminPluginsDataController::class, 'api.admin.plugins', $auth);
        $r->add('GET', '/api/admin/plugins/catalog', AdminPluginCatalogDataController::class, 'api.admin.plugins.catalog', $auth);
        $r->add('GET', '/api/admin/themes', AdminThemesDataController::class, 'api.admin.themes', $auth);
        $r->add('GET', '/api/admin/themes/catalog', AdminThemeCatalogDataController::class, 'api.admin.themes.catalog', $auth);
        $r->add('GET', '/api/admin/updates', AdminUpdatesDataController::class, 'api.admin.updates', $auth);
        $r->add('GET', '/admin/themes/{id}/preview', AdminThemePreviewController::class, 'admin.themes.preview', $auth);
        $r->add('POST', '/api/themes/action', AdminThemeActionController::class, 'api.themes.action', $write);
        $r->add('POST', '/api/plugins/action', AdminPluginActionController::class, 'api.plugins.action', $write);
        $r->add('POST', '/api/admin/updates/action', AdminUpdatesActionController::class, 'api.admin.updates.action', $write);
        $r->add('POST', '/api/plugins/upload', AdminPluginUploadController::class, 'api.plugins.upload', $write);
        $r->add('GET', '/api/pages', ListPagesController::class, 'api.pages.index', $auth);
        $r->add('POST', '/api/pages', CreatePageController::class, 'api.pages.create', $write);
        $r->add(['PATCH', 'PUT'], '/api/pages/{id:number}', UpdatePageController::class, 'api.pages.update', $write);
        $r->add('PATCH', '/api/pages/{id:number}/status', UpdatePageStatusController::class, 'api.pages.status.update', $write);
        $r->add(['PATCH', 'PUT'], '/api/pages/{id:number}/settings', UpdatePageSettingsController::class, 'api.pages.settings.update', $write);
        $r->add('DELETE', '/api/pages/{id:number}', DeletePageController::class, 'api.pages.delete', $write);
        $r->add('DELETE', '/api/pages/{id:number}/force', ForceDeletePageController::class, 'api.pages.force-delete', $write);
        $r->add('POST', '/api/pages/{id:number}/restore', RestorePageController::class, 'api.pages.restore', $write);
    }
}
