<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use RuntimeException;

final class RemoteCatalogPublication
{
    /** @param array<string, mixed> $catalog
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    public static function merge(array $catalog, array $entry, string $publicKey): array
    {
        $releases = [];
        foreach ([...($catalog['releases'] ?? []), $entry] as $release) {
            if (!RemoteReleaseManifestSigner::verify($release, $publicKey)) {
                // Recover only a proven serialization change, never re-sign altered metadata.
                $original = $release;
                $original['published_at'] = (new \DateTimeImmutable($release['published_at']))
                    ->setTimezone(new \DateTimeZone('UTC'))->format(DATE_ATOM);
                if (!RemoteReleaseManifestSigner::verify($original, $publicKey)) {
                    throw new RuntimeException('Refusing to publish an invalid release signature: ' . $release['version']);
                }
                $release = $original;
            }
            $identity = $release['package'] . '/' . $release['version'] . '/' . $release['channel'];
            $releases[$identity] = $release;
        }
        ksort($releases, SORT_STRING);
        $catalog['releases'] = array_values($releases);

        return $catalog;
    }
}
