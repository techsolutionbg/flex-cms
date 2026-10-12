<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Media\PublicMediaApi;
use Flex\Themes\Exception\ThemeResourceException;
use Illuminate\Database\UniqueConstraintViolationException;

final readonly class ThemeResourceService
{
    private const STATUSES = ['draft', 'published'];

    public function __construct(
        private ThemeResourceRepository $records,
        private ThemeManager $themes,
        private PublicMediaApi $media,
    ) {}

    /** @return list<array<string, mixed>> */
    public function list(string $resource, string $view): array
    {
        $theme = $this->activeTheme();
        $this->definition($theme, $resource);
        if (!in_array($view, ['active', 'trash'], true)) {
            throw new ThemeResourceException('Невалиден изглед.', 422);
        }

        return $this->records->all($theme, $resource, $view === 'trash')
            ->map(static fn(ThemeRecord $record): array => $record->toPublicArray())
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(string $resource, int $id): array
    {
        return $this->present($this->require($resource, $id), true);
    }

    /** @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    public function create(string $resource, array $attributes): array
    {
        $theme = $this->activeTheme();
        $this->definition($theme, $resource);
        $data = $this->validate($theme, $resource, $attributes);
        $data['theme_id'] = $theme;
        $data['resource'] = $resource;
        $data['published_at'] = $data['status'] === 'published' ? new \DateTimeImmutable('now', new \DateTimeZone('UTC')) : null;

        try {
            $record = $this->records->create($data);
        } catch (UniqueConstraintViolationException) {
            throw new ThemeResourceException('Този URL адрес вече се използва.', 422, ['slug' => ['Този URL адрес вече се използва.']]);
        }

        return $this->present($record, true);
    }

    /** @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    public function update(string $resource, int $id, array $attributes): array
    {
        $record = $this->require($resource, $id);
        $theme = (string) $record->getAttribute('theme_id');
        $data = $this->validate($theme, $resource, $attributes, $id);
        $wasPublished = $record->getAttribute('status') === 'published';
        $record->fill($data);
        if ($data['status'] === 'published' && !$wasPublished) {
            $record->setAttribute('published_at', new \DateTimeImmutable('now', new \DateTimeZone('UTC')));
        } elseif ($data['status'] === 'draft') {
            $record->setAttribute('published_at', null);
        }
        try {
            $record->saveOrFail();
        } catch (UniqueConstraintViolationException) {
            throw new ThemeResourceException('Този URL адрес вече се използва.', 422, ['slug' => ['Този URL адрес вече се използва.']]);
        }

        return $this->present($record, true);
    }

    /** @return array<string, mixed> */
    public function setStatus(string $resource, int $id, string $status): array
    {
        $record = $this->require($resource, $id);
        if (!in_array($status, self::STATUSES, true)) {
            throw new ThemeResourceException('Изберете валиден статус.', 422, ['status' => ['Изберете валиден статус.']]);
        }
        $wasPublished = $record->getAttribute('status') === 'published';
        $record->setAttribute('status', $status);
        if ($status === 'published' && !$wasPublished) {
            $record->setAttribute('published_at', new \DateTimeImmutable('now', new \DateTimeZone('UTC')));
        } elseif ($status === 'draft') {
            $record->setAttribute('published_at', null);
        }
        $record->saveOrFail();

        return $this->present($record, true);
    }

    public function trash(string $resource, int $id): void
    {
        $this->require($resource, $id)->delete();
    }

    public function restore(string $resource, int $id): void
    {
        $record = $this->require($resource, $id, true);
        if ($record->getAttribute('deleted_at') === null) {
            throw new ThemeResourceException('Записът не е в кошчето.', 404);
        }
        $record->restore();
    }

    public function forceDelete(string $resource, int $id): void
    {
        $record = $this->require($resource, $id, true);
        if ($record->getAttribute('deleted_at') === null) {
            throw new ThemeResourceException('Окончателно се трие само запис от кошчето.', 404);
        }
        $record->forceDelete();
    }

    /** @return list<array<string, mixed>> */
    public function published(string $resource): array
    {
        $theme = $this->themes->activeTheme();
        if ($theme === '' || $this->findDefinition($theme, $resource) === null) {
            return [];
        }

        return $this->records->published($theme, $resource)
            ->map(fn(ThemeRecord $record): array => $this->present($record, true))
            ->all();
    }

    private function require(string $resource, int $id, bool $withTrashed = false): ThemeRecord
    {
        $theme = $this->activeTheme();
        $this->definition($theme, $resource);
        $record = $this->records->find($theme, $resource, $id, $withTrashed);
        if ($record === null) {
            throw new ThemeResourceException('Записът не е намерен.', 404);
        }

        return $record;
    }

    private function activeTheme(): string
    {
        $theme = $this->themes->activeTheme();
        if ($theme === '') {
            throw new ThemeResourceException('Няма активна тема.', 404);
        }

        return $theme;
    }

    /** @return array{id: string, label: string, singular: string, icon: string, group: string, order: int, public_page: string} */
    private function definition(string $theme, string $resource): array
    {
        $definition = $this->findDefinition($theme, $resource);
        if ($definition === null) {
            throw new ThemeResourceException('Темата не обявява тази колекция.', 404);
        }

        return $definition;
    }

    /** @return array{id: string, label: string, singular: string, icon: string, group: string, order: int, public_page: string}|null */
    private function findDefinition(string $theme, string $resource): ?array
    {
        foreach ($this->themes->capabilitiesForTheme($theme)['resources'] ?? [] as $definition) {
            if (is_array($definition) && ($definition['id'] ?? null) === $resource) {
                return $definition;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $attributes
     * @return array{title: string, slug: string, summary: string, content: string, status: string, featured_media_id: int|null}
     */
    private function validate(string $theme, string $resource, array $attributes, ?int $exceptId = null): array
    {
        $errors = [];
        $title = trim((string) ($attributes['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 190) {
            $errors['title'] = ['Заглавието е задължително и е до 190 знака.'];
        }
        $requestedSlug = trim((string) ($attributes['slug'] ?? ''));
        $slug = $this->slug($requestedSlug !== '' ? $requestedSlug : $title);
        if ($slug === '' || strlen($slug) > 190) {
            $errors['slug'] = ['URL адресът е задължителен и е до 190 знака.'];
        } elseif ($this->records->slugExists($theme, $resource, $slug, $exceptId)) {
            $errors['slug'] = ['Този URL адрес вече се използва.'];
        }
        $summary = trim((string) ($attributes['summary'] ?? ''));
        if (mb_strlen($summary) > 1000) {
            $errors['summary'] = ['Краткото описание е до 1000 знака.'];
        }
        $content = trim((string) ($attributes['content'] ?? ''));
        if (mb_strlen($content) > 100000) {
            $errors['content'] = ['Съдържанието е твърде дълго.'];
        }
        $status = (string) ($attributes['status'] ?? 'draft');
        if (!in_array($status, self::STATUSES, true)) {
            $errors['status'] = ['Изберете валиден статус.'];
        }
        $mediaId = $attributes['featured_media_id'] ?? null;
        if ($mediaId === '' || $mediaId === 0 || $mediaId === '0') {
            $mediaId = null;
        }
        if ($mediaId !== null && filter_var($mediaId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
            $errors['featured_media_id'] = ['Изберете изображение от медийната библиотека.'];
            $mediaId = null;
        }
        if (is_numeric($mediaId) && (int) $mediaId > 0 && $this->media->get((int) $mediaId) === []) {
            $errors['featured_media_id'] = ['Изображението не е намерено.'];
        }
        if ($errors !== []) {
            throw new ThemeResourceException(implode(' ', array_merge(...array_values($errors))), 422, $errors);
        }

        return [
            'title' => $title,
            'slug' => $slug,
            'summary' => $summary,
            'content' => $content,
            'status' => $status,
            'featured_media_id' => $mediaId === null ? null : (int) $mediaId,
        ];
    }

    /** @return array<string, mixed> */
    private function present(ThemeRecord $record, bool $withMedia): array
    {
        $media = null;
        if ($withMedia) {
            $mediaId = $record->getAttribute('featured_media_id');
            $media = is_int($mediaId) || (is_numeric($mediaId) && (int) $mediaId > 0)
                ? $this->media->get((int) $mediaId)
                : [];
        }

        return $record->toPublicArray($media);
    }

    private function slug(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $value = preg_replace('/[^\p{L}\p{N}]+/u', '-', $value) ?? '';

        return trim($value, '-');
    }
}
