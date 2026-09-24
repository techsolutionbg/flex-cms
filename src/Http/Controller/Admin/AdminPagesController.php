<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Flex\Extensions\AdminExtensionRegistry;
use Flex\Pages\PageRepository;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPagesController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PageRepository $pages,
        private ResponseFactoryInterface $responses,
        private CsrfTokenManager $csrf,
        private SettingRepository $settings,
        private PlatformVersionRegistry $versions,
        private ViewRendererInterface $views,
        private ViteAssetManager $assets,
        private AdminExtensionRegistry $adminExtensions,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Forbidden', 403);
        }

        $pages = $this->pages->all()->map(static fn(\Flex\Pages\Page $page): array => $page->toPublicArray())->all();
        $pagesById = [];
        $childrenByParent = [];
        foreach ($pages as $page) {
            $pagesById[$page['id']] = $page;
        }
        foreach ($pages as $page) {
            $parentKey = is_int($page['parent_id'] ?? null) && isset($pagesById[$page['parent_id']])
                ? (string) $page['parent_id']
                : 'root';
            $childrenByParent[$parentKey][] = $page['id'];
        }

        foreach ($childrenByParent as &$childIds) {
            usort($childIds, static function (int $leftId, int $rightId) use ($pagesById): int {
                return strnatcasecmp(
                    mb_strtolower((string) $pagesById[$leftId]['title']),
                    mb_strtolower((string) $pagesById[$rightId]['title']),
                );
            });
        }
        unset($childIds);

        $orderedPages = [];
        $visited = [];
        $appendTree = function (string $parentKey, int $depth) use (&$appendTree, &$childrenByParent, &$pagesById, &$orderedPages, &$visited): void {
            foreach ($childrenByParent[$parentKey] ?? [] as $pageId) {
                if (isset($visited[$pageId])) {
                    continue;
                }
                $visited[$pageId] = true;
                $page = $pagesById[$pageId];
                $page['depth'] = $depth;
                $orderedPages[] = $page;
                $appendTree((string) $pageId, $depth + 1);
            }
        };
        $appendTree('root', 0);

        foreach ($pagesById as $pageId => $page) {
            if (isset($visited[$pageId])) {
                continue;
            }
            $childrenByParent['root'][] = $pageId;
        }
        if (count($orderedPages) !== count($pagesById)) {
            $appendTree('root', 0);
        }
        $pages = $orderedPages;

        $bootstrap = [
            'page' => 'pages',
            'csrfToken' => $this->csrf->token(),
            'sidebarWidth' => $this->settings->sidebarWidthForUser($user->id),
            'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($user->id),
            'collapsedSections' => $this->settings->collapsedSectionsForUser($user->id),
            'version' => $this->versions->current()->value,
            'pages' => $pages,
            'trashedPages' => $this->pages->trashed()->map(static fn(\Flex\Pages\Page $page): array => $page->toPublicArray())->all(),
            'adminExtensions' => $this->adminExtensions->bootstrap(),
        ];

        return $this->responses->html($this->views->render('admin/app.twig', [
            'title' => 'Страници',
            'vite_tags' => $this->assets->tags(),
            'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
        ]));
    }
}
