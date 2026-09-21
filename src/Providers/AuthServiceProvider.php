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

        $admin = [CsrfMiddleware::class, RequireSuperAdminMiddleware::class];
        $routes->add('GET', '/api/users', ListUsersController::class, 'api.users.index', $admin);
        $routes->add('POST', '/api/users', CreateUserController::class, 'api.users.create', $admin);
        $routes->add(['PATCH', 'PUT'], '/api/users/{id:number}', UpdateUserController::class, 'api.users.update', $admin);
        $routes->add('DELETE', '/api/users/{id:number}', DeleteUserController::class, 'api.users.delete', $admin);
    }
}
