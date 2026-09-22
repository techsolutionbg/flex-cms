<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Auth\Middleware\RequireAuthenticationMiddleware;
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\Auth\{CsrfTokenController, CurrentUserController, LoginController, LoginFormController, LogoutController};
use Flex\Session\CsrfMiddleware;
use Psr\Container\ContainerInterface;

final class AuthRouteServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [];
    } public function boot(ContainerInterface $container): void
    {
        $r = $container->get(RouteRegistryInterface::class);
        $r->get('/login', LoginFormController::class, 'auth.login.form');
        $r->add('POST', '/login', LoginController::class, 'auth.login', [CsrfMiddleware::class]);
        $r->get('/api/auth/csrf', CsrfTokenController::class, 'api.auth.csrf');
        $r->add('POST', '/api/auth/login', LoginController::class, 'api.auth.login', [CsrfMiddleware::class]);
        $r->add('POST', '/logout', LogoutController::class, 'auth.logout', [CsrfMiddleware::class,RequireAuthenticationMiddleware::class]);
        $r->add('POST', '/api/auth/logout', LogoutController::class, 'api.auth.logout', [CsrfMiddleware::class,RequireAuthenticationMiddleware::class]);
        $r->add('GET', '/api/auth/me', CurrentUserController::class, 'api.auth.me', [RequireAuthenticationMiddleware::class]);
    }
}
