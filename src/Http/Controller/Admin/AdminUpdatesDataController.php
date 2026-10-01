<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Updates\Remote\RemoteCatalogClient;
use Flex\Updates\Remote\RemotePlatformUpdater;
use Flex\Updates\UpdateErrorMessage;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/** Returns update state for the React administration. */
final readonly class AdminUpdatesDataController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ConfigRepositoryInterface $configuration,
        private PlatformVersionRegistry $versions,
        private RemoteCatalogClient $catalog,
        private PlatformHistory $history,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['status' => 403, 'message' => 'Достъпът е забранен.']], 403);
        }

        $currentVersion = $this->versions->current()->value;
        $remote = ['current_version' => $currentVersion, 'channel' => $this->configuration->string('extensions.updates.channel'), 'available' => null, 'error' => null];
        try {
            $release = RemotePlatformUpdater::selectLatest($this->catalog->platformCatalog(), $this->versions->current(), $this->configuration->string('extensions.updates.channel'));
            if ($release !== null) {
                $remote['available'] = ['version' => $release->version->value, 'release_notes' => $release->releaseNotes, 'size' => $release->size, 'published_at' => $release->publishedAt, 'channel' => $release->channel->value];
            }
        } catch (\Throwable $exception) {
            $remote['error'] = UpdateErrorMessage::forAdmin($exception);
        }

        return $this->responses->json([
            'version' => $currentVersion,
            'remote_update' => $remote,
            'history' => array_reverse($this->history->all()),
        ]);
    }
}
