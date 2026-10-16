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
use Flex\Settings\Setting;
use Flex\Themes\ThemeManager;
use Flex\Themes\ThemeResourceService;
use Flex\Menus\PublicMenuRenderer;
use Flex\Menus\PublicMenuApi;
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
        private PublicMenuRenderer $menus,
        private ThemeResourceService $records,
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

        $previewSections = null;
        if (strtoupper($request->getMethod()) === 'POST') {
            $body = $request->getParsedBody();
            if (!is_array($body)) {
                $decoded = json_decode((string) $request->getBody(), true);
                $body = is_array($decoded) ? $decoded : [];
            }
            $sections = $body['sections'] ?? null;
            if (!is_array($sections)) {
                return $this->responses->text('Невалидни данни за преглед.', 400);
            }
            $previewSections = $sections;
        }

        $publicPages = $this->pages->publicPageSet();
        $slug = trim($this->configuration->string('app.public_home_slug', 'home'));
        $homePageSetting = Setting::query()->find('settings.public.home_page_id');
        $homePageId = (int) ($homePageSetting?->getAttribute('value') ?? 0);
        $page = $homePageId > 0
            ? $publicPages->findPublishedById($homePageId)
            : ($slug === '' ? null : $publicPages->findPublishedBySlug($slug));
        if (!$page instanceof Page) {
            return $this->responses->html(<<<'HTML'
<!doctype html>
<html lang="bg" data-flex-preview-placeholder>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Прегледът не е наличен</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif">
  <main style="max-width:34rem;padding:2rem;text-align:center">
    <h1 style="font-size:1.5rem">Прегледът не е наличен</h1>
    <p>Няма публикувана начална страница. Създайте или публикувайте начална страница, за да видите прегледа на темата.</p>
  </main>
</body>
</html>
HTML, 404);
        }
        $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
        $navigation = array_map(fn(Page $item): array => [
            'title' => (string) $item->getAttribute('title'),
            'slug' => $publicPages->publicPath($item),
        ], $publicPages->publishedNavigation());
        $headTags = $this->extensionApi->applyFilters('public.head', '', ['page' => $page->toPublicArray(), 'request' => $request]);
        $documentTitle = $this->extensionApi->applyFilters('public.title', (string) $page->getAttribute('title'), ['page' => $page->toPublicArray(), 'request' => $request]);

        $menuData = $this->menus->forTheme($theme, $publicPages, $this->themes->capabilitiesForTheme($theme)['menu_locations']);
        $menuData['__flex_menu_api'] = new PublicMenuApi($this->menus, $publicPages);
        $menuData['__flex_theme_records'] = fn(string $resource): array => $this->records->published($resource);

        return $this->responses->html($this->themes->renderForTheme($theme, 'page.twig', [
            'page' => $page,
            'page_public_path' => $publicPages->publicPath($page),
            'page_settings' => $settings,
            'head_tags' => is_string($headTags) ? $headTags : '',
            'document_title' => is_string($documentTitle) && trim($documentTitle) !== '' ? $documentTitle : (string) $page->getAttribute('title'),
            'navigation' => $navigation,
            'preview' => true,
            '__flex_preview_theme_content' => $previewSections === null ? null : ['sections' => $previewSections],
        ] + $menuData));
    }
}
