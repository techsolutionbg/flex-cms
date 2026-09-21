<?php

declare(strict_types=1);

namespace Flex\Configuration;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final readonly class ProjectPaths
{
    public function __construct(
        private string $basePath,
        private ConfigRepositoryInterface $configuration,
    ) {
    }

    public function base(): string
    {
        return $this->basePath;
    }

    public function config(): string
    {
        return $this->resolve('paths.config');
    }

    public function storage(string $suffix = ''): string
    {
        return $this->resolve('paths.storage', $suffix);
    }

    public function plugins(string $suffix = ''): string
    {
        return $this->resolve('paths.plugins', $suffix);
    }

    public function themes(string $suffix = ''): string
    {
        return $this->resolve('paths.themes', $suffix);
    }

    public function publicMedia(string $suffix = ''): string
    {
        return $this->resolve('paths.public_media', $suffix);
    }

    private function resolve(string $key, string $suffix = ''): string
    {
        $path = $this->basePath . '/' . trim($this->configuration->string($key), '/');

        return $suffix === '' ? $path : $path . '/' . ltrim($suffix, '/');
    }
}
