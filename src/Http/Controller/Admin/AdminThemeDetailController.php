<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Composer\Semver\Semver;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Themes\ThemeManager;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Updates\Remote\{ThemeCatalogClient, RemoteThemeInstaller};
use Psr\Http\Message\{ResponseInterface, ServerRequestInterface};

final readonly class AdminThemeDetailController
{
    public function __construct(private AuthenticationInterface $authentication, private ThemeManager $themes, private ThemeCatalogClient $catalog, private RemoteThemeInstaller $installer, private PlatformVersionRegistry $versions, private ConfigRepositoryInterface $configuration, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        if (!$this->authentication->user()?->isSuperAdmin()) {
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        $id = $arguments['id'] ?? '';
        if (preg_match('/^[a-z0-9][a-z0-9._-]*$/', $id) !== 1) {
            return $this->responses->json(['error' => ['message' => 'Невалидна тема.']], 404);
        }
        $local = array_values(array_filter($this->themes->all(), static fn(array $theme): bool => $theme['id'] === $id))[0] ?? null;
        $metadata = [];
        if ($local !== null && is_file($local['path'] . '/theme.json')) {
            $parsed = json_decode((string) file_get_contents($local['path'] . '/theme.json'), true);
            if (is_array($parsed)) $metadata = $parsed;
        }
        $remote = null;
        $remoteError = null;
        $indexMetadata = null;
        try {
            $index = $this->catalog->index();
            $indexMetadata = $index->metadata[$id] ?? null;
            if (isset($index->manifests[$id])) $remote = $this->catalog->manifest($id);
        } catch (\Throwable) {
            $remoteError = 'Каталогът временно не е достъпен. Показани са наличните локални данни.';
        }
        if ($local === null && $indexMetadata === null) {
            return $this->responses->json(['error' => ['message' => $remoteError ?? 'Темата не е намерена.']], $remoteError !== null ? 502 : 404);
        }
        $metadata = array_replace($indexMetadata ?? [], $metadata);
        $platform = $this->versions->current()->value;
        $channel = $this->configuration->string('extensions.updates.channel');
        $releases = [];
        foreach ($remote !== null ? $remote->releases : [] as $release) {
            if ($release->package !== $id) continue;
            $reasons = [];
            if ($release->channel->value !== $channel) $reasons[] = 'Различен канал на разпространение.';
            if (!Semver::satisfies(PHP_VERSION, $release->minimumPhp)) $reasons[] = 'Несъвместима версия на PHP.';
            if (!Semver::satisfies($platform, $release->compatibleFrom)) $reasons[] = 'Несъвместима версия на Flex CMS.';
            $releases[] = ['version' => $release->version, 'channel' => $release->channel->value, 'published_at' => $release->publishedAt, 'release_notes' => $release->releaseNotes, 'size' => $release->size, 'minimum_php' => $release->minimumPhp, 'compatible_from' => $release->compatibleFrom, 'signature_algorithm' => $release->signatureAlgorithm, 'key_id' => $release->keyId, 'signed' => $release->signature !== null, 'compatible' => $reasons === [], 'reasons' => $reasons];
        }
        usort($releases, static fn(array $a, array $b): int => version_compare($b['version'], $a['version']));
        $latest = $remote !== null ? $this->installer->latestCompatibleRelease($remote, $id) : null;
        $fields = [];
        foreach (['name', 'description', 'author', 'license', 'homepage', 'documentation', 'minimum_platform_version'] as $field) {
            $fields[$field] = is_string($metadata[$field] ?? null) ? $metadata[$field] : null;
        }
        $supports = null;
        if (is_array($metadata['supports'] ?? null)) {
            $supports = array_is_list($metadata['supports'])
                ? array_values(array_filter($metadata['supports'], 'is_string'))
                : array_filter($metadata['supports'], static fn(mixed $value, mixed $key): bool => is_string($key) && is_bool($value), ARRAY_FILTER_USE_BOTH);
        }
        $locations = is_array($metadata['menu_locations'] ?? null)
            ? array_filter($metadata['menu_locations'], static fn(mixed $value, mixed $key): bool => is_string($key) && is_string($value), ARRAY_FILTER_USE_BOTH)
            : null;
        return $this->responses->json(['theme' => $fields + [
            'id' => $id, 'installed' => $local !== null, 'active' => $local['active'] ?? false,
            'valid' => $local['valid'] ?? true, 'error' => $local['error'] ?? null,
            'installed_version' => $local['version'] ?? null, 'latest_version' => $latest?->version,
            'update_available' => $local !== null && $latest !== null && version_compare($latest->version, $local['version'], '>'),
            'screenshot_url' => $local['screenshot_url'] ?? $metadata['screenshot_url'] ?? null,
            'tags' => is_array($metadata['tags'] ?? null) ? array_values(array_filter($metadata['tags'], 'is_string')) : [],
            'supports' => $supports,
            'menu_locations' => $locations,
            'platform_version' => $platform, 'php_version' => PHP_VERSION, 'channel' => $channel,
            'releases' => $releases, 'catalog_error' => $remoteError,
        ]])->withHeader('Cache-Control', 'no-store');
    }
}
