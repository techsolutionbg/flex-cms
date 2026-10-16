<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Pages\HomePageResolver;
use Flex\Pages\Page;
use Flex\Pages\PageRepository;
use Flex\Pages\PublicPageSet;
use Flex\Themes\ThemeManager;
use Flex\Themes\ThemeResourceService;
use Flex\Menus\PublicMenuRenderer;
use Flex\Menus\PublicMenuApi;
use Flex\Session\CsrfTokenManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class PublicPageController
{
    public function __construct(private PageRepository $pages, private ThemeManager $themes, private ConfigRepositoryInterface $configuration, private ResponseFactoryInterface $responses, private ExtensionApiInterface $extensionApi, private PublicMenuRenderer $menus, private ThemeResourceService $records, private ?\Flex\Media\PublicMediaApi $media = null, private ?\Flex\Settings\SectionSettings $siteSettings = null, private ?\Flex\Contracts\Http\ViewRendererInterface $views = null, private ?HomePageResolver $homePages = null, private ?CsrfTokenManager $csrf = null) {}

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
            $isHome = $slug === '';
            $html = $this->views?->render('system/not-found.twig', [
                'title' => $isHome ? 'Начална страница не е налична' : 'Страницата не е намерена',
                'message' => $isHome
                    ? 'Няма публикувана начална страница. Създайте или публикувайте начална страница, за да я покажете тук.'
                    : 'Търсената страница не съществува или вече не е публикувана.',
                'show_home_link' => !$isHome,
            ]);

            return $this->responses->html($html ?? $this->renderNotFoundFallback($isHome), 404);
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
        $menuData['__flex_theme_records'] = fn(string $resource): array => $this->records->published($resource);
        $menuData['featured_media'] = $this->media?->get((int) $page->getAttribute('featured_media_id')) ?? [];
        $query = $request->getQueryParams();
        $contactStatus = is_array($query) && is_string($query['contact'] ?? null) && in_array($query['contact'], ['sent', 'invalid', 'unconfigured', 'error'], true) ? $query['contact'] : '';

        return $this->responses->html($this->themes->render('page.twig', ['page' => $page, 'page_public_path' => $publicPages->publicPath($page), 'page_settings' => $settings, 'head_tags' => $headTags, 'document_title' => $documentTitle, 'navigation' => $navigation, 'csrf_token' => $this->csrf?->token() ?? '', 'contact_status' => $contactStatus] + $menuData));
    }

    private function homePage(PublicPageSet $publicPages): ?Page
    {
        return ($this->homePages ?? new HomePageResolver($this->configuration, $this->siteSettings))->resolve($publicPages);
    }

    private function renderNotFoundFallback(bool $isHome): string
    {
        $title = $isHome ? 'Начална страница не е налична' : 'Страницата не е намерена';
        $message = $isHome
            ? 'Няма публикувана начална страница. Създайте или публикувайте начална страница, за да я покажете тук.'
            : 'Търсената страница не съществува или вече не е публикувана.';
        $link = $isHome ? '' : '<p><a href="/">Към началната страница</a></p>';

        return '<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 · Flex CMS</title></head><body><main><p>404</p><h1>'
            . htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '</h1><p>' . htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '</p>' . $link . '</main></body></html>';
    }
}
