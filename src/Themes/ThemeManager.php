<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Settings\Setting;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;

final class ThemeManager
{
    private ?Environment $twig = null;
    private ?string $loadedTheme = null;

    public function __construct(private readonly ProjectPaths $paths, private readonly ConfigRepositoryInterface $configuration) {}

    /** @param array<string, mixed> $data */
    public function render(string $template, array $data = []): string
    {
        return $this->renderForTheme($this->activeTheme(), $template, $data);
    }

    /** @param array<string, mixed> $data */
    public function renderForTheme(string $theme, string $template, array $data = []): string
    {
        if (preg_match('/^[a-z0-9][a-z0-9._-]*$/', $theme) !== 1) {
            throw new \RuntimeException('Невалиден идентификатор на тема.');
        }
        $templatesPath = $this->paths->themes($theme . '/templates');
        if (!is_dir($templatesPath)) throw new \RuntimeException(sprintf('Активната тема „%s“ не е намерена.', $theme));
        if ($this->twig === null || $this->loadedTheme !== $theme) {
            $this->twig = new Environment(new FilesystemLoader($templatesPath), ['cache' => false, 'strict_variables' => true]);
            $this->loadedTheme = $theme;
        }

        return $this->twig->render($template, $data + ['theme' => $theme]);
    }

    public function activeTheme(): string
    {
        $stored = Setting::query()->find('site.active_theme');
        $theme = trim((string) ($stored instanceof Setting ? $stored->getAttribute('value') : $this->configuration->string('app.active_theme', 'flex-default')));

        return $theme !== '' && preg_match('/^[a-z0-9][a-z0-9._-]*$/', $theme) === 1 ? $theme : 'flex-default';
    }

    /** @return list<array{id: string, name: string, version: string, author: string, description: string, path: string, active: bool, valid: bool, error: string|null}> */
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
                foreach (['name', 'version', 'author', 'description'] as $field) {
                    if (isset($manifest[$field]) && is_string($manifest[$field])) {
                        $record[$field] = trim($manifest[$field]);
                    }
                }
                $record['valid'] = is_dir($path . '/templates');
                if (!$record['valid']) {
                    $record['error'] = 'Липсва папка templates.';
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

    private function saveSetting(string $key, string $value): void
    {
        $setting = Setting::query()->find($key);
        if (!$setting instanceof Setting) {
            $setting = new Setting(['key' => $key]);
        }
        $setting->fill(['value' => $value, 'type' => 'string', 'group' => 'system', 'autoload' => true]);
        $setting->saveOrFail();
    }
}
