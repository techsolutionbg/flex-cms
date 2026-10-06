<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Pages\Page;
use Flex\Pages\PageRepository;
use Flex\Pages\PublicPageSet;
use Flex\Themes\ThemeManager;
use Flex\Menus\PublicMenuRenderer;
use Flex\Menus\PublicMenuApi;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class PublicPageController
{
    public function __construct(private PageRepository $pages, private ThemeManager $themes, private ConfigRepositoryInterface $configuration, private ResponseFactoryInterface $responses, private ExtensionApiInterface $extensionApi, private PublicMenuRenderer $menus) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $slug = trim((string) ($arguments['slug'] ?? ''), '/');
        $publicPages = $this->pages->publicPageSet();
        $page = $slug === '' ? $this->homePage($publicPages) : $publicPages->findPublishedByPath($slug);
        if (!$page instanceof Page) {
            if (str_contains(strtolower($request->getHeaderLine('Accept')), 'application/json')) {
                return $this->responses->json(['error' => ['status' => 404, 'message' => 'Страницата не е намерена.']], 404);
            }
            $capabilities = $this->themes->capabilities();
            $menuData = $this->menus->forTheme($capabilities['theme'] ?? '', $publicPages, $capabilities['menu_locations']);
            $menuData['__flex_menu_api'] = new PublicMenuApi($this->menus, $publicPages);

            return $this->responses->html($this->themes->render('404.twig', ['title' => 'Страницата не е намерена'] + $menuData), 404);
        }
        $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
        $navigation = array_map(fn(Page $item): array => [
            'title' => (string) $item->getAttribute('title'),
            'slug' => $publicPages->publicPath($item),
        ], $publicPages->publishedNavigation());
        $headTags = $this->extensionApi->applyFilters('public.head', '', [
            'page' => $page->toPublicArray(),
            'request' => $request,
        ]);
        $headTags = is_string($headTags) ? $headTags : '';

        $capabilities = $this->themes->capabilities();
        $menuData = $this->menus->forTheme($capabilities['theme'] ?? '', $publicPages, $capabilities['menu_locations']);
        $menuData['__flex_menu_api'] = new PublicMenuApi($this->menus, $publicPages);
        return $this->responses->html($this->themes->render('page.twig', ['page' => $page, 'page_public_path' => $publicPages->publicPath($page), 'page_settings' => $settings, 'head_tags' => $headTags, 'navigation' => $navigation] + $menuData));
    }

    private function homePage(PublicPageSet $publicPages): ?Page
    {
        $slug = trim($this->configuration->string('app.public_home_slug', 'home'));

        return $slug === '' ? null : $publicPages->findPublishedBySlug($slug);
    }
}
