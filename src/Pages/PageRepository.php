<?php

declare(strict_types=1);

namespace Flex\Pages;

use Illuminate\Database\Eloquent\Collection;

final class PageRepository
{
    /** @return Collection<int, Page> */
    public function all(): Collection
    {
        /** @var Collection<int, Page> $pages */
        $pages = Page::query()->orderByDesc('updated_at')->get();

        return $pages;
    }

    /** @return Collection<int, Page> */
    public function trashed(): Collection
    {
        /** @var Collection<int, Page> $pages */
        $pages = Page::onlyTrashed()->orderByDesc('deleted_at')->get();

        return $pages;
    }

    public function find(int $id, bool $withTrashed = false): ?Page
    {
        $page = ($withTrashed ? Page::withTrashed() : Page::query())->find($id);

        return $page instanceof Page ? $page : null;
    }

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Page
    {
        $page = new Page($attributes);
        $page->saveOrFail();

        return $page;
    }

    public function slugExists(string $slug, ?int $exceptId = null): bool
    {
        $query = Page::query()->where('slug', $slug);
        if ($exceptId !== null) {
            $query->whereKeyNot($exceptId);
        }

        return $query->exists();
    }
}
