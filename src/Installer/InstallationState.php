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
        $environment = $this->environmentPath();
        $environmentIsEmpty = is_file($environment) && (filesize($environment) ?: 0) === 0;

        return !is_file($this->markerPath()) && (!is_file($environment) || $environmentIsEmpty);
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
