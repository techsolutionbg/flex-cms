<?php

declare(strict_types=1);

namespace Flex\Http\Middleware;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class HostValidationMiddleware implements MiddlewareInterface
{
    public function __construct(
        private ConfigRepositoryInterface $configuration,
        private ResponseFactoryInterface $responses,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $trustedHosts = $this->configuration->array('app.trusted_hosts');
        $host = strtolower($request->getUri()->getHost());

        if ($trustedHosts !== [] && !$this->isTrusted($host, $trustedHosts)) {
            return $this->responses->text('Bad Request', 400);
        }

        return $handler->handle($request);
    }

    /** @param array<mixed> $trustedHosts */
    private function isTrusted(string $host, array $trustedHosts): bool
    {
        foreach ($trustedHosts as $trustedHost) {
            if (!is_string($trustedHost)) {
                continue;
            }
            $trustedHost = strtolower(trim($trustedHost));
            if ($trustedHost === $host) {
                return true;
            }
            if (str_starts_with($trustedHost, '*.') && str_ends_with($host, substr($trustedHost, 1))) {
                return true;
            }
        }

        return false;
    }
}
