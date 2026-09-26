<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Updates\Exception\InvalidRemoteReleaseManifest;

final readonly class RemoteCatalog
{
    /** @param list<RemoteReleaseManifest> $releases */
    public function __construct(
        public int $schema,
        public string $repository,
        public string $type,
        public array $releases,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data, string $expectedType): self
    {
        if (($data['schema'] ?? null) !== 1 || ($data['repository'] ?? null) !== 'flex-cms' || ($data['type'] ?? null) !== $expectedType) {
            throw new InvalidRemoteReleaseManifest('The update catalog identity or schema is invalid.');
        }
        $rawReleases = $data['releases'] ?? null;
        if (!is_array($rawReleases)) {
            throw new InvalidRemoteReleaseManifest('The update catalog releases value must be an array.');
        }

        $releases = [];
        foreach ($rawReleases as $release) {
            if (!is_array($release)) {
                throw new InvalidRemoteReleaseManifest('Every update catalog release must be an object.');
            }
            $manifest = RemoteReleaseManifest::fromArray($release);
            if ($manifest->type !== $expectedType) {
                throw new InvalidRemoteReleaseManifest('A release type does not match its catalog.');
            }
            $releases[] = $manifest;
        }

        return new self(1, 'flex-cms', $expectedType, $releases);
    }
}
