<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportResponse;
use Flex\Updates\Exception\RemoteCatalogException;

final class ThemeCatalogClient
{
    private const CACHE_TTL = 300;
    private ?RemoteThemeIndex $indexCache = null;
    /** @var array<string, RemoteThemeCatalog> */
    private array $manifestCache = [];

    public function __construct(private readonly ConfigRepositoryInterface $configuration, private readonly RemoteCatalogTransportInterface $transport, private readonly string $basePath) {}

    public function index(): RemoteThemeIndex
    {
        return $this->indexCache ??= RemoteThemeIndex::fromArray($this->json($this->get('/themes/index.json'), 'theme catalog'));
    }

    public function manifest(string $id): RemoteThemeCatalog
    {
        if (isset($this->manifestCache[$id])) return $this->manifestCache[$id];
        $url = $this->index()->manifests[$id] ?? null;
        if ($url === null) throw new RemoteCatalogException(sprintf('Theme "%s" is not listed in the update catalog.', $id));

        return $this->manifestCache[$id] = RemoteThemeCatalog::fromArray($this->json($this->getAbsolute($url), 'theme catalog'));
    }

    private function get(string $path): RemoteCatalogTransportResponse
    {
        $url = rtrim($this->configuration->string('extensions.updates.server_url'), '/') . '/' . ltrim($path, '/');
        if (!str_starts_with(strtolower($url), 'https://')) throw new RemoteCatalogException('The update server URL must be an HTTPS URL.');

        return $this->getAbsolute($url);
    }

    private function getAbsolute(string $url): RemoteCatalogTransportResponse
    {
        $path = $this->basePath . '/storage/cache/updates/' . hash('sha256', $url) . '.json';
        $cached = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
        $headers = ['Accept: application/json'];
        if (is_array($cached) && is_int($cached['stored_at'] ?? null) && time() - $cached['stored_at'] < self::CACHE_TTL) {
            if (isset($cached['etag'])) $headers[] = 'If-None-Match: ' . $cached['etag'];
            if (isset($cached['last_modified'])) $headers[] = 'If-Modified-Since: ' . $cached['last_modified'];
        }
        $response = $this->transport->get($url, $headers);
        if ($response->status === 304 && is_array($cached)) return new RemoteCatalogTransportResponse(200, (string) ($cached['body'] ?? ''), (array) ($cached['headers'] ?? []));
        if ($response->status !== 200) return $response;
        if (!is_dir(dirname($path))) mkdir(dirname($path), 0775, true);
        file_put_contents($path, json_encode(['body' => $response->body, 'headers' => $response->headers, 'stored_at' => time(), ...isset($response->headers['etag']) ? ['etag' => $response->headers['etag']] : [], ...isset($response->headers['last-modified']) ? ['last_modified' => $response->headers['last-modified']] : []], JSON_THROW_ON_ERROR), LOCK_EX);

        return $response;
    }

    /** @return array<string, mixed> */
    private function json(RemoteCatalogTransportResponse $response, string $label): array
    {
        if (!in_array($response->status, [200, 304], true) || $response->body === '') throw new RemoteCatalogException(sprintf('The %s response is invalid.', $label));
        try {
            $data = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new RemoteCatalogException(sprintf('The %s response contains invalid JSON.', $label), 0, $exception);
        }
        if (!is_array($data)) throw new RemoteCatalogException(sprintf('The %s response must be an object.', $label));

        return $data;
    }
}
