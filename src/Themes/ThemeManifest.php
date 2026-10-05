<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Themes\Exception\InvalidThemeManifest;

final readonly class ThemeManifest
{
    /** @param array<string, bool> $supports
     * @param array<string, string> $menuLocations
     */
    public function __construct(
        public string $id,
        public string $name,
        public string $version,
        public string $author = '',
        public string $description = '',
        public string $minimumPlatformVersion = '',
        public array $supports = [],
        public array $menuLocations = [],
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
        if (strlen($id) > 190 || preg_match('/^[a-z0-9][a-z0-9._-]*$/', $id) !== 1) {
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

        $supports = $data['supports'] ?? [];
        if (!is_array($supports)) {
            throw new InvalidThemeManifest('Полето supports трябва да бъде обект или списък.');
        }
        if (array_is_list($supports)) {
            foreach ($supports as $feature) {
                if (!is_string($feature)) {
                    throw new InvalidThemeManifest('Невалидна възможност на тема.');
                }
            }
            $supports = array_fill_keys($supports, true);
        }
        foreach ($supports as $feature => $enabled) {
            if (!is_string($feature) || preg_match('/^[a-z][a-z0-9_-]*$/', $feature) !== 1 || !is_bool($enabled)) {
                throw new InvalidThemeManifest('Възможностите в supports трябва да имат булеви стойности.');
            }
        }
        $locations = $data['menu_locations'] ?? [];
        if (!is_array($locations)) {
            throw new InvalidThemeManifest('Полето menu_locations трябва да бъде обект.');
        }
        foreach ($locations as $location => $label) {
            if (!is_string($location) || strlen($location) > 120 || preg_match('/^[a-z][a-z0-9_-]*$/', $location) !== 1 || !is_string($label) || trim($label) === '' || mb_strlen($label) > 120) {
                throw new InvalidThemeManifest('Невалидно място за меню.');
            }
            $locations[$location] = trim($label);
        }
        return new self($id, trim($data['name']), $version, trim((string) ($data['author'] ?? '')), trim((string) ($data['description'] ?? '')), $minimum, $supports, $locations);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return array_filter([
            'id' => $this->id,
            'name' => $this->name,
            'version' => $this->version,
            'author' => $this->author,
            'description' => $this->description,
            'minimum_platform_version' => $this->minimumPlatformVersion,
            ...($this->supports !== [] ? ['supports' => $this->supports] : []),
            ...($this->menuLocations !== [] ? ['menu_locations' => $this->menuLocations] : []),
        ], static fn(mixed $value): bool => $value !== '');
    }
}
