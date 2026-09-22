<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Auth\Middleware\RequireSuperAdminMiddleware;
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\Users\{CreateUserController, DeleteUserController, ListUsersController, UpdateUserController};
use Flex\Session\CsrfMiddleware;
use Psr\Container\ContainerInterface;

final class UserRouteServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [];
    } public function boot(ContainerInterface $container): void
    {
        $r = $container->get(RouteRegistryInterface::class);
        $admin = [CsrfMiddleware::class,RequireSuperAdminMiddleware::class];
        $r->add('GET', '/api/users', ListUsersController::class, 'api.users.index', $admin);
        $r->add('POST', '/api/users', CreateUserController::class, 'api.users.create', $admin);
        $r->add(['PATCH','PUT'], '/api/users/{id:number}', UpdateUserController::class, 'api.users.update', $admin);
        $r->add('DELETE', '/api/users/{id:number}', DeleteUserController::class, 'api.users.delete', $admin);
    }
}
