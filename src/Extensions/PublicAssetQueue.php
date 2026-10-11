<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\PublicAssetRegistrarInterface;
use Flex\Extensions\Exception\PluginPermissionDenied;

/** The public file groups that plugins asked for during this request (see PublicAssetRegistrarInterface). */
final class PublicAssetQueue
{
    /** @var array<string, array<string, true>> Plugin ID => groups, in the order they were asked for. */
    private array $groups = [];

    /** @var list<array{plugin: string, group: string, condition: callable(): bool}> */
    private array $conditions = [];

    /** @param list<string> $permissions */
    public function registrar(string $pluginId, array $permissions): PublicAssetRegistrarInterface
    {
        return new class($this, $pluginId, $permissions) implements PublicAssetRegistrarInterface {
            /** @param list<string> $permissions */
            public function __construct(private PublicAssetQueue $queue, private string $pluginId, private array $permissions) {}

            public function enqueue(string $group): void
            {
                $this->assertAllowed($group);
                $this->queue->add($this->pluginId, $group);
            }

            public function enqueueWhen(string $group, callable $condition): void
            {
                $this->assertAllowed($group);
                $this->queue->addWhen($this->pluginId, $group, $condition);
            }

            private function assertAllowed(string $group): void
            {
                if (!PluginPermissions::allows($this->permissions, PluginPermissions::FRONTEND_ASSETS)) {
                    throw new PluginPermissionDenied(sprintf('Plugin "%s" requires the "%s" permission to load public assets.', $this->pluginId, PluginPermissions::FRONTEND_ASSETS));
                }
                if (preg_match('/\A[a-z][a-z0-9-]{0,40}\z/D', $group) !== 1) {
                    throw new \InvalidArgumentException(sprintf('Invalid public asset group "%s".', $group));
                }
            }
        };
    }

    public function add(string $pluginId, string $group): void
    {
        $this->groups[$pluginId][$group] = true;
    }

    /** @param callable(): bool $condition */
    public function addWhen(string $pluginId, string $group, callable $condition): void
    {
        $this->conditions[] = ['plugin' => $pluginId, 'group' => $group, 'condition' => $condition];
    }

    /**
     * The groups of a plugin for the page, with conditional groups checked now. A failing condition only
     * leaves its group out.
     * @return list<string>
     */
    public function groupsFor(string $pluginId): array
    {
        foreach ($this->conditions as $index => $entry) {
            if ($entry['plugin'] !== $pluginId) {
                continue;
            }
            unset($this->conditions[$index]);
            try {
                if (($entry['condition'])() === true) {
                    $this->add($pluginId, $entry['group']);
                }
            } catch (\Throwable) {
                // A plugin's condition must never break the page.
            }
        }

        return array_keys($this->groups[$pluginId] ?? []);
    }
}
