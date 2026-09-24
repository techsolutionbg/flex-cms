<?php

declare(strict_types=1);

namespace Flex\Pages;

use Flex\Extension\V1\EventNames;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extension\V1\PageEvent;
use Flex\Pages\Exception\PageNotFound;
use Flex\Pages\Exception\PageValidationFailed;

final readonly class PageService
{
    private const STATUSES = ['draft', 'published'];

    public function __construct(
        private PageRepository $pages,
        private ExtensionApiInterface $extensionApi,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes, int $authorId): Page
    {
        $data = $this->validate($attributes);
        $data['author_id'] = $authorId;
        $data['published_at'] = $data['status'] === 'published' ? new \DateTimeImmutable() : null;

        $page = $this->pages->create($data);
        $this->extensionApi->dispatch(new PageEvent(EventNames::PAGE_CREATED, $page->toPublicArray()));

        return $page;
    }

    /** @param array<string, mixed> $attributes */
    public function update(int $id, array $attributes): Page
    {
        $page = $this->pages->find($id);
        if ($page === null) {
            throw new PageNotFound(sprintf('Page %d was not found.', $id));
        }

        $data = $this->validate($attributes, $id);
        $wasPublished = $page->getAttribute('status') === 'published';
        $page->fill($data);
        if ($data['status'] === 'published' && !$wasPublished) {
            $page->setAttribute('published_at', new \DateTimeImmutable());
        } elseif ($data['status'] === 'draft') {
            $page->setAttribute('published_at', null);
        }
        $page->saveOrFail();
        $this->extensionApi->dispatch(new PageEvent(EventNames::PAGE_UPDATED, $page->toPublicArray()));

        return $page;
    }

    public function trash(int $id): void
    {
        $page = $this->pages->find($id);
        if ($page === null) {
            throw new PageNotFound(sprintf('Page %d was not found.', $id));
        }
        $page->delete();
        $this->extensionApi->dispatch(new PageEvent(EventNames::PAGE_TRASHED, $page->toPublicArray()));
    }

    public function forceDelete(int $id): void
    {
        $page = $this->pages->find($id, true);
        if ($page === null || $page->deleted_at === null) {
            throw new PageNotFound(sprintf('Trashed page %d was not found.', $id));
        }
        $page->forceDelete();
        $this->extensionApi->dispatch(new PageEvent(EventNames::PAGE_DELETED, $page->toPublicArray()));
    }

    public function restore(int $id): void
    {
        $page = $this->pages->find($id, true);
        if ($page === null || $page->deleted_at === null) {
            throw new PageNotFound(sprintf('Trashed page %d was not found.', $id));
        }
        $page->restore();
        $this->extensionApi->dispatch(new PageEvent(EventNames::PAGE_RESTORED, $page->toPublicArray()));
    }

    /** @param array<string, mixed> $settings */
    public function updateSettings(int $id, array $settings): Page
    {
        $page = $this->pages->find($id);
        if ($page === null) throw new PageNotFound(sprintf('Page %d was not found.', $id));

        $page->setAttribute('settings', [
            'seo_title' => mb_substr(trim((string) ($settings['seo_title'] ?? '')), 0, 190),
            'meta_description' => mb_substr(trim((string) ($settings['meta_description'] ?? '')), 0, 320),
            'canonical_url' => mb_substr(trim((string) ($settings['canonical_url'] ?? '')), 0, 500),
            'template' => in_array($settings['template'] ?? 'default', ['default', 'full_width', 'landing'], true) ? (string) $settings['template'] : 'default',
            'menu_order' => max(0, (int) ($settings['menu_order'] ?? 0)),
            'use_parent_slugs' => filter_var($settings['use_parent_slugs'] ?? false, FILTER_VALIDATE_BOOL),
            'no_index' => filter_var($settings['no_index'] ?? false, FILTER_VALIDATE_BOOL),
            'show_in_navigation' => filter_var($settings['show_in_navigation'] ?? true, FILTER_VALIDATE_BOOL),
            'show_in_sitemap' => filter_var($settings['show_in_sitemap'] ?? true, FILTER_VALIDATE_BOOL),
        ]);
        $page->saveOrFail();
        $this->extensionApi->dispatch(new PageEvent(EventNames::PAGE_UPDATED, $page->toPublicArray()));

        return $page;
    }

    /** @param array<string, mixed> $attributes */
    private function validate(array $attributes, ?int $exceptId = null): array
    {
        $title = trim((string) ($attributes['title'] ?? ''));
        $requestedSlug = trim((string) ($attributes['slug'] ?? ''));
        $slug = $this->slug($requestedSlug !== '' ? $requestedSlug : $title);
        $content = is_string($attributes['content'] ?? null) ? $attributes['content'] : '';
        $blocks = $this->blocks($attributes['blocks'] ?? []);
        $status = is_string($attributes['status'] ?? null) ? $attributes['status'] : 'draft';
        $rawParentId = $attributes['parent_id'] ?? null;
        $parentId = $rawParentId === null || $rawParentId === '' ? null : filter_var($rawParentId, FILTER_VALIDATE_INT);
        $errors = [];

        if ($title === '' || mb_strlen($title) > 190) {
            $errors['title'][] = 'Заглавието е задължително и не може да бъде по-дълго от 190 символа.';
        }
        if ($slug === '' || mb_strlen($slug) > 190) {
            $errors['slug'][] = 'URL адресът е задължителен и не може да бъде по-дълъг от 190 символа.';
        } elseif ($this->pages->slugExists($slug, $exceptId)) {
            $errors['slug'][] = 'Този URL адрес вече се използва.';
        }
        if (!in_array($status, self::STATUSES, true)) {
            $errors['status'][] = 'Изберете валиден статус.';
        }
        if ($parentId !== null && (!is_int($parentId) || $parentId < 1 || $this->pages->find($parentId) === null)) {
            $errors['parent_id'][] = 'Изберете съществуваща родителска страница.';
            $parentId = null;
        } elseif ($parentId !== null && $parentId === $exceptId) {
            $errors['parent_id'][] = 'Страницата не може да бъде свой собствен родител.';
            $parentId = null;
        } elseif ($parentId !== null && $exceptId !== null && $this->isDescendantOf($parentId, $exceptId)) {
            $errors['parent_id'][] = 'Не можете да изберете подчинена страница като родител.';
            $parentId = null;
        }
        if ($errors !== []) {
            throw new PageValidationFailed($errors);
        }

        return ['title' => $title, 'slug' => $slug, 'content' => $content, 'blocks' => $blocks, 'status' => $status, 'parent_id' => $parentId];
    }

    /** @return list<array{type: string, data: array<string, mixed>}> */
    private function blocks(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $blocks = [];
        foreach ($value as $block) {
            if (!is_array($block) || !is_string($block['type'] ?? null) || !is_array($block['data'] ?? null)) {
                continue;
            }
            $type = trim($block['type']);
            if (!in_array($type, ['paragraph', 'heading', 'image', 'button'], true)) {
                continue;
            }
            $blocks[] = ['type' => $type, 'data' => $block['data']];
        }

        return array_values(array_slice($blocks, 0, 100));
    }

    private function isDescendantOf(int $candidateId, int $ancestorId): bool
    {
        $visited = [];
        $current = $candidateId;
        while ($current > 0 && !isset($visited[$current])) {
            $visited[$current] = true;
            $page = $this->pages->find($current);
            if ($page === null) return false;
            $parent = $page->getAttribute('parent_id');
            if ($parent === null) return false;
            if ((int) $parent === $ancestorId) return true;
            $current = (int) $parent;
        }
        return false;
    }

    private function slug(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $value = preg_replace('/[^\p{L}\p{N}]+/u', '-', $value) ?? '';

        return trim($value, '-');
    }
}
