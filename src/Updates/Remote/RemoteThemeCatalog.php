<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Themes\ThemeReleaseManifest;
use Flex\Updates\Exception\InvalidRemoteReleaseManifest;

final readonly class RemoteThemeCatalog
{
    /** @param list<ThemeReleaseManifest> $releases */
    public function __construct(public int $schema, public string $repository, public string $type, public array $releases) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        if (($data['schema'] ?? null) !== 1 || ($data['repository'] ?? null) !== 'flex-cms' || ($data['type'] ?? null) !== 'theme' || !is_array($data['releases'] ?? null)) {
            throw new InvalidRemoteReleaseManifest('The theme catalog identity or schema is invalid.');
        }
        $releases = [];
        foreach ($data['releases'] as $release) {
            if (!is_array($release)) throw new InvalidRemoteReleaseManifest('Every theme release must be an object.');
            $releases[] = ThemeReleaseManifest::fromArray($release);
        }

        return new self(1, 'flex-cms', 'theme', $releases);
    }
}
