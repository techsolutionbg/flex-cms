<?php

declare(strict_types=1);

namespace Flex\Pages;

use Flex\Pages\Exception\PageNotFound;
use Flex\Pages\Exception\PageValidationFailed;

final readonly class PageService
{
    private const STATUSES = ['draft', 'published'];

    public function __construct(private PageRepository $pages) {}

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes, int $authorId): Page
    {
        $data = $this->validate($attributes);
        $data['author_id'] = $authorId;
        $data['published_at'] = $data['status'] === 'published' ? new \DateTimeImmutable() : null;

        return $this->pages->create($data);
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

        return $page;
    }

    /** @param array<string, mixed> $attributes */
    private function validate(array $attributes, ?int $exceptId = null): array
    {
        $title = trim((string) ($attributes['title'] ?? ''));
        $slug = $this->slug($title);
        $content = is_string($attributes['content'] ?? null) ? $attributes['content'] : '';
        $status = is_string($attributes['status'] ?? null) ? $attributes['status'] : 'draft';
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
        if ($errors !== []) {
            throw new PageValidationFailed($errors);
        }

        return compact('title', 'slug', 'content', 'status');
    }

    private function slug(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $value = preg_replace('/[^\p{L}\p{N}]+/u', '-', $value) ?? '';

        return trim($value, '-');
    }
}
