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
    public function __construct(private PageRepository $pages, private ThemeManager $themes, private ConfigRepositoryInterface $configuration, private ResponseFactoryInterface $responses, private ExtensionApiInterface $extensionApi, private PublicMenuRenderer $menus, private ?\Flex\Media\PublicMediaApi $media = null, private ?\Flex\Settings\SectionSettings $siteSettings = null, private ?\Flex\Contracts\Http\ViewRendererInterface $views = null) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $publicSettings = $this->siteSettings?->all('public');
        if (($publicSettings['closed'] ?? '0') === '1') {
            $html = $this->views?->render('system/site-closed.twig', ['message' => $publicSettings['closed_message']]);
            return $html === null
                ? $this->responses->json(['message' => $publicSettings['closed_message']], 503)
                : $this->responses->html($html, 503, ['Retry-After' => '300', 'Cache-Control' => 'no-store']);
        }
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
            $menuData['__flex_media_api'] = $this->media;

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
        $documentTitle = $this->extensionApi->applyFilters('public.title', (string) $page->getAttribute('title'), [
            'page' => $page->toPublicArray(),
            'request' => $request,
        ]);
        $documentTitle = is_string($documentTitle) && trim($documentTitle) !== '' ? $documentTitle : (string) $page->getAttribute('title');

        $capabilities = $this->themes->capabilities();
        $menuData = $this->menus->forTheme($capabilities['theme'] ?? '', $publicPages, $capabilities['menu_locations']);
        $menuData['__flex_menu_api'] = new PublicMenuApi($this->menus, $publicPages);
        $menuData['__flex_media_api'] = $this->media;
        $menuData['featured_media'] = $this->media?->get((int) $page->getAttribute('featured_media_id')) ?? [];
        return $this->responses->html($this->themes->render('page.twig', ['page' => $page, 'page_public_path' => $publicPages->publicPath($page), 'page_settings' => $settings, 'head_tags' => $headTags, 'document_title' => $documentTitle, 'navigation' => $navigation] + $menuData));
    }

    private function homePage(PublicPageSet $publicPages): ?Page
    {
        $id = (int) ($this->siteSettings?->all('public')['home_page_id'] ?? 0);
        if ($id > 0) {
            return $publicPages->findPublishedById($id);
        }
        $slug = trim($this->configuration->string('app.public_home_slug', 'home'));

        return $slug === '' ? null : $publicPages->findPublishedBySlug($slug);
    }
}
