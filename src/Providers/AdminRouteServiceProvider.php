<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Auth\Middleware\{RequireAuthenticationMiddleware, RequireSuperAdminMiddleware};
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\Admin\{AdminDashboardSummaryController, AdminPagesDataController, AdminPluginActionController, AdminPluginCatalogDataController, AdminPluginUploadController, AdminPluginsDataController, AdminThemeActionController, AdminThemeCatalogDataController, AdminThemePreviewController, AdminThemesDataController, AdminUpdatesActionController, AdminUpdatesDataController};
use Flex\Http\Controller\Pages\{CreatePageController, DeletePageController, ForceDeletePageController, ListPagesController, RestorePageController, UpdatePageController, UpdatePageSettingsController, UpdatePageStatusController};
use Flex\Session\CsrfMiddleware;
use Flex\Http\Controller\Admin\AdminThemeCapabilitiesController;
use Flex\Http\Controller\Admin\AdminMenusDataController;
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
        $media = \Flex\Http\Controller\Admin\AdminMediaController::class;
        $mediaAuth = [RequireAuthenticationMiddleware::class];
        $mediaWrite = [CsrfMiddleware::class, ...$mediaAuth];
        $r->add('GET', '/api/admin/media', $media, 'api.admin.media', $mediaAuth);
        $r->add('GET', '/api/admin/media/{id:number}', $media, 'api.admin.media.show', $mediaAuth);
        $r->add('POST', '/api/admin/media', $media, 'api.admin.media.upload', $mediaWrite);
        $r->add('PUT', '/api/admin/media/{id:number}', $media, 'api.admin.media.update', $mediaWrite);
        $r->add('DELETE', '/api/admin/media/{id:number}', $media, 'api.admin.media.trash', $mediaWrite);
        $r->add('POST', '/api/admin/media/{id:number}/restore', $media, 'api.admin.media.restore', $mediaWrite);
        $r->add('DELETE', '/api/admin/media/{id:number}/force', $media, 'api.admin.media.delete', $mediaWrite);
        $r->add('GET', '/api/admin/dashboard', AdminDashboardSummaryController::class, 'api.admin.dashboard', $auth);
        $r->add('GET', '/api/admin/pages', AdminPagesDataController::class, 'api.admin.pages', $auth);
        $r->add('GET', '/api/admin/plugins', AdminPluginsDataController::class, 'api.admin.plugins', $auth);
        $r->add('GET', '/api/admin/plugins/source', \Flex\Http\Controller\Admin\AdminPluginSourceController::class, 'api.admin.plugins.source', $auth);
        $r->add('GET', '/api/admin/plugins/catalog', AdminPluginCatalogDataController::class, 'api.admin.plugins.catalog', $auth);
        $r->add('GET', '/api/admin/themes', AdminThemesDataController::class, 'api.admin.themes', $auth);
        $r->add('GET', '/api/admin/theme-capabilities', AdminThemeCapabilitiesController::class, 'api.admin.theme-capabilities', $auth);
        $r->add('GET', '/api/admin/menus', AdminMenusDataController::class, 'api.admin.menus', $auth);
        $r->add('GET', '/api/admin/menus/{id}', AdminMenusDataController::class, 'api.admin.menus.show', $auth);
        $r->add('POST', '/api/admin/menus', AdminMenusDataController::class, 'api.admin.menus.create', $write);
        $r->add('PUT', '/api/admin/menus/{id}', AdminMenusDataController::class, 'api.admin.menus.update', $write);
        $r->add('DELETE', '/api/admin/menus/{id}', AdminMenusDataController::class, 'api.admin.menus.delete', $write);
        $r->add('POST', '/api/admin/menus/{id}/restore', AdminMenusDataController::class, 'api.admin.menus.restore', $write);
        $r->add('DELETE', '/api/admin/menus/{id}/force', AdminMenusDataController::class, 'api.admin.menus.force-delete', $write);
        $r->add('POST', '/api/admin/menu-assignments', AdminMenusDataController::class, 'api.admin.menus.assignments', $write);
        $r->add('GET', '/api/admin/themes/catalog', AdminThemeCatalogDataController::class, 'api.admin.themes.catalog', $auth);
        $r->add('GET', '/api/admin/themes/{id}', \Flex\Http\Controller\Admin\AdminThemeDetailController::class, 'api.admin.themes.detail', $auth);
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
