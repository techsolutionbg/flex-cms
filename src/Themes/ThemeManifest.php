<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Themes\Exception\InvalidThemeManifest;

final readonly class ThemeManifest
{
    public function __construct(
        public string $id,
        public string $name,
        public string $version,
        public string $author = '',
        public string $description = '',
        public string $minimumPlatformVersion = '',
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        foreach (['id', 'name', 'version'] as $field) {
            if (!is_string($data[$field] ?? null) || trim($data[$field]) === '') {
                throw new InvalidThemeManifest(sprintf('Полето „%s“ е задължително.', $field));
            }
        }
        $id = trim($data['id']);
        $version = trim($data['version']);
        if (preg_match('/^[a-z0-9][a-z0-9._-]*$/', $id) !== 1) {
            throw new InvalidThemeManifest('ID на темата има невалиден формат.');
        }
        if (preg_match('/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/', $version) !== 1) {
            throw new InvalidThemeManifest('Версията на темата трябва да използва semantic versioning.');
        }
        foreach (['author', 'description', 'minimum_platform_version'] as $field) {
            if (isset($data[$field]) && !is_string($data[$field])) {
                throw new InvalidThemeManifest(sprintf('Полето „%s“ трябва да бъде текст.', $field));
            }
        }
        $minimum = trim((string) ($data['minimum_platform_version'] ?? ''));
        if ($minimum !== '' && preg_match('/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/', $minimum) !== 1) {
            throw new InvalidThemeManifest('Минималната версия на Flex CMS е невалидна.');
        }

        return new self($id, trim($data['name']), $version, trim((string) ($data['author'] ?? '')), trim((string) ($data['description'] ?? '')), $minimum);
    }

    /** @return array<string, string> */
    public function toArray(): array
    {
        return array_filter([
            'id' => $this->id,
            'name' => $this->name,
            'version' => $this->version,
            'author' => $this->author,
            'description' => $this->description,
            'minimum_platform_version' => $this->minimumPlatformVersion,
        ], static fn(string $value): bool => $value !== '');
    }
}
