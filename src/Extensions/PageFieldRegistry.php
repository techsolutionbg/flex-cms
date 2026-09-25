<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\PageFieldRegistrarInterface;
use Flex\Extensions\Exception\PluginPermissionDenied;

final class PageFieldRegistry
{
    /** @var array<string, array{plugin: string, id: string, type: string, label: string, default: string|bool, hint: string, max_length: int, priority: int}> */
    private array $fields = [];

    /** @var array<string, callable(int): array<string, string|bool>> */
    private array $resolvers = [];

    /** @param list<string> $permissions */
    public function registrar(string $pluginId, array $permissions): PageFieldRegistrarInterface
    {
        return new class($this, $pluginId, $permissions) implements PageFieldRegistrarInterface {
            /** @param list<string> $permissions */
            public function __construct(private PageFieldRegistry $registry, private string $pluginId, private array $permissions) {}

            public function text(string $id, string $label, string $default = '', string $hint = '', int $maxLength = 190, int $priority = 50): void
            {
                $this->assertPermission();
                $this->registry->register($this->pluginId, $id, 'text', $label, $default, $hint, $maxLength, $priority);
            }

            public function textarea(string $id, string $label, string $default = '', string $hint = '', int $maxLength = 1000, int $priority = 50): void
            {
                $this->assertPermission();
                $this->registry->register($this->pluginId, $id, 'textarea', $label, $default, $hint, $maxLength, $priority);
            }

            public function checkbox(string $id, string $label, bool $default = false, string $hint = '', int $priority = 50): void
            {
                $this->assertPermission();
                $this->registry->register($this->pluginId, $id, 'checkbox', $label, $default, $hint, 0, $priority);
            }

            public function values(callable $resolver): void
            {
                $this->assertPermission();
                $this->registry->registerResolver($this->pluginId, $resolver);
            }

            private function assertPermission(): void
            {
                if (!PluginPermissions::allows($this->permissions, PluginPermissions::ADMIN_UI)) {
                    throw new PluginPermissionDenied(sprintf('The plugin requires the "%s" permission to register page fields.', PluginPermissions::ADMIN_UI));
                }
            }
        };
    }

    /** @return list<array{plugin: string, id: string, type: string, label: string, default: string|bool, hint: string}> */
    public function bootstrap(): array
    {
        $fields = array_values($this->fields);
        usort($fields, static fn(array $left, array $right): int => $left['priority'] <=> $right['priority']);

        return array_map(static fn(array $field): array => [
            'plugin' => $field['plugin'], 'id' => $field['id'], 'type' => $field['type'],
            'label' => $field['label'], 'default' => $field['default'], 'hint' => $field['hint'],
        ], $fields);
    }

    /** @param array<string, mixed> $submitted */
    public function normalize(array $submitted): array
    {
        $result = [];
        foreach ($this->fields as $field) {
            $pluginValues = $submitted[$field['plugin']] ?? [];
            if (!is_array($pluginValues) || !array_key_exists($field['id'], $pluginValues)) continue;
            $value = $pluginValues[$field['id']];
            if ($field['type'] === 'checkbox') {
                $result[$field['plugin']][$field['id']] = filter_var($value, FILTER_VALIDATE_BOOL);
            } elseif (is_scalar($value)) {
                $result[$field['plugin']][$field['id']] = mb_substr(trim((string) $value), 0, $field['max_length']);
            }
        }
        return $result;
    }

    /** @return array<string, array<string, string|bool>> */
    public function valuesForPage(int $pageId): array
    {
        $values = [];
        foreach ($this->resolvers as $pluginId => $resolver) {
            $resolved = $resolver($pageId);
            if (is_array($resolved)) $values[$pluginId] = $resolved;
        }
        return $values;
    }

    /** @param callable(int): array<string, string|bool> $resolver */
    public function registerResolver(string $pluginId, callable $resolver): void
    {
        $this->resolvers[$pluginId] = $resolver;
    }

    public function register(string $plugin, string $id, string $type, string $label, string|bool $default, string $hint, int $maxLength, int $priority): void
    {
        $id = trim($id);
        $label = trim($label);
        if ($id === '' || !preg_match('/^[a-z][a-z0-9_-]*$/', $id) || $label === '') {
            throw new \InvalidArgumentException('Page field IDs must use lowercase letters, numbers, hyphens or underscores and require a label.');
        }
        if (!in_array($type, ['text', 'textarea', 'checkbox'], true)) throw new \InvalidArgumentException('Unsupported page field type.');
        if ($type !== 'checkbox' && ($maxLength < 1 || $maxLength > 10000)) throw new \InvalidArgumentException('Page field max length is invalid.');
        $this->fields[$plugin . '.' . $id] = ['plugin' => $plugin, 'id' => $id, 'type' => $type, 'label' => $label, 'default' => $default, 'hint' => trim($hint), 'max_length' => $maxLength, 'priority' => $priority];
    }
}
