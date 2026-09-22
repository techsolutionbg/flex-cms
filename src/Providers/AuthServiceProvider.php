<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Auth\AuthenticationManager;
use Flex\Auth\Middleware\RequireAuthenticationMiddleware;
use Flex\Auth\Middleware\RequireSuperAdminMiddleware;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Contracts\Session\SessionInterface;
use Flex\Http\Controller\Auth\CsrfTokenController;
use Flex\Http\Controller\Auth\CurrentUserController;
use Flex\Http\Controller\Auth\LoginController;
use Flex\Http\Controller\Auth\LoginFormController;
use Flex\Http\Controller\Auth\LogoutController;
use Flex\Http\Controller\Admin\AdminDashboardController;
use Flex\Http\Controller\Admin\AdminSidebarWidthController;
use Flex\Http\Controller\Admin\AdminUpdatesController;
use Flex\Http\Controller\Admin\AdminUpdatesInspectController;
use Flex\Http\Controller\Admin\AdminUpdatesInstallController;
use Flex\Http\Controller\Admin\AdminUpdatesRollbackController;
use Flex\Http\Controller\Users\CreateUserController;
use Flex\Http\Controller\Users\DeleteUserController;
use Flex\Http\Controller\Users\ListUsersController;
use Flex\Http\Controller\Users\UpdateUserController;
use Flex\Session\NativeSession;
use Flex\Session\CsrfMiddleware;
use Psr\Container\ContainerInterface;

use function DI\autowire;

final class AuthServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            SessionInterface::class => autowire(NativeSession::class),
            AuthenticationInterface::class => autowire(AuthenticationManager::class),
        ];
    }

    public function boot(ContainerInterface $container): void
    {
        $routes = $container->get(RouteRegistryInterface::class);
        $routes->get('/login', LoginFormController::class, 'auth.login.form');
        $routes->add('POST', '/login', LoginController::class, 'auth.login', [CsrfMiddleware::class]);
        $routes->get('/api/auth/csrf', CsrfTokenController::class, 'api.auth.csrf');
        $routes->add('POST', '/api/auth/login', LoginController::class, 'api.auth.login', [CsrfMiddleware::class]);
        $routes->add('POST', '/logout', LogoutController::class, 'auth.logout', [CsrfMiddleware::class, RequireAuthenticationMiddleware::class]);
        $routes->add('POST', '/api/auth/logout', LogoutController::class, 'api.auth.logout', [CsrfMiddleware::class, RequireAuthenticationMiddleware::class]);
        $routes->add('GET', '/api/auth/me', CurrentUserController::class, 'api.auth.me', [RequireAuthenticationMiddleware::class]);

        $routes->add('GET', '/admin', AdminDashboardController::class, 'admin.dashboard', [RequireAuthenticationMiddleware::class, RequireSuperAdminMiddleware::class]);
        $routes->add('POST', '/admin/sidebar-width', AdminSidebarWidthController::class, 'admin.sidebar.width', [CsrfMiddleware::class, RequireAuthenticationMiddleware::class, RequireSuperAdminMiddleware::class]);
        $routes->add('GET', '/admin/updates', AdminUpdatesController::class, 'admin.updates', [RequireAuthenticationMiddleware::class, RequireSuperAdminMiddleware::class]);
        $routes->add('POST', '/admin/updates/inspect', AdminUpdatesInspectController::class, 'admin.updates.inspect', [CsrfMiddleware::class, RequireAuthenticationMiddleware::class, RequireSuperAdminMiddleware::class]);
        $routes->add('POST', '/admin/updates/install', AdminUpdatesInstallController::class, 'admin.updates.install', [CsrfMiddleware::class, RequireAuthenticationMiddleware::class, RequireSuperAdminMiddleware::class]);
        $routes->add('POST', '/admin/updates/rollback', AdminUpdatesRollbackController::class, 'admin.updates.rollback', [CsrfMiddleware::class, RequireAuthenticationMiddleware::class, RequireSuperAdminMiddleware::class]);

        $admin = [CsrfMiddleware::class, RequireSuperAdminMiddleware::class];
        $routes->add('GET', '/api/users', ListUsersController::class, 'api.users.index', $admin);
        $routes->add('POST', '/api/users', CreateUserController::class, 'api.users.create', $admin);
        $routes->add(['PATCH', 'PUT'], '/api/users/{id:number}', UpdateUserController::class, 'api.users.update', $admin);
        $routes->add('DELETE', '/api/users/{id:number}', DeleteUserController::class, 'api.users.delete', $admin);
    }
}
