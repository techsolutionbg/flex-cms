<?php

declare(strict_types=1);

namespace Flex\Updates\Jobs;

use Flex\Updates\Remote\RemotePlatformUpdater;
use Flex\Updates\Remote\RemotePluginUpdater;

final class UpdateJobProcessor
{
    public function __construct(private readonly UpdateJobStore $jobs, private readonly RemotePlatformUpdater $platformUpdater, private readonly RemotePluginUpdater $pluginUpdater) {}

    public function processNext(): ?UpdateJob
    {
        $job = $this->jobs->claimNext();
        if ($job === null) {
            return null;
        }
        try {
            if ($job->type === 'platform') {
                $result = $this->platformUpdater->update($job->dryRun);
                return $this->jobs->complete($job, ['version' => $result->release->version->value, 'from' => $result->installation->from->value, 'to' => $result->installation->to->value, 'dry_run' => $result->installation->dryRun]);
            }
            if ($job->type === 'plugin' && $job->packageId !== null) {
                return $this->jobs->complete($job, $this->pluginUpdater->update($job->packageId));
            }

            return $this->jobs->fail($job, sprintf('Unsupported update job type "%s".', $job->type));
        } catch (\Throwable $exception) {
            return $this->jobs->fail($job, $exception->getMessage());
        }
    }
}
