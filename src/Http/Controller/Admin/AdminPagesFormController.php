<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Flex\Pages\PageRepository;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPagesFormController
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
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Forbidden', 403);
        }

        $id = isset($arguments['id']) ? filter_var($arguments['id'], FILTER_VALIDATE_INT) : false;
        $page = $id !== false && $id > 0 ? $this->pages->find((int) $id) : null;
        if ($id !== false && $id > 0 && $page === null) {
            return $this->responses->text('Page not found', 404);
        }

        $isEdit = $page !== null;
        $isSettings = str_ends_with($request->getUri()->getPath(), '/settings');
        $pages = $this->hierarchicalPages($this->pages->all()->map(static fn(\Flex\Pages\Page $item): array => $item->toPublicArray())->all());
        $bootstrap = [
            'page' => $isSettings ? 'pages-settings' : ($isEdit ? 'pages-edit' : 'pages-create'),
            'csrfToken' => $this->csrf->token(),
            'sidebarWidth' => $this->settings->sidebarWidthForUser($user->id),
            'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($user->id),
            'collapsedSections' => $this->settings->collapsedSectionsForUser($user->id),
            'version' => $this->versions->current()->value,
            'pageData' => $page?->toPublicArray(),
            'pages' => $pages,
        ];

        return $this->responses->html($this->views->render('admin/app.twig', [
            'title' => $isSettings ? 'Настройки на страница' : ($isEdit ? 'Редактиране на страница' : 'Създаване на страница'),
            'vite_tags' => $this->assets->tags(),
            'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
        ]));
    }

    /** @param list<array<string, mixed>> $pages @return list<array<string, mixed>> */
    private function hierarchicalPages(array $pages): array
    {
        $byId = [];
        foreach ($pages as $page) {
            $byId[(int) $page['id']] = $page;
        }

        $children = [];
        foreach ($pages as $page) {
            $parentId = $page['parent_id'] ?? null;
            $parentKey = is_int($parentId) && isset($byId[$parentId]) ? (string) $parentId : 'root';
            $children[$parentKey][] = (int) $page['id'];
        }
        foreach ($children as &$ids) {
            usort($ids, static fn(int $left, int $right): int => strnatcasecmp(mb_strtolower((string) $byId[$left]['title']), mb_strtolower((string) $byId[$right]['title'])));
        }
        unset($ids);

        $ordered = [];
        $visited = [];
        $append = function (string $parentKey, int $depth) use (&$append, &$children, &$byId, &$ordered, &$visited): void {
            foreach ($children[$parentKey] ?? [] as $id) {
                if (isset($visited[$id])) continue;
                $visited[$id] = true;
                $page = $byId[$id];
                $page['depth'] = $depth;
                $ordered[] = $page;
                $append((string) $id, $depth + 1);
            }
        };
        $append('root', 0);
        foreach ($byId as $id => $page) {
            if (!isset($visited[$id])) $children['root'][] = $id;
        }
        $append('root', 0);

        return $ordered;
    }
}
