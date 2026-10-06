<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Updates\Exception\InvalidRemoteReleaseManifest;

final readonly class RemoteThemeIndex
{
    /** @param array<string, string> $manifests @param array<string, array<string, mixed>> $metadata */
    public function __construct(public int $schema, public string $repository, public array $manifests, public array $metadata = []) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        if (($data['schema'] ?? null) !== 1 || ($data['repository'] ?? null) !== 'flex-cms' || ($data['type'] ?? null) !== 'theme' || !is_array($data['themes'] ?? null)) {
            throw new InvalidRemoteReleaseManifest('The theme catalog identity or schema is invalid.');
        }
        $manifests = [];
        $metadata = [];
        foreach ($data['themes'] as $theme) {
            if (!is_array($theme) || !is_string($theme['id'] ?? null) || !is_string($theme['manifest_url'] ?? null) || preg_match('/^[a-z0-9][a-z0-9._-]*$/', $theme['id']) !== 1 || filter_var($theme['manifest_url'], FILTER_VALIDATE_URL) === false || !str_starts_with(strtolower($theme['manifest_url']), 'https://')) {
                throw new InvalidRemoteReleaseManifest('Every theme catalog entry must contain a valid ID and HTTPS manifest URL.');
            }
            $id = $theme['id'];
            $manifests[$id] = $theme['manifest_url'];
            $metadata[$id] = [
                'name' => is_string($theme['name'] ?? null) ? trim($theme['name']) : $id,
                'description' => is_string($theme['description'] ?? null) ? trim($theme['description']) : '',
                'author' => is_string($theme['author'] ?? null) ? trim($theme['author']) : '',
                'screenshot_url' => is_string($theme['screenshot_url'] ?? null) ? trim($theme['screenshot_url']) : null,
                'tags' => is_array($theme['tags'] ?? null) ? array_values(array_filter($theme['tags'], 'is_string')) : [],
                'minimum_platform_version' => is_string($theme['minimum_platform_version'] ?? null) ? trim($theme['minimum_platform_version']) : '',
                'license' => is_string($theme['license'] ?? null) ? trim($theme['license']) : null,
                'homepage' => is_string($theme['homepage'] ?? null) ? trim($theme['homepage']) : null,
                'documentation' => is_string($theme['documentation'] ?? null) ? trim($theme['documentation']) : null,
                'supports' => is_array($theme['supports'] ?? null) ? $theme['supports'] : null,
                'menu_locations' => is_array($theme['menu_locations'] ?? null) ? $theme['menu_locations'] : null,
            ];
        }

        return new self(1, 'flex-cms', $manifests, $metadata);
    }
}
