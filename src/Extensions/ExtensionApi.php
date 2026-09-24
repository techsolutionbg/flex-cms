<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\ExtensionApiInterface;

final class ExtensionApi implements ExtensionApiInterface
{
    /** @var array<string, list<array{priority: int, callback: callable}>> */
    private array $filters = [];

    /** @var array<string, list<array{priority: int, callback: callable}>> */
    private array $actions = [];

    public function addFilter(string $name, callable $callback, int $priority = 10): void
    {
        $this->filters[$name][] = ['priority' => $priority, 'callback' => $callback];
        $this->sort($this->filters[$name]);
    }

    public function addAction(string $name, callable $callback, int $priority = 10): void
    {
        $this->actions[$name][] = ['priority' => $priority, 'callback' => $callback];
        $this->sort($this->actions[$name]);
    }

    public function applyFilters(string $name, mixed $value, array $context = []): mixed
    {
        foreach ($this->filters[$name] ?? [] as $filter) {
            $value = ($filter['callback'])($value, $context);
        }

        return $value;
    }

    public function doAction(string $name, array $context = []): void
    {
        foreach ($this->actions[$name] ?? [] as $action) {
            ($action['callback'])($context);
        }
    }

    /** @param list<array{priority: int, callback: callable}> $callbacks */
    private function sort(array &$callbacks): void
    {
        usort($callbacks, static fn(array $left, array $right): int => $left['priority'] <=> $right['priority']);
    }
}
