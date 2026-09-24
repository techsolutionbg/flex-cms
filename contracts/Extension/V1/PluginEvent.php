<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

final readonly class PluginEvent implements ExtensionEventInterface
{
    public function __construct(
        private string $eventName,
        public string $id,
        public string $version,
        public string $path,
        public string $fromVersion = '',
    ) {}

    public function name(): string
    {
        return $this->eventName;
    }

    public function payload(): array
    {
        return [
            'id' => $this->id,
            'version' => $this->version,
            'path' => $this->path,
            'from_version' => $this->fromVersion,
        ];
    }
}
