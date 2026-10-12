<?php

declare(strict_types=1);

namespace Flex\Themes;

use Illuminate\Database\Eloquent\Collection;

final class ThemeResourceRepository
{
    /** @return Collection<int, ThemeRecord> */
    public function all(string $themeId, string $resource, bool $trashed = false): Collection
    {
        $query = $trashed ? ThemeRecord::onlyTrashed() : ThemeRecord::query();
        /** @var Collection<int, ThemeRecord> $records */
        $records = $query
            ->where('theme_id', $themeId)
            ->where('resource', $resource)
            ->orderByDesc($trashed ? 'deleted_at' : 'updated_at')
            ->get();

        return $records;
    }

    public function find(string $themeId, string $resource, int $id, bool $withTrashed = false): ?ThemeRecord
    {
        $query = $withTrashed ? ThemeRecord::withTrashed() : ThemeRecord::query();
        $record = $query->where('theme_id', $themeId)->where('resource', $resource)->find($id);

        return $record instanceof ThemeRecord ? $record : null;
    }

    public function slugExists(string $themeId, string $resource, string $slug, ?int $exceptId = null): bool
    {
        $query = ThemeRecord::withTrashed()
            ->where('theme_id', $themeId)
            ->where('resource', $resource)
            ->where('slug', $slug);
        if ($exceptId !== null) {
            $query->where('id', '!=', $exceptId);
        }

        return $query->exists();
    }

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): ThemeRecord
    {
        $record = new ThemeRecord($attributes);
        $record->saveOrFail();

        return $record;
    }

    /** @return Collection<int, ThemeRecord> */
    public function published(string $themeId, string $resource): Collection
    {
        /** @var Collection<int, ThemeRecord> $records */
        $records = ThemeRecord::query()
            ->where('theme_id', $themeId)
            ->where('resource', $resource)
            ->where('status', 'published')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get();

        return $records;
    }
}
