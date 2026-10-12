<?php

declare(strict_types=1);

namespace Flex\Admin;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;

/** Cached JSON snapshot of the local plugin installation for the admin plugins screen. */
final class AdminPluginsSnapshotCache
{
    private const DEFAULT_TTL = 180;

    public function __construct(
        private readonly string $basePath,
        private readonly ?ConfigRepositoryInterface $configuration = null,
    ) {}

    public function wantsHardRefresh(ServerRequestInterface $request): bool
    {
        $value = $request->getQueryParams()['refresh'] ?? null;
        if (is_string($value) && in_array(strtolower($value), ['1', 'true', 'yes'], true)) {
            return true;
        }

        return in_array(strtolower($request->getHeaderLine('X-Flex-Refresh')), ['1', 'true', 'yes'], true);
    }

    /** @return list<array<string, mixed>>|null */
    public function read(): ?array
    {
        $path = $this->path();
        if (!is_file($path)) {
            return null;
        }
        try {
            $payload = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            $this->forget();

            return null;
        }
        if (!is_array($payload) || !is_int($payload['stored_at'] ?? null) || !is_array($payload['plugins'] ?? null)) {
            $this->forget();

            return null;
        }
        if (time() - $payload['stored_at'] > $this->ttlSeconds()) {
            return null;
        }

        /** @var list<array<string, mixed>> $plugins */
        $plugins = $payload['plugins'];

        return $plugins;
    }

    /** @param list<array<string, mixed>> $plugins */
    public function write(array $plugins): void
    {
        $path = $this->path();
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            return;
        }
        $payload = json_encode([
            'stored_at' => time(),
            'plugins' => $plugins,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        @file_put_contents($path, $payload, LOCK_EX);
    }

    public function forget(): void
    {
        $path = $this->path();
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function path(): string
    {
        return $this->basePath . '/storage/cache/admin/plugins-snapshot.json';
    }

    private function ttlSeconds(): int
    {
        if ($this->configuration === null) {
            return self::DEFAULT_TTL;
        }

        return max(30, min(3600, $this->configuration->int('extensions.admin.plugins_snapshot_ttl', self::DEFAULT_TTL)));
    }
}
