<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Extensions\PluginRegistry;
use Flex\Extensions\AdminExtensionRegistry;
use Flex\Http\View\ViteAssetManager;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPluginsController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PluginRegistry $plugins,
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

        $plugins = [];
        $pluginDetail = null;
        foreach ($this->plugins->discover() as $entry) {
            $registered = null;
            try {
                $registered = $this->plugins->find($entry['manifest']->id);
            } catch (\Throwable) {
                // The migration may not have run yet; discovered plugins remain visible.
            }
            $record = $registered?->toPublicArray() ?? [
                'id' => $entry['manifest']->id,
                'name' => $entry['manifest']->name,
                'version' => $entry['manifest']->version,
                'description' => $entry['manifest']->description,
                'entrypoint' => $entry['manifest']->entrypoint,
                'path' => $entry['path'],
                'status' => 'discovered',
                'manifest' => $entry['manifest']->toArray(),
                'requested_permissions' => $entry['manifest']->permissions,
                'approved_permissions' => [],
                'last_error' => null,
                'installed_at' => null,
                'activated_at' => null,
            ];
            $plugins[] = $record;
            if (isset($arguments['id']) && hash_equals((string) $arguments['id'], (string) $record['id'])) {
                $pluginDetail = $record;
            }
        }

        if (isset($arguments['id']) && $pluginDetail === null) {
            return $this->responses->text('Plugin not found', 404);
        }

        $bootstrap = [
            'page' => $pluginDetail === null ? 'plugins' : 'plugin-detail',
            'csrfToken' => $this->csrf->token(),
            'sidebarWidth' => $this->settings->sidebarWidthForUser($user->id),
            'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($user->id),
            'collapsedSections' => $this->settings->collapsedSectionsForUser($user->id),
            'version' => $this->versions->current()->value,
            'plugins' => $plugins,
            'pluginDetail' => $pluginDetail,
            'adminExtensions' => $this->adminExtensions->bootstrap(),
        ];

        return $this->responses->html($this->views->render('admin/app.twig', [
            'title' => $pluginDetail === null ? 'Разширения' : (string) $pluginDetail['name'],
            'vite_tags' => $this->assets->tags(),
            'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
        ]));
    }
}
