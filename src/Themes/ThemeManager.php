<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Extension\V1\Time;
use Flex\Extensions\FrontendExtensionAssets;
use Flex\Settings\Setting;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use Twig\TwigFunction;
use Flex\Menus\PublicMenuApi;

final class ThemeManager
{
    private ?Environment $twig = null;
    private ?string $loadedTheme = null;
    private ?PublicMenuApi $menuApi = null;
    private ?\Flex\Media\PublicMediaApi $mediaApi = null;

    public function __construct(
        private readonly ProjectPaths $paths,
        private readonly ConfigRepositoryInterface $configuration,
        private readonly ?\Flex\Settings\GeneralSettings $generalSettings = null,
        private readonly ?\Flex\Extension\V1\ExtensionApiInterface $extensionApi = null,
        private readonly ?FrontendExtensionAssets $frontendAssets = null,
    ) {}

    /** @param array<string, mixed> $data */
    public function render(string $template, array $data = []): string
    {
        $theme = $this->activeTheme();
        if ($theme === '') {
            return $this->renderNoTheme();
        }

        return $this->renderForTheme($theme, $template, $data);
    }

    /** @param array<string, mixed> $data */
    public function renderForTheme(string $theme, string $template, array $data = []): string
    {
        // Render into a copy: extension output must never be saved back to page content.
        if (($data['page'] ?? null) instanceof \Flex\Pages\Page && $this->extensionApi !== null) {
            $page = clone $data['page'];
            $content = $this->extensionApi->applyFilters('public.content', (string) $page->getAttribute('content'), ['page' => $page->toPublicArray()]);
            if (is_string($content)) $page->setAttribute('content', $content);
            $data['page'] = $page;
        }
        if ($this->generalSettings !== null) {
            $data['site'] = $this->generalSettings->all();
            $data['site_format_date'] = fn(\DateTimeInterface $date): string => $this->generalSettings->formatDate($date);
        }
        if (preg_match('/^[a-z0-9][a-z0-9._-]*$/', $theme) !== 1) {
            throw new \RuntimeException('Невалиден идентификатор на тема.');
        }
        $menuApi = ($data['__flex_menu_api'] ?? null) instanceof PublicMenuApi ? $data['__flex_menu_api'] : null;
        unset($data['__flex_menu_api']);
        $this->menuApi = $menuApi;
        $mediaApi = ($data['__flex_media_api'] ?? null) instanceof \Flex\Media\PublicMediaApi ? $data['__flex_media_api'] : null;
        unset($data['__flex_media_api']);
        $this->mediaApi = $mediaApi;
        $phpTemplate = $this->phpTemplate($theme, $template);
        if ($phpTemplate !== null) {
            $themeAsset = fn(string $asset): string => ltrim($asset, '/') === 'style.css'
                ? '/themes/' . rawurlencode($theme) . '/style.css'
                : '/themes/' . rawurlencode($theme) . '/assets/' . ltrim($asset, '/');
            ob_start();
            try {
                $flexMenu = static fn(string $slug): array => $menuApi?->get($slug) ?? [];
                $flexMenuHtml = static fn(string $slug): string => $menuApi?->html($slug) ?? '';
                $flexMedia = static fn(int $id): array => $mediaApi?->get($id) ?? [];
                extract($data + [
                    'theme' => $theme,
                    'theme_asset' => $themeAsset,
                    'flex_menu' => $flexMenu,
                    'flex_menu_html' => $flexMenuHtml,
                    'flex_media' => $flexMedia,
                    'flex_time' => static fn(mixed $value, string $style = 'datetime'): string => Time::html($value, $style),
                    'frontend_extension_tags' => $this->frontendAssets?->publicTags() ?? '',
                    'head_tags' => is_string($data['head_tags'] ?? null) ? $data['head_tags'] : '',
                ], EXTR_SKIP);
                include $phpTemplate;
                return (string) ob_get_clean();
            } catch (\Throwable $exception) {
                ob_end_clean();
                throw $exception;
            }
        }
        $templatesPath = $this->paths->themes($theme . '/templates');
        if (!is_dir($templatesPath)) {
            throw new \RuntimeException(sprintf('Активната тема „%s“ не е намерена.', $theme));
        }
        if ($this->twig === null || $this->loadedTheme !== $theme) {
            $this->twig = new Environment(new FilesystemLoader($templatesPath), ['cache' => false, 'strict_variables' => true]);
            $this->twig->addFunction(new TwigFunction('flex_menu', fn(string $slug): array => $this->menuApi?->get($slug) ?? []));
            $this->twig->addFunction(new TwigFunction('site_format_date', fn(\DateTimeInterface $date): string => $this->generalSettings?->formatDate($date) ?? $date->format('d.m.Y H:i')));
            $this->twig->addFunction(new TwigFunction('flex_media', fn(int $id): array => $this->mediaApi?->get($id) ?? []));
            $this->twig->addFunction(new TwigFunction('flex_time', static fn(mixed $value, string $style = 'datetime'): string => Time::html($value, $style), ['is_safe' => ['html']]));
            $this->twig->addFunction(new TwigFunction('flex_menu_html', fn(string $slug): string => $this->menuApi?->html($slug) ?? '', ['is_safe' => ['html']]));
            $this->loadedTheme = $theme;
        }

        return $this->twig->render($template, $data + ['theme' => $theme]);
    }

    public function activeTheme(): string
    {
        $stored = Setting::query()->find('site.active_theme');
        $theme = trim((string) ($stored instanceof Setting ? $stored->getAttribute('value') : $this->configuration->string('app.active_theme', 'flex-default')));

        if ($theme === 'no-theme') {
            return '';
        }

        if ($theme !== '' && preg_match('/^[a-z0-9][a-z0-9._-]*$/', $theme) === 1 && is_dir($this->paths->themes($theme))) {
            return $theme;
        }
        if (is_dir($this->paths->themes('flex-starter'))) {
            return 'flex-starter';
        }

        if (is_dir($this->paths->themes('flex-default'))) {
            return 'flex-default';
        }

        return '';
    }

    /** @return array{theme: string|null, supports: array{menus: bool}, menu_locations: array<string, string>} */
    public function capabilities(): array
    {
        return $this->capabilitiesForTheme($this->activeTheme());
    }

    /** @return array{theme: string|null, supports: array{menus: bool}, menu_locations: array<string, string>} */
    public function capabilitiesForTheme(string $theme): array
    {
        $result = ['theme' => $theme !== '' ? $theme : null, 'supports' => ['menus' => false], 'menu_locations' => []];
        if ($theme === '' || preg_match('/^[a-z0-9][a-z0-9._-]*$/', $theme) !== 1) {
            return $result;
        }
        if (!is_file($this->paths->themes($theme . '/theme.json'))) {
            return $result;
        }
        try {
            $data = json_decode((string) file_get_contents($this->paths->themes($theme . '/theme.json')), true, 512, JSON_THROW_ON_ERROR);
            $manifest = ThemeManifest::fromArray($data);
            if ($manifest->id !== $theme) {
                return $result;
            }
            $result['supports']['menus'] = ($manifest->supports['menus'] ?? false) === true;
            if ($result['supports']['menus']) {
                $result['menu_locations'] = $manifest->menuLocations;
            }
        } catch (\Throwable) {
            // Missing or invalid manifests never grant access to theme capabilities.
        }
        return $result;
    }

    private function renderNoTheme(): string
    {
        return '<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Няма активна тема</title><style>*,*::before,*::after{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:2rem;background:#f3f5ef;color:#172118;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.notice{width:min(100%,42rem);padding:3rem;border:1px solid #d4d9d0;border-radius:1rem;background:#fff;box-shadow:0 1rem 3rem rgb(23 33 24 / 8%);text-align:center}.notice h1{margin:0 0 1rem;font-size:clamp(1.7rem,4vw,2.4rem)}.notice p{margin:0;color:#687268;font-size:1.05rem;line-height:1.6}</style></head><body><main class="notice"><h1>Няма активна тема</h1><p>Публичната част на сайта временно не може да бъде показана, защото няма активирана тема.</p></main></body></html>';
    }

    /** @return list<array{id: string, name: string, version: string, author: string, description: string, tags: list<string>, screenshot_url: string|null, supports: list<string>, path: string, active: bool, valid: bool, error: string|null}> */
    public function all(): array
    {
        $root = rtrim($this->paths->themes(), '/');
        if (!is_dir($root)) {
            return [];
        }

        $themes = [];
        foreach (scandir($root) ?: [] as $directory) {
            if ($directory === '.' || $directory === '..' || $directory[0] === '.') {
                continue;
            }
            $path = $root . '/' . $directory;
            if (!is_dir($path)) {
                continue;
            }

            $record = [
                'id' => $directory,
                'name' => $directory,
                'version' => '—',
                'author' => '—',
                'description' => '',
                'tags' => [],
                'screenshot_url' => null,
                'supports' => [],
                'path' => $path,
                'active' => $directory === $this->activeTheme(),
                'valid' => false,
                'error' => null,
            ];
            $manifestPath = $path . '/theme.json';
            if (!is_file($manifestPath) || !is_readable($manifestPath)) {
                $record['error'] = 'Липсва theme.json.';
                $themes[] = $record;
                continue;
            }
            try {
                $manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
                if (!is_array($manifest)) {
                    throw new \RuntimeException('theme.json трябва да съдържа JSON обект.');
                }
                foreach (['id', 'name', 'version'] as $field) {
                    if (!is_string($manifest[$field] ?? null) || trim($manifest[$field]) === '') {
                        throw new \RuntimeException(sprintf('Полето „%s“ е задължително.', $field));
                    }
                }
                if ($manifest['id'] !== $directory || preg_match('/^[a-z0-9][a-z0-9._-]*$/', $manifest['id']) !== 1) {
                    throw new \RuntimeException('ID на темата трябва да съвпада с името на папката.');
                }
                ThemeManifest::fromArray($manifest);
                foreach (['name', 'version', 'author', 'description'] as $field) {
                    if (isset($manifest[$field]) && is_string($manifest[$field])) {
                        $record[$field] = trim($manifest[$field]);
                    }
                }
                if (is_array($manifest['tags'] ?? null)) {
                    $record['tags'] = array_values(array_filter(array_map(static fn(mixed $tag): string => is_string($tag) ? trim($tag) : '', $manifest['tags']), static fn(string $tag): bool => $tag !== ''));
                }
                if (is_array($manifest['supports'] ?? null)) {
                    $supports = $manifest['supports'];
                    $record['supports'] = array_is_list($supports)
                        ? array_values(array_filter(array_map(static fn(mixed $support): string => is_string($support) ? trim($support) : '', $supports), static fn(string $support): bool => $support !== ''))
                        : array_values(array_filter(array_map(static fn(mixed $support, mixed $enabled): string => $enabled && is_string($support) ? trim($support) : '', array_keys($supports), $supports), static fn(string $support): bool => $support !== ''));
                }
                $screenshot = is_string($manifest['screenshot'] ?? null) ? trim($manifest['screenshot']) : '';
                if (str_starts_with($screenshot, 'assets/')) {
                    $screenshot = substr($screenshot, strlen('assets/'));
                }
                if ($screenshot !== '' && preg_match('/^(?!.*\.\.)[a-zA-Z0-9][a-zA-Z0-9._\/-]*$/', $screenshot) === 1 && is_file($path . '/assets/' . $screenshot)) {
                    $record['screenshot_url'] = '/theme-assets/' . rawurlencode($directory) . '/' . implode('/', array_map('rawurlencode', explode('/', $screenshot)));
                }
                $record['valid'] = is_file($path . '/index.php') || is_dir($path . '/templates');
                if (!$record['valid']) {
                    $record['error'] = 'Липсва index.php или папка templates.';
                }
            } catch (\Throwable $exception) {
                $record['error'] = $exception->getMessage();
            }
            $themes[] = $record;
        }

        usort($themes, static fn(array $left, array $right): int => strnatcasecmp($left['name'], $right['name']));

        return $themes;
    }

    /** @return array{id: string, name: string, version: string, author: string, description: string, path: string, active: bool, valid: bool, error: string|null} */
    public function activate(string $id): array
    {
        $theme = array_values(array_filter($this->all(), static fn(array $item): bool => $item['id'] === $id))[0] ?? null;
        if (!is_array($theme) || !$theme['valid']) {
            throw new \RuntimeException('Темата не е валидна и не може да бъде активирана.');
        }
        $previous = $this->activeTheme();
        if ($previous !== $id) {
            $this->saveSetting('site.previous_theme', $previous);
            $this->saveSetting('site.active_theme', $id);
        }

        return $theme;
    }

    /** @return array{id: string, name: string, version: string, author: string, description: string, path: string, active: bool, valid: bool, error: string|null} */
    public function rollback(): array
    {
        $stored = Setting::query()->find('site.previous_theme');
        $previous = $stored instanceof Setting ? (string) $stored->getAttribute('value') : '';
        if ($previous === '') {
            throw new \RuntimeException('Няма предходна активна тема.');
        }

        return $this->activate($previous);
    }

    /** @return array{id: string, name: string, version: string, author: string, description: string, path: string, active: bool, valid: bool, error: string|null} */
    public function deactivate(string $id): array
    {
        $theme = array_values(array_filter($this->all(), static fn(array $item): bool => $item['id'] === $id))[0] ?? null;
        if (!is_array($theme) || !$theme['valid']) {
            throw new \RuntimeException('Темата не е валидна и не може да бъде деактивирана.');
        }
        if ($this->activeTheme() !== $id) {
            throw new \RuntimeException('Темата не е активна.');
        }
        $this->saveSetting('site.previous_theme', $id);
        $this->saveSetting('site.active_theme', 'no-theme');
        return [...$theme, 'active' => false];
    }

    /** @return array{id: string, name: string, version: string, author: string, description: string, path: string, active: bool, valid: bool, error: string|null} */
    public function delete(string $id): array
    {
        $theme = array_values(array_filter($this->all(), static fn(array $item): bool => $item['id'] === $id))[0] ?? null;
        if (!is_array($theme)) {
            throw new \RuntimeException('Темата не е намерена.');
        }
        if ($theme['active'] || $this->activeTheme() === $id) {
            throw new \RuntimeException('Активната тема не може да бъде изтрита.');
        }
        $root = realpath($this->paths->themes());
        $path = realpath((string) $theme['path']);
        if ($root === false || $path === false || dirname($path) !== rtrim($root, DIRECTORY_SEPARATOR)) {
            throw new \RuntimeException('Пътят на темата е невалиден.');
        }
        $this->deleteDirectory($path);
        return $theme;
    }

    private function saveSetting(string $key, string $value): void
    {
        $setting = Setting::query()->find($key);
        if (!$setting instanceof Setting) {
            $setting = new Setting(['key' => $key]);
        }
        $setting->fill(['value' => $value, 'type' => 'string', 'group' => 'system', 'autoload' => true]);
        $setting->saveOrFail();
    }

    private function phpTemplate(string $theme, string $template): ?string
    {
        $root = $this->paths->themes($theme);
        if (!is_dir($root)) {
            return null;
        }
        foreach ([pathinfo($template, PATHINFO_FILENAME) . '.php', 'index.php'] as $candidate) {
            $path = $root . '/' . $candidate;
            if (is_file($path) && is_readable($path)) {
                return $path;
            }
        }
        return null;
    }

    private function deleteDirectory(string $path): void
    {
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        if (!@rmdir($path)) {
            throw new \RuntimeException('Файловете на темата не могат да бъдат изтрити.');
        }
    }
}
