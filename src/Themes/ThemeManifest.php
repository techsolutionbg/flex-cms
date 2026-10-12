<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Themes\Exception\InvalidThemeManifest;

final readonly class ThemeManifest
{
    /** @var list<string> */
    public const NAVIGATION_GROUPS = ['overview', 'content', 'appearance', 'commerce', 'management', 'system', 'extensions', 'account'];

    /** @var list<string> */
    public const COMMERCE_SECTIONS = ['catalog', 'sales', 'customers', 'settings'];

    /** @var list<string> */
    private const NAVIGATION_ICONS = ['file-text', 'images', 'puzzle', 'shopping-bag', 'settings', 'users', 'palette', 'layout-dashboard', 'layout-grid', 'list-tree', 'folder', 'refresh-cw'];

    /**
     * @param array<string, bool> $supports
     * @param array<string, string> $menuLocations
     * @param list<array{id: string, label: string}> $templates Page templates shown in page settings.
     * @param list<array<string, mixed>> $adminNavigation Sidebar entries declared by the theme.
     * @param list<array{id: string, label: string, singular: string, icon: string, group: string, order: int, public_page: string}> $resources Collections with the same admin screens as pages.
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
        public string $entry = '',
        public array $templates = [],
        public array $adminNavigation = [],
        public array $resources = [],
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
        $entry = $data['entry'] ?? '';
        if (!is_string($entry)) {
            throw new InvalidThemeManifest('Полето entry трябва да бъде текст.');
        }
        $entry = trim($entry);
        if ($entry !== '' && !ThemeRenderPaths::isValidEntryPath($entry)) {
            throw new InvalidThemeManifest('Полето entry трябва да бъде относителен път до .php файл в темата (напр. src/main.php).');
        }
        $templates = self::templates($data['templates'] ?? []);
        $navigation = self::navigationSource($data['admin_navigation'] ?? []);
        $resources = self::resourceDefinitions($data['resources'] ?? []);

        return new self($id, trim($data['name']), $version, trim((string) ($data['author'] ?? '')), trim((string) ($data['description'] ?? '')), $minimum, $supports, $locations, $entry, $templates, $navigation, $resources);
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
            'entry' => $this->entry,
            ...($this->supports !== [] ? ['supports' => $this->supports] : []),
            ...($this->menuLocations !== [] ? ['menu_locations' => $this->menuLocations] : []),
            ...($this->templates !== [] ? ['templates' => $this->templates] : []),
            ...($this->adminNavigation !== [] ? ['admin_navigation' => $this->adminNavigation] : []),
            ...($this->resources !== [] ? ['resources' => $this->resources] : []),
        ], static fn(mixed $value): bool => $value !== '');
    }

    /**
     * Sidebar entries placed on the three admin levels: a new group, an item in a group, or an item in a subsection.
     *
     * @return array{groups: list<array{id: string, label: string, icon: string, order: int}>, sections: list<array{id: string, label: string, icon: string, group: string, order: int}>, items: list<array{id: string, label: string, icon: string, href: string, page: string, group: string, section: string, order: int}>}
     */
    public function placedNavigation(): array
    {
        $groups = [];
        $sections = [];
        $items = [];
        self::placeNavigation($this->adminNavigation, 1, null, null, $groups, $sections, $items);

        return ['groups' => $groups, 'sections' => $sections, 'items' => $items];
    }

    /**
     * @return list<array{id: string, label: string}>
     */
    private static function templates(mixed $templates): array
    {
        if ($templates === []) {
            return [];
        }
        if (!is_array($templates) || !array_is_list($templates)) {
            throw new InvalidThemeManifest('Полето templates трябва да бъде списък.');
        }
        $parsed = [];
        foreach ($templates as $template) {
            $id = is_array($template) ? ($template['id'] ?? null) : null;
            $label = is_array($template) ? ($template['label'] ?? null) : null;
            if (!is_string($id) || preg_match('/^[a-z][a-z0-9_-]*$/', $id) !== 1 || strlen($id) > 40) {
                throw new InvalidThemeManifest('Невалиден идентификатор на шаблон.');
            }
            if (!is_string($label) || trim($label) === '' || mb_strlen(trim($label)) > 80) {
                throw new InvalidThemeManifest('Невалидно име на шаблон.');
            }
            if (isset($parsed[$id])) {
                throw new InvalidThemeManifest('Идентификаторите на шаблоните трябва да са уникални.');
            }
            $parsed[$id] = ['id' => $id, 'label' => trim($label)];
        }

        return array_values($parsed);
    }

    /** @return list<array<string, mixed>> */
    private static function navigationSource(mixed $nodes): array
    {
        if ($nodes === []) {
            return [];
        }
        if (!is_array($nodes) || !array_is_list($nodes)) {
            throw new InvalidThemeManifest('Полето admin_navigation трябва да бъде списък.');
        }
        $ids = [];
        self::navigationNodes($nodes, $ids, 1);
        $groups = [];
        $sections = [];
        $items = [];
        self::placeNavigation($nodes, 1, null, null, $groups, $sections, $items);

        return $nodes;
    }

    /** @param array<string, true> $ids */
    private static function navigationNodes(array $nodes, array &$ids, int $level): void
    {
        if ($level > 3) {
            throw new InvalidThemeManifest('Навигацията на темата е до три нива.');
        }
        foreach ($nodes as $node) {
            if (!is_array($node) || !isset($node['id'], $node['label'])) {
                throw new InvalidThemeManifest('Елементът в навигацията трябва да има id и име.');
            }
            $id = $node['id'];
            $label = $node['label'];
            if (!is_string($id) || preg_match('/^[a-z][a-z0-9_-]*$/', $id) !== 1 || strlen($id) > 40) {
                throw new InvalidThemeManifest('Невалиден идентификатор в навигацията на темата.');
            }
            if (isset($ids[$id])) {
                throw new InvalidThemeManifest('Идентификаторите в навигацията на темата трябва да са уникални.');
            }
            $ids[$id] = true;
            if (count($ids) > 40) {
                throw new InvalidThemeManifest('Навигацията на темата е до 40 елемента.');
            }
            if (!is_string($label) || trim($label) === '' || mb_strlen(trim($label)) > 80) {
                throw new InvalidThemeManifest('Невалидно име в навигацията на темата.');
            }
            if (isset($node['icon']) && (!is_string($node['icon']) || !in_array($node['icon'], self::NAVIGATION_ICONS, true))) {
                throw new InvalidThemeManifest('Невалидна икона в навигацията на темата.');
            }
            if (isset($node['order']) && (!is_int($node['order']) || $node['order'] < 0 || $node['order'] > 1000)) {
                throw new InvalidThemeManifest('Невалидна подредба в навигацията на темата.');
            }
            if (isset($node['href']) && (!is_string($node['href']) || preg_match('#^/(?:pages|media|menus|users|themes|plugins|updates|settings|profile|extension-pages|theme-resources)(?:/[A-Za-z0-9._~%-]+)*$#', $node['href']) !== 1)) {
                throw new InvalidThemeManifest('Адресът в навигацията трябва да е вътрешна страница на админа.');
            }
            if (isset($node['page']) && (!is_string($node['page']) || preg_match('/^[a-z0-9][a-z0-9_-]*$/', $node['page']) !== 1)) {
                throw new InvalidThemeManifest('Страницата в навигацията трябва да е slug.');
            }
            if (isset($node['group']) && (!is_string($node['group']) || !in_array($node['group'], self::NAVIGATION_GROUPS, true))) {
                throw new InvalidThemeManifest('Групата в навигацията е непозната.');
            }
            if (isset($node['section']) && (!is_string($node['section']) || !in_array($node['section'], self::COMMERCE_SECTIONS, true))) {
                throw new InvalidThemeManifest('Секцията в навигацията е непозната.');
            }
            $children = $node['children'] ?? [];
            if (!is_array($children) || !array_is_list($children)) {
                throw new InvalidThemeManifest('Поделементите в навигацията трябва да са списък.');
            }
            if ($children !== []) {
                self::navigationNodes($children, $ids, $level + 1);
            }
        }
    }

    /**
     * @param list<array<string, mixed>> $nodes
     * @param list<array{id: string, label: string, icon: string, order: int}> $groups
     * @param list<array{id: string, label: string, icon: string, group: string, order: int}> $sections
     * @param list<array{id: string, label: string, icon: string, href: string, page: string, group: string, section: string, order: int}> $items
     */
    private static function placeNavigation(array $nodes, int $level, ?string $group, ?string $section, array &$groups, array &$sections, array &$items): void
    {
        foreach ($nodes as $node) {
            $id = (string) $node['id'];
            $label = trim((string) $node['label']);
            $icon = is_string($node['icon'] ?? null) ? $node['icon'] : ($level === 1 && !isset($node['group']) ? 'layout-grid' : 'file-text');
            $order = is_int($node['order'] ?? null) ? $node['order'] : 50;
            $href = is_string($node['href'] ?? null) ? $node['href'] : '';
            $page = is_string($node['page'] ?? null) ? $node['page'] : '';
            $children = is_array($node['children'] ?? null) ? $node['children'] : [];
            $hasLink = $href !== '' || $page !== '';
            if ($level === 1 && !isset($node['group']) && !isset($node['section'])) {
                $groups[] = ['id' => $id, 'label' => $label, 'icon' => $icon, 'order' => $order];
                if ($children === []) {
                    if (!$hasLink) {
                        throw new InvalidThemeManifest('Елементът „' . $label . '“ трябва да има адрес или поделементи.');
                    }
                    $items[] = ['id' => $id, 'label' => $label, 'icon' => $icon, 'href' => $href, 'page' => $page, 'group' => $id, 'section' => '', 'order' => 10];
                } else {
                    if ($hasLink) {
                        throw new InvalidThemeManifest('Групата „' . $label . '“ не може да има и адрес, и поделементи.');
                    }
                    self::placeNavigation($children, 2, $id, null, $groups, $sections, $items);
                }
                continue;
            }
            $targetGroup = is_string($node['group'] ?? null) ? $node['group'] : $group;
            if ($targetGroup === null || (!in_array($targetGroup, self::NAVIGATION_GROUPS, true) && !in_array($targetGroup, array_column($groups, 'id'), true))) {
                throw new InvalidThemeManifest('Елементът „' . $label . '“ няма група.');
            }
            $targetSection = is_string($node['section'] ?? null) ? $node['section'] : (string) $section;
            if ($children !== []) {
                if ($level >= 3 || $targetSection !== '') {
                    throw new InvalidThemeManifest('„' . $label . '“ е на трето ниво и не може да има свои елементи.');
                }
                if ($hasLink) {
                    throw new InvalidThemeManifest('Секцията „' . $label . '“ не може да има и адрес, и поделементи.');
                }
                $sections[] = ['id' => $id, 'label' => $label, 'icon' => $icon, 'group' => $targetGroup, 'order' => $order];
                self::placeNavigation($children, 3, $targetGroup, $id, $groups, $sections, $items);
                continue;
            }
            if ($targetSection !== '' && !in_array($targetSection, self::COMMERCE_SECTIONS, true) && !in_array($targetSection, array_column($sections, 'id'), true)) {
                throw new InvalidThemeManifest('Секцията на „' . $label . '“ не съществува.');
            }
            if ($targetSection !== '' && in_array($targetSection, self::COMMERCE_SECTIONS, true) && $targetGroup !== 'commerce') {
                throw new InvalidThemeManifest('Секцията „' . $targetSection . '“ е само в групата Магазин.');
            }
            if (!$hasLink) {
                throw new InvalidThemeManifest('Елементът „' . $label . '“ трябва да има адрес.');
            }
            $items[] = ['id' => $id, 'label' => $label, 'icon' => $icon, 'href' => $href, 'page' => $page, 'group' => $targetGroup, 'section' => $targetSection, 'order' => $order];
        }
    }

    /**
     * @return list<array{id: string, label: string, singular: string, icon: string, group: string, order: int, public_page: string}>
     */
    private static function resourceDefinitions(mixed $resources): array
    {
        if ($resources === []) {
            return [];
        }
        if (!is_array($resources) || !array_is_list($resources)) {
            throw new InvalidThemeManifest('Полето resources трябва да бъде списък.');
        }
        $parsed = [];
        foreach ($resources as $resource) {
            if (!is_array($resource)) {
                throw new InvalidThemeManifest('Колекцията на темата трябва да бъде обект.');
            }
            $id = $resource['id'] ?? null;
            $label = $resource['label'] ?? null;
            if (!is_string($id) || preg_match('/^[a-z][a-z0-9_-]*$/', $id) !== 1 || strlen($id) > 40) {
                throw new InvalidThemeManifest('Невалиден идентификатор на колекция.');
            }
            if (isset($parsed[$id])) {
                throw new InvalidThemeManifest('Идентификаторите на колекциите трябва да са уникални.');
            }
            if (!is_string($label) || trim($label) === '' || mb_strlen(trim($label)) > 80) {
                throw new InvalidThemeManifest('Невалидно име на колекция.');
            }
            $singular = $resource['singular'] ?? $label;
            if (!is_string($singular) || trim($singular) === '' || mb_strlen(trim($singular)) > 80) {
                throw new InvalidThemeManifest('Невалидно единствено име на колекция.');
            }
            $icon = $resource['icon'] ?? 'folder';
            if (!is_string($icon) || !in_array($icon, self::NAVIGATION_ICONS, true)) {
                throw new InvalidThemeManifest('Невалидна икона на колекция.');
            }
            $group = $resource['group'] ?? 'content';
            if (!is_string($group) || !in_array($group, self::NAVIGATION_GROUPS, true)) {
                throw new InvalidThemeManifest('Групата на колекцията е непозната.');
            }
            $order = $resource['order'] ?? 30;
            if (!is_int($order) || $order < 0 || $order > 1000) {
                throw new InvalidThemeManifest('Невалидна подредба на колекция.');
            }
            $page = $resource['public_page'] ?? $id;
            if (!is_string($page) || preg_match('/^[a-z0-9][a-z0-9_-]*$/', $page) !== 1 || strlen($page) > 190) {
                throw new InvalidThemeManifest('Публичната страница на колекцията трябва да е slug.');
            }
            $parsed[$id] = [
                'id' => $id,
                'label' => trim($label),
                'singular' => trim($singular),
                'icon' => $icon,
                'group' => $group,
                'order' => $order,
                'public_page' => $page,
            ];
        }
        if (count($parsed) > 20) {
            throw new InvalidThemeManifest('Темата може да обяви до 20 колекции.');
        }

        return array_values($parsed);
    }
}
