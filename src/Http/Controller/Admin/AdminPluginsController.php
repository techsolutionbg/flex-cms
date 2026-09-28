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
use Flex\Updates\Remote\RemoteCatalogClient;
use Flex\Updates\Remote\PluginUpdateHistory;
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
        private RemoteCatalogClient $remoteCatalog,
        private PluginUpdateHistory $pluginUpdateHistory,
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
        $catalogDetail = null;
        $catalogPage = rtrim($request->getUri()->getPath(), '/') === '/admin/plugins/catalog';
        $pluginCatalog = [];
        try {
            $channel = 'stable';
            $index = $this->remoteCatalog->pluginIndex();
            foreach ($index->manifests as $id => $manifestUrl) {
                $catalog = $this->remoteCatalog->pluginManifest($id);
                $releases = array_values(array_filter($catalog->releases, static fn($release): bool => $release->channel->value === $channel));
                usort($releases, static fn($left, $right): int => version_compare($right->version->value, $left->version->value));
                $latest = $releases[0] ?? null;
                if ($latest !== null) {
                    $pluginCatalog[] = ['id' => $id, 'version' => $latest->version->value, 'release_notes' => $latest->releaseNotes, 'size' => $latest->size, 'published_at' => $latest->publishedAt, 'compatible_from' => $latest->compatibleFrom, 'minimum_php' => $latest->minimumPhp] + ($index->metadata[$id] ?? ['name' => $id, 'description' => '', 'author' => '', 'icon_url' => '', 'minimum_platform_version' => '', 'permissions' => []]);
                }
            }
        } catch (\Throwable) {
            // The installed plugin list remains usable when the remote catalog is unavailable.
        }
        if (isset($arguments['catalogId'])) {
            foreach ($pluginCatalog as $catalogItem) {
                if (hash_equals((string) $arguments['catalogId'], (string) ($catalogItem['id'] ?? ''))) {
                    $catalogDetail = $catalogItem;
                    break;
                }
            }
            if ($catalogDetail === null) {
                return $this->responses->text('Catalog plugin not found', 404);
            }
        }
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

        $pluginHistory = $this->pluginUpdateHistory->all();
        foreach ($plugins as &$plugin) {
            $updates = array_values(array_filter($pluginHistory, static fn(array $record): bool => ($record['type'] ?? null) === 'plugin_update' && ($record['plugin_id'] ?? null) === ($plugin['id'] ?? null)));
            usort($updates, static fn(array $left, array $right): int => strcmp((string) ($right['updated_at'] ?? ''), (string) ($left['updated_at'] ?? '')));
            $plugin['last_update_id'] = $updates[0]['id'] ?? null;
            $plugin['last_update_from'] = $updates[0]['from'] ?? null;
            $plugin['last_update_to'] = $updates[0]['to'] ?? null;
        }
        unset($plugin);
        if ($pluginDetail !== null) {
            foreach ($plugins as $plugin) {
                if (($plugin['id'] ?? null) === ($pluginDetail['id'] ?? null)) {
                    $pluginDetail = $plugin;
                    break;
                }
            }
        }

        $installedStatuses = [];
        $installedVersions = [];
        foreach ($plugins as $plugin) {
            $status = (string) ($plugin['status'] ?? '');
            $pluginId = (string) ($plugin['id'] ?? '');
            $installedStatuses[$pluginId] = $status === 'active'
                ? 'active'
                : (in_array($status, ['installed', 'inactive', 'error'], true) ? 'installed' : 'not_installed');
            if ($installedStatuses[$pluginId] !== 'not_installed') {
                $installedVersions[$pluginId] = (string) ($plugin['version'] ?? '');
            }
        }
        $pluginCatalog = array_map(static function (array $item) use ($installedStatuses): array {
            $item['installation_status'] = $installedStatuses[(string) ($item['id'] ?? '')] ?? 'not_installed';
            return $item;
        }, $pluginCatalog);
        $pluginCatalog = array_map(static function (array $item) use ($installedVersions): array {
            $id = (string) ($item['id'] ?? '');
            $installedVersion = $installedVersions[$id] ?? null;
            $item['installed_version'] = $installedVersion;
            $item['update_available'] = is_string($installedVersion) && $installedVersion !== '' && version_compare((string) ($item['version'] ?? ''), $installedVersion, '>');
            return $item;
        }, $pluginCatalog);
        if (isset($arguments['catalogId'])) {
            foreach ($pluginCatalog as $catalogItem) {
                if (hash_equals((string) $arguments['catalogId'], (string) ($catalogItem['id'] ?? ''))) {
                    $catalogDetail = $catalogItem;
                    break;
                }
            }
        }

        $bootstrap = [
            'page' => $catalogDetail !== null ? 'plugin-catalog-detail' : ($catalogPage ? 'plugin-catalog' : ($pluginDetail === null ? 'plugins' : 'plugin-detail')),
            'csrfToken' => $this->csrf->token(),
            'sidebarWidth' => $this->settings->sidebarWidthForUser($user->id),
            'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($user->id),
            'collapsedSections' => $this->settings->collapsedSectionsForUser($user->id),
            'version' => $this->versions->current()->value,
            'plugins' => $plugins,
            'pluginDetail' => $pluginDetail,
            'catalogDetail' => $catalogDetail,
            'adminExtensions' => $this->adminExtensions->bootstrap(),
            'pluginCatalog' => $pluginCatalog,
        ];

        return $this->responses->html($this->views->render('admin/app.twig', [
            'title' => $catalogDetail !== null ? (string) ($catalogDetail['name'] ?? $catalogDetail['id']) : ($catalogPage ? 'Каталог с разширения' : ($pluginDetail === null ? 'Разширения' : (string) $pluginDetail['name'])),
            'vite_tags' => $this->assets->tags(),
            'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
        ]));
    }
}
