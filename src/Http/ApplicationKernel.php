<?php

declare(strict_types=1);

namespace Flex\Http;

use Flex\Contracts\Http\KernelInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class ApplicationKernel implements KernelInterface
{
    /** @param list<MiddlewareInterface> $middleware */
    public function __construct(
        private RequestHandlerInterface $router,
        private array $middleware,
    ) {}

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $handler = $this->router;
        foreach (array_reverse($this->middleware) as $middleware) {
            $handler = new MiddlewareRequestHandler($middleware, $handler);
        }

        return $handler->handle($request);
    }
}
