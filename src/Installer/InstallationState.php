<?php

declare(strict_types=1);

namespace Flex\Installer;

final readonly class InstallationState
{
    public function __construct(
        private string $basePath,
    ) {}

    public function requiresInstallation(): bool
    {
        return !is_file($this->environmentPath()) && !is_file($this->markerPath());
    }

    public function markerPath(): string
    {
        return $this->basePath . '/storage/installed.json';
    }

    public function environmentPath(): string
    {
        return $this->basePath . '/.env';
    }
}
