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

    public function findPublishedBySlug(string $slug): ?Page
    {
        return $this->publicPageSet()->findPublishedBySlug($slug);
    }

    public function findPublishedByPath(string $path): ?Page
    {
        return $this->publicPageSet()->findPublishedByPath($path);
    }

    public function publicPath(Page $page): string
    {
        return $this->publicPageSet()->publicPath($page);
    }

    public function publicPageSet(): PublicPageSet
    {
        /** @var Collection<int, Page> $pages */
        $pages = Page::query()->whereNull('deleted_at')->get();

        return new PublicPageSet($pages);
    }

    /** @return list<Page> */
    public function publishedNavigation(): array
    {
        return $this->publicPageSet()->publishedNavigation();
    }
}
