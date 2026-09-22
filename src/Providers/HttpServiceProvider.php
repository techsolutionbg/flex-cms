<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\KernelInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\ApplicationKernelFactory;
use Flex\Http\ResponseFactory;
use Flex\Http\View\TwigViewRenderer;
use Flex\Http\View\ViteAssetManager;
use Flex\Http\Routing\RouteRegistry;
use Flex\Http\Routing\RouterFactory;
use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7Server\ServerRequestCreator;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseFactoryInterface as PsrResponseFactoryInterface;
use Psr\Http\Message\ServerRequestFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;
use Psr\Http\Message\UploadedFileFactoryInterface;
use Psr\Http\Message\UriFactoryInterface;

use function DI\autowire;
use function DI\create;
use function DI\factory;
use function DI\get;

final class HttpServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            Psr17Factory::class => create(),
            PsrResponseFactoryInterface::class => get(Psr17Factory::class),
            ServerRequestFactoryInterface::class => get(Psr17Factory::class),
            StreamFactoryInterface::class => get(Psr17Factory::class),
            UploadedFileFactoryInterface::class => get(Psr17Factory::class),
            UriFactoryInterface::class => get(Psr17Factory::class),
            ServerRequestCreator::class => autowire(),
            ResponseFactoryInterface::class => autowire(ResponseFactory::class),
            ViewRendererInterface::class => create(TwigViewRenderer::class)->constructor(get('base_path')),
            ViteAssetManager::class => create()->constructor(get('base_path')),
            RouteRegistry::class => create(),
            RouteRegistryInterface::class => get(RouteRegistry::class),
            RouterFactory::class => autowire(),
            ApplicationKernelFactory::class => autowire(),
            KernelInterface::class => factory([ApplicationKernelFactory::class, 'create']),
        ];
    }

    public function boot(ContainerInterface $container): void
    {
        // Infrastructure bindings only. Routes are registered by route providers.
    }
}
