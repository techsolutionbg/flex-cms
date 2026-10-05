<?php

declare(strict_types=1);

namespace Flex\Pages;

use Illuminate\Database\Eloquent\Collection;

/** A request-local snapshot of non-deleted pages used to build public URLs and navigation. */
final class PublicPageSet
{
    /** @var array<int, Page> */
    private array $pagesById = [];

    /** @var array<string, string> */
    private array $pathCache = [];

    /** @param Collection<int, Page> $pages */
    public function __construct(private readonly Collection $pages)
    {
        foreach ($pages as $page) {
            $this->pagesById[(int) $page->getKey()] = $page;
        }
    }

    public function findPublishedById(int $id): ?Page
    {
        $page = $this->pagesById[$id] ?? null;
        return $page?->getAttribute('status') === 'published' ? $page : null;
    }

    public function findPublishedBySlug(string $slug): ?Page
    {
        foreach ($this->pages as $page) {
            if ($page->getAttribute('slug') === $slug && $page->getAttribute('status') === 'published') {
                return $page;
            }
        }

        return null;
    }

    public function findPublishedByPath(string $path): ?Page
    {
        $normalizedPath = trim(rawurldecode($path), '/');
        if ($normalizedPath === '') {
            return null;
        }

        foreach ($this->pages as $page) {
            if ($page->getAttribute('status') === 'published' && $this->publicPath($page) === $normalizedPath) {
                return $page;
            }
        }

        return null;
    }

    public function publicPath(Page $page): string
    {
        return $this->publicPathFor($page);
    }

    /** @return list<Page> */
    public function publishedNavigation(): array
    {
        return $this->pages
            ->filter(static function (Page $page): bool {
                if ($page->getAttribute('status') !== 'published') {
                    return false;
                }
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

    /** @param array<int, bool> $trail */
    private function publicPathFor(Page $page, array $trail = [], bool $forceParentPath = false): string
    {
        $pageId = (int) $page->getKey();
        $slug = trim((string) $page->getAttribute('slug'), '/');
        if (isset($trail[$pageId])) {
            return $slug;
        }

        $cacheKey = $pageId . ':' . ($forceParentPath ? '1' : '0');
        if (array_key_exists($cacheKey, $this->pathCache)) {
            return $this->pathCache[$cacheKey];
        }

        $settings = $page->getAttribute('settings');
        $useParentSlugs = $forceParentPath || (is_array($settings) && filter_var($settings['use_parent_slugs'] ?? false, FILTER_VALIDATE_BOOL));
        $parentId = $page->getAttribute('parent_id');
        if (!$useParentSlugs || $parentId === null) {
            return $this->pathCache[$cacheKey] = $slug;
        }

        $parent = $this->pagesById[(int) $parentId] ?? null;
        if (!$parent instanceof Page) {
            return $this->pathCache[$cacheKey] = $slug;
        }

        $parentPath = $this->publicPathFor($parent, $trail + [$pageId => true], true);

        return $this->pathCache[$cacheKey] = $parentPath === '' ? $slug : $parentPath . '/' . $slug;
    }
}
