<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
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
        $theme = $this->activeTheme();
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
        $theme = trim($this->configuration->string('app.active_theme', 'flex-default'));

        return $theme !== '' && preg_match('/^[a-z0-9][a-z0-9._-]*$/', $theme) === 1 ? $theme : 'flex-default';
    }
}
