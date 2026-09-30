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
        $page = Page::query()->where('slug', $slug)->where('status', 'published')->whereNull('deleted_at')->first();

        return $page instanceof Page ? $page : null;
    }

    /** @return list<Page> */
    public function publishedNavigation(): array
    {
        return Page::query()
            ->where('status', 'published')
            ->whereNull('deleted_at')
            ->get()
            ->filter(static function (Page $page): bool {
                $settings = $page->getAttribute('settings');

                return !is_array($settings) || ($settings['show_in_navigation'] ?? true) !== false;
            })
            ->sort(static function (Page $left, Page $right): int {
                $leftSettings = is_array($left->getAttribute('settings')) ? $left->getAttribute('settings') : [];
                $rightSettings = is_array($right->getAttribute('settings')) ? $right->getAttribute('settings') : [];
                $order = ((int) ($leftSettings['menu_order'] ?? 0)) <=> ((int) ($rightSettings['menu_order'] ?? 0));

                return $order !== 0 ? $order : strnatcasecmp((string) $left->getAttribute('title'), (string) $right->getAttribute('title'));
            })
            ->values()
            ->all();
    }
}
