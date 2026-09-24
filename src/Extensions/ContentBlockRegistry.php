<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\ContentBlockRegistrarInterface;
use Flex\Extensions\Exception\PluginPermissionDenied;

final class ContentBlockRegistry
{
    /** @var array<string, callable(array<string, mixed>): array<string, mixed>> */
    private array $normalizers = [];

    /** @param list<string> $permissions */
    public function registrar(string $pluginId, array $permissions): ContentBlockRegistrarInterface
    {
        return new class($this, $pluginId, $permissions) implements ContentBlockRegistrarInterface {
            /** @param list<string> $permissions */
            public function __construct(private ContentBlockRegistry $registry, private string $pluginId, private array $permissions) {}

            public function register(string $type, callable $normalizer): void
            {
                if (!PluginPermissions::allows($this->permissions, PluginPermissions::CONTENT_BLOCKS)) {
                    throw new PluginPermissionDenied(sprintf('Plugin "%s" requires the "%s" permission to register content blocks.', $this->pluginId, PluginPermissions::CONTENT_BLOCKS));
                }
                $this->registry->register($type, $normalizer);
            }
        };
    }

    /** @param callable(array<string, mixed>): array<string, mixed> $normalizer */
    public function register(string $type, callable $normalizer): void
    {
        $type = trim($type);
        if ($type === '' || !preg_match('/^[a-z][a-z0-9_-]*$/', $type)) {
            throw new \InvalidArgumentException('Content block type must use lowercase letters, numbers, hyphens or underscores.');
        }
        $this->normalizers[$type] = $normalizer;
    }

    /** @return callable(array<string, mixed>): array<string, mixed>|null */
    public function normalizer(string $type): ?callable
    {
        return $this->normalizers[$type] ?? null;
    }
}
