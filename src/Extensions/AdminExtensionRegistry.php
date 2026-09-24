<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\AdminExtensionRegistrarInterface;
use Flex\Extensions\Exception\PluginPermissionDenied;

final class AdminExtensionRegistry
{
    /** @var array<string, array{id: string, label: string, href: string, priority: int}> */
    private array $sidebarItems = [];

    /** @var array<string, list<array{kind: string, title: string, text: string, href: string|null, priority: int}>> */
    private array $slots = [];

    /** @var list<string> */
    private const SLOTS = [
        'admin.dashboard.before', 'admin.dashboard.after',
        'admin.pages.before', 'admin.pages.after',
        'admin.pages.table.before', 'admin.pages.table.after',
        'admin.page.form.before', 'admin.page.form.after',
        'admin.profile.before', 'admin.profile.after',
        'admin.updates.before', 'admin.updates.after',
        'admin.plugins.before', 'admin.plugins.after',
    ];

    /** @param list<string> $permissions */
    public function registrar(string $pluginId, array $permissions): AdminExtensionRegistrarInterface
    {
        $addSidebarItem = function (string $id, string $label, string $href, int $priority): void {
            $this->addSidebarItem($id, $label, $href, $priority);
        };
        $addSlot = function (string $name, string $kind, string $title, string $text, ?string $href, int $priority): void {
            $this->addSlot($name, $kind, $title, $text, $href, $priority);
        };

        return new class($permissions, $addSidebarItem, $addSlot) implements AdminExtensionRegistrarInterface {
            /** @param list<string> $permissions */
            public function __construct(private array $permissions, private \Closure $addSidebarItem, private \Closure $addSlot) {}

            public function sidebarItem(string $id, string $label, string $href, int $priority = 50): void
            {
                $this->assertPermission();
                ($this->addSidebarItem)($id, $label, $href, $priority);
            }

            public function slot(string $name, string $kind, string $title, string $text = '', ?string $href = null, int $priority = 50): void
            {
                $this->assertPermission();
                ($this->addSlot)($name, $kind, $title, $text, $href, $priority);
            }

            private function assertPermission(): void
            {
                if (!PluginPermissions::allows($this->permissions, PluginPermissions::ADMIN_UI)) {
                    throw new PluginPermissionDenied(sprintf('The plugin requires the "%s" permission to extend the admin UI.', PluginPermissions::ADMIN_UI));
                }
            }
        };
    }

    /** @return array{sidebar: list<array{id: string, label: string, href: string}>, slots: array<string, list<array{kind: string, title: string, text: string, href: string|null}>>} */
    public function bootstrap(): array
    {
        $sidebar = array_values($this->sidebarItems);
        usort($sidebar, static fn(array $left, array $right): int => $left['priority'] <=> $right['priority']);
        $sidebar = array_map(static fn(array $item): array => ['id' => $item['id'], 'label' => $item['label'], 'href' => $item['href']], $sidebar);

        $slots = [];
        foreach ($this->slots as $name => $items) {
            usort($items, static fn(array $left, array $right): int => $left['priority'] <=> $right['priority']);
            $slots[$name] = array_map(static fn(array $item): array => [
                'kind' => $item['kind'], 'title' => $item['title'], 'text' => $item['text'], 'href' => $item['href'],
            ], $items);
        }

        return ['sidebar' => $sidebar, 'slots' => $slots];
    }

    private function addSidebarItem(string $id, string $label, string $href, int $priority): void
    {
        $id = trim($id);
        $label = trim($label);
        if ($id === '' || $label === '' || !preg_match('/^[a-z][a-z0-9._-]*$/', $id)) {
            throw new \InvalidArgumentException('Admin sidebar item IDs must use lowercase letters, numbers, dots, hyphens or underscores.');
        }
        if (!str_starts_with($href, '/') || str_contains($href, '://') || str_contains($href, '..')) {
            throw new \InvalidArgumentException('Admin extension links must be local paths without traversal.');
        }
        $this->sidebarItems[$id] = ['id' => $id, 'label' => $label, 'href' => $href, 'priority' => $priority];
    }

    private function addSlot(string $name, string $kind, string $title, string $text, ?string $href, int $priority): void
    {
        if (!in_array($name, self::SLOTS, true)) {
            throw new \InvalidArgumentException(sprintf('Unknown admin extension slot "%s".', $name));
        }
        if (!in_array($kind, ['notice', 'card', 'link'], true) || trim($title) === '') {
            throw new \InvalidArgumentException('Admin extension components must be notice, card or link and have a title.');
        }
        if ($kind === 'link' && ($href === null || !str_starts_with($href, '/') || str_contains($href, '://') || str_contains($href, '..'))) {
            throw new \InvalidArgumentException('Admin extension links must be local paths without traversal.');
        }
        $this->slots[$name][] = ['kind' => $kind, 'title' => trim($title), 'text' => trim($text), 'href' => $href, 'priority' => $priority];
    }
}
