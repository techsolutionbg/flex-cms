<?php

declare(strict_types=1);

namespace Flex\Tests\Auth;

use Flex\Auth\AuthenticatedUser;
use Flex\Auth\Middleware\RequireSuperAdminMiddleware;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Http\ResponseFactory;
use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7\ServerRequest;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class RequireSuperAdminMiddlewareTest extends TestCase
{
    public function testItRejectsUnauthenticatedRequests(): void
    {
        $response = $this->middleware(null)->process($this->request()->withHeader('Accept', 'application/json'), $this->next());

        self::assertSame(401, $response->getStatusCode());
        self::assertStringContainsString('authentication_required', (string) $response->getBody());
    }

    public function testItRedirectsUnauthenticatedHtmlRequests(): void
    {
        $response = $this->middleware(null)->process($this->request(), $this->next());

        self::assertSame(302, $response->getStatusCode());
        self::assertSame('/login', $response->getHeaderLine('Location'));
    }

    public function testItRejectsAuthenticatedNonSuperAdmins(): void
    {
        $response = $this->middleware(new AuthenticatedUser(1, 'Editor', 'editor@example.test', 'editor', 'active'))
            ->process($this->request(), $this->next());

        self::assertSame(403, $response->getStatusCode());
    }

    public function testItPassesSuperAdminsToThePanel(): void
    {
        $response = $this->middleware(new AuthenticatedUser(1, 'Administrator', 'admin@example.test', 'super_admin', 'active'))
            ->process($this->request(), $this->next());

        self::assertSame(204, $response->getStatusCode());
    }

    private function middleware(?AuthenticatedUser $user): RequireSuperAdminMiddleware
    {
        $authentication = new class ($user) implements AuthenticationInterface {
            public function __construct(private readonly ?AuthenticatedUser $user) {}
            public function user(): ?AuthenticatedUser
            {
                return $this->user;
            }
            public function check(): bool
            {
                return $this->user !== null;
            }
            public function attempt(string $email, string $password, string $ipAddress): bool
            {
                return false;
            }
            public function logout(): void {}
        };

        return new RequireSuperAdminMiddleware($authentication, new ResponseFactory(new Psr17Factory()));
    }

    private function request(): ServerRequestInterface
    {
        return new ServerRequest('GET', 'http://localhost/admin');
    }

    private function next(): RequestHandlerInterface
    {
        return new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return (new Psr17Factory())->createResponse(204);
            }
        };
    }
}
