<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

final readonly class PluginContext
{
    /**
     * @param array<string, mixed> $manifest
     * @param list<string> $permissions
     */
    public function __construct(
        public string $id,
        public string $version,
        public string $path,
        public array $manifest,
        public ExtensionApiInterface $api,
        public ?PluginRouteRegistrarInterface $routes = null,
        public array $permissions = [],
        public ?ContentBlockRegistrarInterface $contentBlocks = null,
        public ?AdminExtensionRegistrarInterface $admin = null,
        public ?PageFieldRegistrarInterface $pageFields = null,
    ) {}

    public function can(string $permission): bool
    {
        return in_array($permission, $this->permissions, true);
    }
}
