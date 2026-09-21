<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PlatformUpdateStateStore
{
    public function __construct(private string $basePath) {}

    public function read(): ?PlatformUpdateState
    {
        $path = $this->path();
        if (!is_file($path)) {
            return null;
        }

        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new PlatformUpdateException('The platform update state cannot be read.');
        }

        try {
            $data = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new PlatformUpdateException('The platform update state contains invalid JSON.', 0, $exception);
        }

        if (!is_array($data)) {
            throw new PlatformUpdateException('The platform update state must be a JSON object.');
        }

        return PlatformUpdateState::fromArray($data);
    }

    public function write(PlatformUpdateState $state): void
    {
        $directory = dirname($this->path());
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new PlatformUpdateException('The platform update state directory cannot be created.');
        }

        $temporary = $this->path() . '.tmp-' . bin2hex(random_bytes(6));
        $contents = json_encode($state->toArray(), JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        if (file_put_contents($temporary, $contents, LOCK_EX) === false || !rename($temporary, $this->path())) {
            @unlink($temporary);
            throw new PlatformUpdateException('The platform update state cannot be written.');
        }
    }

    public function clear(): void
    {
        if (is_file($this->path()) && !unlink($this->path())) {
            throw new PlatformUpdateException('The platform update state cannot be cleared.');
        }
    }

    private function path(): string
    {
        return $this->basePath . '/storage/updates/state.json';
    }
}
