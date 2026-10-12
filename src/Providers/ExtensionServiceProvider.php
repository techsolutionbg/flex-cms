<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extensions\ExtensionApi;
use Flex\Extensions\FrontendExtensionAssets;
use Flex\Extensions\AdminExtensionRegistry;
use Flex\Extensions\ContentBlockRegistry;
use Flex\Extensions\PageFieldRegistry;
use Flex\Extensions\PageSettingsRegistry;
use Flex\Extensions\PluginRouteRegistrar;
use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginEntrypointLoader;
use Flex\Admin\AdminPluginsSnapshotCache;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Extensions\PluginRegistry;
use Flex\Extensions\PluginRuntime;
use Flex\Extensions\PublicAssetQueue;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Logging\OperationErrorJournal;
use Flex\Pages\PageService;
use Psr\Container\ContainerInterface;

use function DI\autowire;
use function DI\create;
use function DI\get;

final class ExtensionServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            PluginRegistry::class => autowire(),
            AdminPluginsSnapshotCache::class => create()->constructor(get('base_path'), get(ConfigRepositoryInterface::class)),
            PluginEntrypointLoader::class => autowire(),
            \Flex\Extensions\PluginServicesFactory::class => autowire(),
            ExtensionApi::class => autowire(),
            ExtensionApiInterface::class => get(ExtensionApi::class),
            PluginManager::class => autowire()
                ->constructorParameter('services', get(\Flex\Extensions\PluginServicesFactory::class))
                ->constructorParameter('contentBlocks', get(ContentBlockRegistry::class))
                ->constructorParameter('adminExtensions', get(AdminExtensionRegistry::class))
                ->constructorParameter('pageFields', get(PageFieldRegistry::class))
                ->constructorParameter('pageSettings', get(PageSettingsRegistry::class))
                ->constructorParameter('operationErrors', get(\Flex\Logging\OperationErrorJournal::class)),
            PluginRuntime::class => autowire()
                ->constructorParameter('services', get(\Flex\Extensions\PluginServicesFactory::class))
                ->constructorParameter('contentBlocks', get(ContentBlockRegistry::class))
                ->constructorParameter('adminExtensions', get(AdminExtensionRegistry::class))
                ->constructorParameter('pageFields', get(PageFieldRegistry::class))
                ->constructorParameter('pageSettings', get(PageSettingsRegistry::class))
                ->constructorParameter('routes', get(RouteRegistryInterface::class))
                ->constructorParameter('publicAssets', get(PublicAssetQueue::class)),
            PageService::class => autowire()
                ->constructorParameter('media', get(\Flex\Media\MediaService::class))
                ->constructorParameter('contentBlocks', get(ContentBlockRegistry::class))
                ->constructorParameter('pageFields', get(PageFieldRegistry::class))
                ->constructorParameter('pageSettings', get(PageSettingsRegistry::class)),
            ContentBlockRegistry::class => autowire(),
            AdminExtensionRegistry::class => autowire(),
            PageFieldRegistry::class => autowire(),
            PageSettingsRegistry::class => autowire(),
            PublicAssetQueue::class => autowire(),
            FrontendExtensionAssets::class => autowire()
                ->constructorParameter('queue', get(PublicAssetQueue::class)),
            PluginRouteRegistrar::class => autowire(),
        ];
    }

    public function boot(ContainerInterface $container): void
    {
        $journal = $container->get(OperationErrorJournal::class);
        $container->get(ExtensionApiInterface::class)->addAction(
            'operation.error.report',
            static function (array $context) use ($journal): void {
                $message = is_string($context['message'] ?? null) ? trim($context['message']) : '';
                if ($message === '') {
                    return;
                }
                $scope = is_string($context['scope'] ?? null) ? $context['scope'] : 'extension';
                $component = is_string($context['component'] ?? null) ? $context['component'] : 'extension';
                $operation = is_string($context['operation'] ?? null) ? $context['operation'] : 'operation.error.report';
                $exception = ($context['exception'] ?? null) instanceof \Throwable ? $context['exception'] : null;
                $details = is_array($context['context'] ?? null) ? $context['context'] : [];
                $journal->record($scope, $component, $operation, $message, $exception, $details);
            },
        );
    }
}
