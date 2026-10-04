<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Pages\Page;
use Flex\Pages\PageRepository;
use Flex\Themes\ThemeManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminThemePreviewController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PageRepository $pages,
        private ThemeManager $themes,
        private ConfigRepositoryInterface $configuration,
        private ExtensionApiInterface $extensionApi,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Достъпът е забранен.', 403);
        }
        $theme = (string) ($arguments['id'] ?? '');
        $themeRecord = array_values(array_filter($this->themes->all(), static fn(array $item): bool => $item['id'] === $theme))[0] ?? null;
        if (!is_array($themeRecord) || !$themeRecord['valid']) {
            return $this->responses->text('Темата не е намерена или е невалидна.', 404);
        }

        $publicPages = $this->pages->publicPageSet();
        $slug = trim($this->configuration->string('app.public_home_slug', 'home'));
        $page = $slug === '' ? null : $publicPages->findPublishedBySlug($slug);
        if (!$page instanceof Page) {
            return $this->responses->html($this->themes->renderForTheme($theme, '404.twig', ['title' => 'Няма публикувана начална страница']), 404);
        }
        $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
        $navigation = array_map(fn(Page $item): array => [
            'title' => (string) $item->getAttribute('title'),
            'slug' => $publicPages->publicPath($item),
        ], $publicPages->publishedNavigation());
        $headTags = $this->extensionApi->applyFilters('public.head', '', ['page' => $page->toPublicArray(), 'request' => $request]);

        return $this->responses->html($this->themes->renderForTheme($theme, 'page.twig', [
            'page' => $page,
            'page_public_path' => $publicPages->publicPath($page),
            'page_settings' => $settings,
            'head_tags' => is_string($headTags) ? $headTags : '',
            'navigation' => $navigation,
            'preview' => true,
        ]));
    }
}
