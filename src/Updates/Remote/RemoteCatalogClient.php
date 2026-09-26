<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportResponse;
use Flex\Updates\Exception\RemoteCatalogException;

final class RemoteCatalogClient
{
    private const CACHE_TTL = 300;

    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
        private readonly RemoteCatalogTransportInterface $transport,
        private readonly string $basePath,
    ) {}

    public function platformCatalog(): RemoteCatalog
    {
        $data = $this->json($this->get('/platform/manifest.json'), 'platform catalog');

        return RemoteCatalog::fromArray($data, 'platform');
    }

    public function pluginIndex(): RemotePluginIndex
    {
        $data = $this->json($this->get('/plugins/index.json'), 'plugin catalog');

        return RemotePluginIndex::fromArray($data);
    }

    public function pluginManifest(string $id): RemoteCatalog
    {
        $url = $this->pluginIndex()->manifests[$id] ?? null;
        if ($url === null) {
            throw new RemoteCatalogException(sprintf('Plugin "%s" is not listed in the update catalog.', $id));
        }

        return RemoteCatalog::fromArray($this->json($this->getAbsolute($url), 'plugin catalog'), 'plugin');
    }

    /** @return array<string, mixed> */
    private function json(RemoteCatalogTransportResponse $response, string $label): array
    {
        if (!in_array($response->status, [200, 304], true)) {
            throw new RemoteCatalogException(sprintf('The %s request returned HTTP %d.', $label, $response->status));
        }
        if ($response->body === '') {
            throw new RemoteCatalogException(sprintf('The %s response is empty.', $label));
        }

        try {
            $data = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new RemoteCatalogException(sprintf('The %s response contains invalid JSON.', $label), 0, $exception);
        }
        if (!is_array($data)) {
            throw new RemoteCatalogException(sprintf('The %s response must be a JSON object.', $label));
        }

        return $data;
    }

    private function get(string $path): RemoteCatalogTransportResponse
    {
        return $this->getAbsolute($this->serverUrl() . '/' . ltrim($path, '/'));
    }

    private function getAbsolute(string $url): RemoteCatalogTransportResponse
    {
        $cachePath = $this->cachePath($url);
        $cached = $this->readCache($cachePath);
        $headers = ['Accept: application/json'];
        if ($cached !== null && (time() - $cached['stored_at']) < self::CACHE_TTL) {
            if (isset($cached['etag'])) {
                $headers[] = 'If-None-Match: ' . $cached['etag'];
            }
            if (isset($cached['last_modified'])) {
                $headers[] = 'If-Modified-Since: ' . $cached['last_modified'];
            }
        }

        $response = $this->transport->get($url, $headers);
        if ($response->status === 304 && $cached !== null) {
            return new RemoteCatalogTransportResponse(200, $cached['body'], $cached['headers']);
        }
        if ($response->status !== 200) {
            return $response;
        }

        $this->writeCache($cachePath, $response);

        return $response;
    }

    private function serverUrl(): string
    {
        $url = rtrim($this->configuration->string('extensions.updates.server_url'), '/');
        if ($url === '' || !str_starts_with(strtolower($url), 'https://')) {
            throw new RemoteCatalogException('The update server URL must be an HTTPS URL.');
        }

        return $url;
    }

    private function cachePath(string $url): string
    {
        return $this->basePath . '/storage/cache/updates/' . hash('sha256', $url) . '.json';
    }

    /** @return array{body: string, headers: array<string, string>, stored_at: int, etag?: string, last_modified?: string}|null */
    private function readCache(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        try {
            $cache = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }

        return is_array($cache) && is_string($cache['body'] ?? null) && is_int($cache['stored_at'] ?? null) && is_array($cache['headers'] ?? null) ? $cache : null;
    }

    private function writeCache(string $path, RemoteCatalogTransportResponse $response): void
    {
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            return;
        }
        $cache = [
            'body' => $response->body,
            'headers' => $response->headers,
            'stored_at' => time(),
        ];
        if (isset($response->headers['etag'])) {
            $cache['etag'] = $response->headers['etag'];
        }
        if (isset($response->headers['last-modified'])) {
            $cache['last_modified'] = $response->headers['last-modified'];
        }
        @file_put_contents($path, json_encode($cache, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES), LOCK_EX);
    }
}
