<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Updates\Exception\InvalidRemoteReleaseManifest;

final readonly class RemotePluginIndex
{
    /** @param array<string, string> $manifests @param array<string, array<string, mixed>> $metadata */
    public function __construct(
        public int $schema,
        public string $repository,
        public array $manifests,
        public array $metadata = [],
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        if (($data['schema'] ?? null) !== 1 || ($data['repository'] ?? null) !== 'flex-cms' || ($data['type'] ?? null) !== 'plugin') {
            throw new InvalidRemoteReleaseManifest('The plugin catalog identity or schema is invalid.');
        }
        $plugins = $data['plugins'] ?? null;
        if (!is_array($plugins)) {
            throw new InvalidRemoteReleaseManifest('The plugin catalog plugins value must be an array.');
        }

        $manifests = [];
        $metadata = [];
        foreach ($plugins as $plugin) {
            if (!is_array($plugin) || !is_string($plugin['id'] ?? null) || !is_string($plugin['manifest_url'] ?? null)) {
                throw new InvalidRemoteReleaseManifest('Every plugin catalog entry must contain an ID and manifest URL.');
            }
            if (preg_match('/^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/', $plugin['id']) !== 1) {
                throw new InvalidRemoteReleaseManifest('The plugin catalog contains an invalid plugin ID.');
            }
            if (filter_var($plugin['manifest_url'], FILTER_VALIDATE_URL) === false || !str_starts_with(strtolower($plugin['manifest_url']), 'https://')) {
                throw new InvalidRemoteReleaseManifest('Plugin manifest URLs must use HTTPS.');
            }
            $manifests[$plugin['id']] = $plugin['manifest_url'];
            $iconUrl = is_string($plugin['icon_url'] ?? null) ? trim($plugin['icon_url']) : '';
            if ($iconUrl !== '' && (filter_var($iconUrl, FILTER_VALIDATE_URL) === false || !str_starts_with(strtolower($iconUrl), 'https://'))) {
                throw new InvalidRemoteReleaseManifest('Plugin icon URLs must use HTTPS.');
            }
            $permissions = $plugin['permissions'] ?? [];
            if (!is_array($permissions) || array_filter($permissions, 'is_string') !== $permissions) {
                throw new InvalidRemoteReleaseManifest('Plugin catalog permissions must be an array of strings.');
            }
            $metadata[$plugin['id']] = [
                'name' => is_string($plugin['name'] ?? null) ? trim($plugin['name']) : $plugin['id'],
                'description' => is_string($plugin['description'] ?? null) ? trim($plugin['description']) : '',
                'author' => is_string($plugin['author'] ?? null) ? trim($plugin['author']) : '',
                'icon_url' => $iconUrl,
                'minimum_platform_version' => is_string($plugin['minimum_platform_version'] ?? null) ? trim($plugin['minimum_platform_version']) : '',
                'permissions' => array_values(array_unique(array_map('trim', $permissions))),
            ];
        }

        return new self(1, 'flex-cms', $manifests, $metadata);
    }
}
