<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\AdminExtensionRegistrarInterface;
use Flex\Extensions\Exception\PluginPermissionDenied;
use Flex\Http\AssetVersion;

final class AdminExtensionRegistry
{
    /** @var array<string, array{id: string, label: string, href: string, priority: int}> */
    private array $sidebarItems = [];

    /** @var array<string, array{id: string, plugin: string, label: string, href: string, module: string, embeddable: bool}> */
    private array $pages = [];

    /** @var array<string, list<array{kind: string, title: string, text: string, href: string|null, priority: int}>> */
    private array $slots = [];

    /** @var array<string, array{id: string, plugin: string, location: string, label: string, module: string, export: string, icon: string, default_open: bool, order: int}> */
    private array $panels = [];

    /** Platform screens that render extension panels. The commerce locations are rendered by Flex Commerce. */
    public const PANEL_LOCATIONS = ['page.editor', 'page.settings', 'page.theme-content', 'pages.list.column', 'settings.tab', 'theme.settings', 'commerce.product.editor', 'commerce.category.editor'];

    /** The extension point and slot each panel location stands for; panel() is shorthand for extend(). */
    private const PANEL_TARGETS = [
        'page.editor' => ['page.editor', 'screen.section'],
        'page.settings' => ['page.settings', 'screen.section'],
        'page.theme-content' => ['page.theme-content', 'screen.section'],
        'pages.list.column' => ['pages.list', 'table.column'],
        'settings.tab' => ['settings', 'screen.tab'],
        'theme.settings' => ['theme.settings', 'screen.section'],
        'commerce.product.editor' => ['commerce.product.editor', 'screen.section'],
        'commerce.category.editor' => ['commerce.category.editor', 'screen.section'],
    ];

    /** Slots of extension points and the module export each one uses by default. */
    public const EXTENSION_SLOTS = [
        'section.start' => 'createPanel',
        'section.end' => 'createPanel',
        'section.nested' => 'createPanel',
        'screen.section' => 'createPanel',
        'screen.tab' => 'createPanel',
        'table.column' => 'createColumn',
        'table.row-action' => 'createRowAction',
        'table.bulk-action' => 'createBulkAction',
        'table.toolbar' => 'createToolbar',
    ];

    /** Icon names the admin can show for pages, panels and extensions. */
    private const ICONS = ['puzzle', 'images', 'shopping-bag', 'file-text', 'settings', 'users', 'palette', 'search', 'key', 'share', 'sliders', 'list-checks'];

    /** @var array<string, array{id: string, plugin: string, point: string, slot: string, label: string, module: string, export: string, icon: string, default_open: bool, order: int}> */
    private array $extensions = [];

    /** @var array<string, string> Module URL (without version) => file, versioned only when the admin asks for the list. */
    private array $moduleFiles = [];

    /** @var array<string, string> Active plugin ID => plugin root directory. */
    private array $pluginPaths = [];

    /** @var list<string> */
    private const SLOTS = [
        'admin.dashboard.before', 'admin.dashboard.after',
        'admin.pages.before', 'admin.pages.after',
        'admin.pages.table.before', 'admin.pages.table.after',
        'admin.page.form.before', 'admin.page.form.after',
        'admin.profile.before', 'admin.profile.after',
        'admin.updates.before', 'admin.updates.after',
        'admin.plugins.before', 'admin.plugins.after',
    ];

    /** @param list<string> $permissions */
    public function registrar(string $pluginId, array $permissions, ?string $pluginPath = null): AdminExtensionRegistrarInterface
    {
        if ($pluginPath !== null && is_dir($pluginPath)) {
            $this->pluginPaths[$pluginId] = $pluginPath;
        }
        $addSidebarItem = function (string $id, string $label, string $href, int $priority): void {
            $this->addSidebarItem($id, $label, $href, $priority);
        };
        $addSlot = function (string $name, string $kind, string $title, string $text, ?string $href, int $priority): void {
            $this->addSlot($name, $kind, $title, $text, $href, $priority);
        };

        return new class($permissions, $addSidebarItem, $addSlot, $this, $pluginId, $pluginPath) implements AdminExtensionRegistrarInterface {
            /** @param list<string> $permissions */
            public function __construct(private array $permissions, private \Closure $addSidebarItem, private \Closure $addSlot, private AdminExtensionRegistry $registry, private string $pluginId, private ?string $pluginPath) {}

            public function page(string $id, string $label, string $module, bool $embeddable = false, array $navigation = []): void
            {
                $this->assertPermission();
                $this->registry->addPage($this->pluginId, $id, $label, $module, $embeddable, $navigation, $this->pluginPath);
            }

            public function panel(string $location, string $id, string $label, string $module, array $options = []): void
            {
                $this->assertPermission();
                $this->registry->addPanel($this->pluginId, $location, $id, $label, $module, $options, $this->pluginPath);
            }

            public function extend(string $point, string $slot, string $id, string $module, array $options = []): void
            {
                $this->assertPermission();
                $this->registry->addExtension($this->pluginId, $point, $slot, $id, $module, $options, $this->pluginPath);
            }

            public function sidebarItem(string $id, string $label, string $href, int $priority = 50): void
            {
                $this->assertPermission();
                ($this->addSidebarItem)($id, $label, $href, $priority);
            }

            public function slot(string $name, string $kind, string $title, string $text = '', ?string $href = null, int $priority = 50): void
            {
                $this->assertPermission();
                ($this->addSlot)($name, $kind, $title, $text, $href, $priority);
            }

            private function assertPermission(): void
            {
                if (!PluginPermissions::allows($this->permissions, PluginPermissions::ADMIN_UI)) {
                    throw new PluginPermissionDenied(sprintf('The plugin requires the "%s" permission to extend the admin UI.', PluginPermissions::ADMIN_UI));
                }
            }
        };
    }

    /** @return array{sidebar: list<array{id: string, label: string, href: string}>, slots: array<string, list<array{kind: string, title: string, text: string, href: string|null}>>, pages: list<array{id: string, plugin: string, label: string, href: string, module: string, embeddable: bool}>, panels: list<array<string, mixed>>, extensions: list<array<string, mixed>>, translations: array<string, array<string, array<string, string>>>} */
    public function bootstrap(): array
    {
        $sidebar = array_values($this->sidebarItems);
        usort($sidebar, static fn(array $left, array $right): int => $left['priority'] <=> $right['priority']);
        $sidebar = array_map(static fn(array $item): array => ['id' => $item['id'], 'label' => $item['label'], 'href' => $item['href']], $sidebar);

        $slots = [];
        foreach ($this->slots as $name => $items) {
            usort($items, static fn(array $left, array $right): int => $left['priority'] <=> $right['priority']);
            $slots[$name] = array_map(static fn(array $item): array => [
                'kind' => $item['kind'], 'title' => $item['title'], 'text' => $item['text'], 'href' => $item['href'],
            ], $items);
        }

        $byOrder = static fn(array $left, array $right): int => [$left['order'], $left['id']] <=> [$right['order'], $right['id']];
        $panels = array_values($this->panels);
        usort($panels, $byOrder);
        $extensions = array_values($this->extensions);
        usort($extensions, $byOrder);

        // Each module and its imports are versioned once per call, however many entries use it.
        $versions = [];
        $versioned = function (array $item) use (&$versions): array {
            $item['module'] = $this->versioned($item['module'], $versions);

            return $item;
        };

        return [
            'sidebar' => $sidebar,
            'slots' => $slots,
            'pages' => array_map($versioned, array_values($this->pages)),
            'panels' => array_map($versioned, $panels),
            'extensions' => array_map($versioned, $extensions),
            'translations' => $this->pluginTranslations(),
        ];
    }

    /** @return array<string, array<string, array<string, string>>> */
    private function pluginTranslations(): array
    {
        $translations = [];
        $totalBytes = 0;
        foreach ($this->pluginPaths as $pluginId => $pluginPath) {
            $localeDirectory = $pluginPath . DIRECTORY_SEPARATOR . 'locales';
            $realPluginPath = realpath($pluginPath);
            $realLocaleDirectory = realpath($localeDirectory);
            if ($realPluginPath === false || $realLocaleDirectory === false ||
                !str_starts_with($realLocaleDirectory, rtrim($realPluginPath, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)) {
                continue;
            }

            foreach (glob($realLocaleDirectory . DIRECTORY_SEPARATOR . '*.json') ?: [] as $file) {
                $locale = basename($file, '.json');
                if (!preg_match('/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/D', $locale) || is_link($file)) {
                    continue;
                }
                $realFile = realpath($file);
                if ($realFile === false || !str_starts_with($realFile, $realLocaleDirectory . DIRECTORY_SEPARATOR)) {
                    continue;
                }
                $size = filesize($realFile);
                if ($size === false || $size > 262144 || $totalBytes + $size > 2097152) {
                    continue;
                }
                $json = file_get_contents($realFile);
                if ($json === false) {
                    continue;
                }
                try {
                    $catalog = json_decode($json, true, 32, JSON_THROW_ON_ERROR);
                } catch (\JsonException) {
                    continue;
                }
                if (!is_array($catalog) || array_is_list($catalog)) {
                    continue;
                }
                $validCatalog = [];
                foreach ($catalog as $source => $translation) {
                    if (is_string($source) && $source !== '' && is_string($translation)) {
                        $validCatalog[$source] = $translation;
                    }
                }
                $translations[$pluginId][$locale] = $validCatalog;
                $totalBytes += $size;
            }
        }

        return $translations;
    }

    public function addPage(string $pluginId, string $id, string $label, string $module, bool $embeddable, array $navigation = [], ?string $pluginPath = null): void
    {
        if (!preg_match('/^[a-z][a-z0-9_-]*$/D', $id) || trim($label) === '' ||
            !preg_match('/^[a-zA-Z0-9_\/.\-]+\.js$/D', $module) || str_contains($module, '..') || str_starts_with($module, '/')) {
            throw new \InvalidArgumentException('Invalid admin page ID, label or module path.');
        }
        $group = $navigation['group'] ?? 'extensions';
        $icon = $navigation['icon'] ?? 'puzzle';
        if (!in_array($group, ['content', 'appearance', 'management', 'system', 'account', 'commerce', 'extensions'], true) ||
            !in_array($icon, ['puzzle', 'images', 'shopping-bag', 'file-text', 'settings', 'users', 'palette'], true)) {
            throw new \InvalidArgumentException('Invalid admin navigation group or icon.');
        }
        $section = $navigation['section'] ?? null;
        if ($section !== null && (!is_string($section) || !in_array($section, ['catalog', 'sales', 'customers', 'settings'], true))) {
            throw new \InvalidArgumentException('Invalid admin navigation section.');
        }
        $order = $navigation['order'] ?? 0;
        if (!is_int($order) || $order < 0) {
            throw new \InvalidArgumentException('Invalid admin navigation order.');
        }
        $hidden = $navigation['hidden'] ?? false;
        if (!is_bool($hidden)) {
            throw new \InvalidArgumentException('Invalid admin navigation visibility.');
        }
        $placement = ['group' => $group, 'icon' => $icon];
        if (is_string($section)) {
            $placement['section'] = $section;
            $placement['order'] = $order;
        }
        $key = str_replace('/', '-', $pluginId) . '-' . $id;
        $href = '/extension-pages/' . $key;
        $this->rememberModule($pluginId, $module, $pluginPath);
        $this->pages[$key] = ['id' => $key, 'plugin' => $pluginId, 'label' => trim($label), 'href' => $href,
            'module' => $this->moduleUrl($pluginId, $module), 'embeddable' => $embeddable, 'navigation' => $placement];
        if ($hidden) {
            // Opened only by its address, for example from a row action; not listed in the sidebar.
            $this->pages[$key]['navigation']['hidden'] = true;
        } else {
            $this->addSidebarItem($key, trim($label), $href, 50);
        }
    }

    /** @param array{order?: mixed, icon?: mixed, default_open?: mixed, export?: mixed} $options */
    public function addPanel(string $pluginId, string $location, string $id, string $label, string $module, array $options = [], ?string $pluginPath = null): void
    {
        if (!in_array($location, self::PANEL_LOCATIONS, true)) {
            throw new \InvalidArgumentException(sprintf('Unknown admin panel location "%s".', $location));
        }
        if (!preg_match('/^[a-z][a-z0-9_-]*$/D', $id) || trim($label) === '' ||
            !preg_match('/^[a-zA-Z0-9_\/.\-]+\.js$/D', $module) || str_contains($module, '..') || str_starts_with($module, '/')) {
            throw new \InvalidArgumentException('Invalid admin panel ID, label or module path.');
        }
        [$point, $slot] = self::PANEL_TARGETS[$location];
        $extension = $this->addExtension($pluginId, $point, $slot, $id, $module, ['label' => $label] + $options, $pluginPath);
        // The panels list is kept for clients that read it; new clients use extensions.
        $this->panels[$location . ':' . $extension['id']] = [
            'id' => $extension['id'],
            'plugin' => $pluginId,
            'location' => $location,
            'label' => $extension['label'],
            'module' => $extension['module'],
            'export' => $extension['export'],
            'icon' => $extension['icon'],
            'default_open' => $extension['default_open'],
            'order' => $extension['order'],
        ];
    }

    private function rememberModule(string $pluginId, string $module, ?string $pluginPath): void
    {
        if ($pluginPath !== null) {
            $this->moduleFiles[$this->moduleUrl($pluginId, $module)] = $pluginPath . '/' . $module;
        }
    }

    private function moduleUrl(string $pluginId, string $module): string
    {
        return '/extensions/' . implode('/', array_map('rawurlencode', explode('/', $pluginId))) . '/assets/' . $module;
    }

    /**
     * The module URL with a version from its contents and imports, so browsers load changed modules. Hashing is left to
     * this point: plugins register on every request, public ones included, but only the admin needs the list.
     * @param array<string, string> $versions File => "?v=…", shared by the modules of one bootstrap() call.
     */
    private function versioned(string $url, array &$versions): string
    {
        $file = $this->moduleFiles[$url] ?? null;
        if ($file === null) {
            return $url;
        }
        if (!isset($versions[$file])) {
            $hash = @hash_file('sha256', $file);
            $moduleVersion = AssetVersion::ofModule($file);
            $versions[$file] = $hash === false || $moduleVersion === null
                ? ''
                : '?v=' . substr(hash('sha256', $hash . ':' . $moduleVersion), 0, 16);
        }

        return $url . $versions[$file];
    }

    /**
     * @param array{label?: mixed, order?: mixed, icon?: mixed, default_open?: mixed, export?: mixed} $options
     * @return array{id: string, plugin: string, point: string, slot: string, label: string, module: string, export: string, icon: string, default_open: bool, order: int}
     */
    public function addExtension(string $pluginId, string $point, string $slot, string $id, string $module, array $options = [], ?string $pluginPath = null): array
    {
        if (preg_match('/^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*$/D', $point) !== 1 || strlen($point) > 120) {
            throw new \InvalidArgumentException(sprintf('Invalid admin extension point "%s".', $point));
        }
        if (!array_key_exists($slot, self::EXTENSION_SLOTS)) {
            throw new \InvalidArgumentException(sprintf('Unknown admin extension slot "%s".', $slot));
        }
        if (!preg_match('/^[a-z][a-z0-9_-]*$/D', $id) ||
            !preg_match('/^[a-zA-Z0-9_\/.\-]+\.js$/D', $module) || str_contains($module, '..') || str_starts_with($module, '/')) {
            throw new \InvalidArgumentException('Invalid admin extension ID or module path.');
        }
        $label = $options['label'] ?? '';
        $order = $options['order'] ?? 50;
        $icon = $options['icon'] ?? 'puzzle';
        $export = $options['export'] ?? self::EXTENSION_SLOTS[$slot];
        $defaultOpen = $options['default_open'] ?? true;
        // Sections, screens and tabs are shown with their label; columns and actions may provide their own.
        $needsLabel = in_array($slot, ['section.nested', 'screen.section', 'screen.tab'], true);
        if (!is_string($label) || ($needsLabel && trim($label) === '') || !is_int($order) || $order < 0 || !is_bool($defaultOpen) ||
            !in_array($icon, self::ICONS, true) ||
            !is_string($export) || !preg_match('/^[A-Za-z_$][A-Za-z0-9_$]*$/D', $export)) {
            throw new \InvalidArgumentException('Invalid admin extension label or options.');
        }
        $key = str_replace('/', '-', $pluginId) . '-' . $id;
        $this->rememberModule($pluginId, $module, $pluginPath);
        $extension = [
            'id' => $key,
            'plugin' => $pluginId,
            'point' => $point,
            'slot' => $slot,
            'label' => trim($label),
            'module' => $this->moduleUrl($pluginId, $module),
            'export' => $export,
            'icon' => $icon,
            'default_open' => $defaultOpen,
            'order' => $order,
        ];
        $this->extensions[$point . ':' . $slot . ':' . $key] = $extension;

        return $extension;
    }

    private function addSidebarItem(string $id, string $label, string $href, int $priority): void
    {
        $id = trim($id);
        $label = trim($label);
        if ($id === '' || $label === '' || !preg_match('/^[a-z][a-z0-9._-]*$/', $id)) {
            throw new \InvalidArgumentException('Admin sidebar item IDs must use lowercase letters, numbers, dots, hyphens or underscores.');
        }
        if (!str_starts_with($href, '/') || str_contains($href, '://') || str_contains($href, '..')) {
            throw new \InvalidArgumentException('Admin extension links must be local paths without traversal.');
        }
        $this->sidebarItems[$id] = ['id' => $id, 'label' => $label, 'href' => $href, 'priority' => $priority];
    }

    private function addSlot(string $name, string $kind, string $title, string $text, ?string $href, int $priority): void
    {
        if (!in_array($name, self::SLOTS, true)) {
            throw new \InvalidArgumentException(sprintf('Unknown admin extension slot "%s".', $name));
        }
        if (!in_array($kind, ['notice', 'card', 'link'], true) || trim($title) === '') {
            throw new \InvalidArgumentException('Admin extension components must be notice, card or link and have a title.');
        }
        if ($kind === 'link' && ($href === null || !str_starts_with($href, '/') || str_contains($href, '://') || str_contains($href, '..'))) {
            throw new \InvalidArgumentException('Admin extension links must be local paths without traversal.');
        }
        $this->slots[$name][] = ['kind' => $kind, 'title' => trim($title), 'text' => trim($text), 'href' => $href, 'priority' => $priority];
    }
}
