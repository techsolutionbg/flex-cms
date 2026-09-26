<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Updates\Exception\InvalidRemoteReleaseManifest;

final readonly class RemotePluginIndex
{
    /** @param array<string, string> $manifests */
    public function __construct(
        public int $schema,
        public string $repository,
        public array $manifests,
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
        }

        return new self(1, 'flex-cms', $manifests);
    }
}
