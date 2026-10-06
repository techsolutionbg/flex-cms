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
use Flex\Updates\Jobs\UpdateJobStore;
use Flex\Updates\Platform\PlatformUpdateStateStore;
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
        private RemotePlatformUpdater $updater,
        private UpdateJobStore $jobs,
        private ResponseFactoryInterface $responses,
        private PlatformUpdateStateStore $states,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['status' => 403, 'message' => 'Достъпът е забранен.']], 403);
        }

        $jobId = $request->getQueryParams()['job_id'] ?? null;
        if (is_string($jobId) && $jobId !== '') {
            foreach ($this->jobs->all() as $job) {
                if ($job->id !== $jobId) continue;
                $phase = $job->result['phase'] ?? $job->status;
                $state = $job->status === UpdateJobStore::STATUS_RUNNING && $job->type === 'platform' ? $this->states->read() : null;
                if ($state !== null && $job->packageId !== null && $state->to !== $job->packageId) $state = null;
                if ($state !== null) $phase = $state->phase;
                return $this->responses->json(['job' => $job->toArray() + ['phase' => $phase, 'files_processed' => $state->filesProcessed ?? 0, 'files_total' => $state->filesTotal ?? 0]], 200, ['Cache-Control' => 'no-store']);
            }
            return $this->responses->json(['error' => ['message' => 'Задачата за обновяване не е намерена.']], 404);
        }

        $currentVersion = $this->versions->current()->value;
        $remote = ['current_version' => $currentVersion, 'channel' => $this->catalog->channel() ?: $this->configuration->string('extensions.updates.channel'), 'available' => null, 'error' => null];
        $releases = [];
        try {
            $catalog = $this->catalog->platformCatalog();
            $release = RemotePlatformUpdater::selectLatest($catalog, $this->versions->current(), $this->catalog->channel());
            if ($release !== null) {
                $remote['available'] = ['version' => $release->version->value, 'release_notes' => $release->releaseNotes, 'size' => $release->size, 'published_at' => $release->publishedAt, 'channel' => $release->channel->value];
            }
            foreach ($catalog->releases as $candidate) {
                if ($candidate->package !== 'flex-cms' || $candidate->channel->value !== $remote['channel']) continue;
                $issues = $this->updater->pluginCompatibilityIssues($candidate->version);
                $platformCompatible = \Composer\Semver\Semver::satisfies(PHP_VERSION, $candidate->minimumPhp) && \Composer\Semver\Semver::satisfies($currentVersion, $candidate->compatibleFrom);
                $releases[] = ['version' => $candidate->version->value, 'release_notes' => $candidate->releaseNotes, 'size' => $candidate->size, 'published_at' => $candidate->publishedAt, 'channel' => $candidate->channel->value, 'current' => $candidate->version->value === $currentVersion, 'downgrade' => version_compare($candidate->version->value, $currentVersion, '<'), 'installable' => $platformCompatible && $issues === [], 'blocked_reason' => !$platformCompatible ? 'Релийзът не е съвместим с текущата платформа.' : ($issues !== [] ? implode(' ', array_map(static fn(array $issue): string => sprintf('%s изисква %s или по-нова платформа.', $issue['name'], $issue['required']), $issues)) : null)];
            }
            usort($releases, static fn(array $left, array $right): int => version_compare($right['version'], $left['version']));
        } catch (\Throwable $exception) {
            $remote['error'] = UpdateErrorMessage::forAdmin($exception);
        }

        return $this->responses->json([
            'version' => $currentVersion,
            'remote_update' => $remote,
            'releases' => $releases,
            'history' => array_reverse($this->history->all()),
            'update_jobs' => array_map(static fn($job): array => $job->toArray(), array_reverse($this->jobs->all())),
        ]);
    }
}
