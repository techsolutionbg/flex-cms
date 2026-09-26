<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Updates\Remote\RemoteCatalogClient;
use Flex\Updates\Remote\RemotePlatformUpdater;
use Flex\Updates\Jobs\UpdateJobStore;
use Flex\Extensions\AdminExtensionRegistry;

final readonly class AdminUpdatesPage
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private SettingRepository $settings,
        private PlatformVersionRegistry $versions,
        private ViewRendererInterface $views,
        private ViteAssetManager $assets,
        private AdminExtensionRegistry $adminExtensions,
        private RemoteCatalogClient $catalog,
        private UpdateJobStore $jobs,
        private \Flex\Contracts\Configuration\ConfigRepositoryInterface $configuration,
    ) {}

    /**
     * @param list<array<string, mixed>> $history
     * @param array<string, mixed>|null $inspection
     */
    public function render(string $csrfToken, array $history, ?string $notice = null, ?string $error = null, ?array $inspection = null): string
    {
        $user = $this->authentication->user();
        $currentVersion = $this->versions->current()->value;
        $remote = ['current_version' => $currentVersion, 'channel' => $this->configuration->string('extensions.updates.channel'), 'available' => null, 'error' => null];
        try {
            $release = RemotePlatformUpdater::selectLatest($this->catalog->platformCatalog(), $this->versions->current(), $this->configuration->string('extensions.updates.channel'));
            if ($release !== null) {
                $remote['available'] = ['version' => $release->version->value, 'release_notes' => $release->releaseNotes, 'size' => $release->size, 'published_at' => $release->publishedAt, 'channel' => $release->channel->value];
            }
        } catch (\Throwable $exception) {
            $remote['error'] = $exception->getMessage();
        }
        $bootstrap = ['page' => 'updates', 'csrfToken' => $csrfToken, 'sidebarWidth' => $user instanceof AuthenticatedUser ? $this->settings->sidebarWidthForUser($user->id) : 248, 'sidebarCollapsed' => $user instanceof AuthenticatedUser ? $this->settings->sidebarCollapsedForUser($user->id) : false, 'collapsedSections' => $user instanceof AuthenticatedUser ? $this->settings->collapsedSectionsForUser($user->id) : [], 'version' => $currentVersion, 'history' => array_reverse($history), 'notice' => $notice, 'error' => $error, 'inspection' => $inspection, 'remoteUpdate' => $remote, 'updateJobs' => array_map(static fn($job): array => $job->toArray(), array_reverse($this->jobs->all())), 'adminExtensions' => $this->adminExtensions->bootstrap()];

        return $this->views->render('admin/app.twig', ['title' => 'Обновявания', 'vite_tags' => $this->assets->tags(), 'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)]);
    }
}
