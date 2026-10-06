<?php

declare(strict_types=1);

namespace Flex\Media;

/** Shared media lookup for themes and extensions; never exposes storage paths. */
final readonly class PublicMediaApi
{
    public function __construct(private MediaService $media) {}

    /** @return array<string, mixed> */
    public function get(int $id): array
    {
        try {
            $record = $this->media->get($id);
        } catch (MediaException) {
            return [];
        }
        return array_intersect_key($record, array_flip(['id', 'title', 'alt', 'caption', 'description', 'mime', 'width', 'height', 'url', 'thumbnail_url']));
    }
}
