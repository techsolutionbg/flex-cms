<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extension\V1\ExtensionEventInterface;
use Flex\Extensions\Exception\PluginPermissionDenied;

final readonly class ScopedExtensionApi implements ExtensionApiInterface
{
    /** @param list<string> $permissions */
    public function __construct(
        private ExtensionApiInterface $delegate,
        private string $pluginId,
        private array $permissions,
    ) {}

    public function addFilter(string $name, callable $callback, int $priority = 10): void
    {
        $this->delegate->addFilter($name, $callback, $priority);
    }

    public function addAction(string $name, callable $callback, int $priority = 10): void
    {
        $this->delegate->addAction($name, $callback, $priority);
    }

    public function applyFilters(string $name, mixed $value, array $context = []): mixed
    {
        return $this->delegate->applyFilters($name, $value, $context);
    }

    public function doAction(string $name, array $context = []): void
    {
        $this->delegate->doAction($name, $context);
    }

    public function listen(string $eventName, callable $listener, int $priority = 10): void
    {
        if (!PluginPermissions::allows($this->permissions, PluginPermissions::EVENTS_LISTEN)) {
            throw new PluginPermissionDenied(sprintf('Plugin "%s" requires the "%s" permission to listen to events.', $this->pluginId, PluginPermissions::EVENTS_LISTEN));
        }

        $this->delegate->listen($eventName, $listener, $priority);
    }

    public function dispatch(ExtensionEventInterface $event): void
    {
        $this->delegate->dispatch($event);
    }
}
