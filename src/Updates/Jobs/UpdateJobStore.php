<?php

declare(strict_types=1);

namespace Flex\Updates\Jobs;

use Flex\Updates\Exception\PlatformUpdateException;

final class UpdateJobStore
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_RUNNING = 'running';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    private const STALE_AFTER = 900;

    public function __construct(private readonly string $basePath) {}

    public function queuePlatformUpdate(bool $dryRun = false): UpdateJob
    {
        return $this->withLock(function () use ($dryRun): UpdateJob {
            $jobs = $this->read();
            foreach ($jobs as $job) {
                if ($job->type === 'platform' && in_array($job->status, [self::STATUS_PENDING, self::STATUS_RUNNING], true) && $job->dryRun === $dryRun) {
                    return $job;
                }
            }
            $job = new UpdateJob('update-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(5)), 'platform', self::STATUS_PENDING, $dryRun, gmdate(DATE_ATOM));
            $jobs[] = $job;
            $this->write($jobs);

            return $job;
        });
    }

    public function queuePluginUpdate(string $pluginId): UpdateJob
    {
        return $this->withLock(function () use ($pluginId): UpdateJob {
            $jobs = $this->read();
            foreach ($jobs as $job) {
                if ($job->type === 'plugin' && $job->packageId === $pluginId && in_array($job->status, [self::STATUS_PENDING, self::STATUS_RUNNING], true)) return $job;
            }
            $job = new UpdateJob('plugin-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(5)), 'plugin', self::STATUS_PENDING, false, gmdate(DATE_ATOM), packageId: $pluginId);
            $jobs[] = $job;
            $this->write($jobs);

            return $job;
        });
    }

    public function claimNext(): ?UpdateJob
    {
        return $this->withLock(function (): ?UpdateJob {
            $jobs = $this->recoverStale($this->read());
            foreach ($jobs as $index => $job) {
                if ($job->status !== self::STATUS_PENDING) {
                    continue;
                }
                $claimed = new UpdateJob($job->id, $job->type, self::STATUS_RUNNING, $job->dryRun, $job->createdAt, gmdate(DATE_ATOM), packageId: $job->packageId);
                $jobs[$index] = $claimed;
                $this->write($jobs);

                return $claimed;
            }
            $this->write($jobs);

            return null;
        });
    }

    /** @param array<string, mixed> $result */
    public function complete(UpdateJob $job, array $result = []): UpdateJob
    {
        return $this->replace($job, new UpdateJob($job->id, $job->type, self::STATUS_COMPLETED, $job->dryRun, $job->createdAt, $job->startedAt, gmdate(DATE_ATOM), null, $result, $job->packageId));
    }

    public function fail(UpdateJob $job, string $error): UpdateJob
    {
        return $this->replace($job, new UpdateJob($job->id, $job->type, self::STATUS_FAILED, $job->dryRun, $job->createdAt, $job->startedAt, gmdate(DATE_ATOM), $error, [], $job->packageId));
    }

    /** @return list<UpdateJob> */
    public function all(): array
    {
        return $this->read();
    }

    private function replace(UpdateJob $target, UpdateJob $replacement): UpdateJob
    {
        return $this->withLock(function () use ($target, $replacement): UpdateJob {
            $jobs = $this->read();
            foreach ($jobs as $index => $job) {
                if ($job->id === $target->id) {
                    $jobs[$index] = $replacement;
                    $this->write($jobs);

                    return $replacement;
                }
            }
            throw new PlatformUpdateException(sprintf('Update job "%s" no longer exists.', $target->id));
        });
    }

    /** @return list<UpdateJob> */
    private function read(): array
    {
        if (!is_file($this->path())) {
            return [];
        }
        try {
            $data = json_decode((string) file_get_contents($this->path()), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new PlatformUpdateException('The update job store contains invalid JSON.', 0, $exception);
        }
        if (!is_array($data)) {
            throw new PlatformUpdateException('The update job store must contain a JSON array.');
        }

        return array_values(array_filter(array_map(static fn(mixed $job): ?UpdateJob => is_array($job) ? UpdateJob::fromArray($job) : null, $data)));
    }

    /** @param list<UpdateJob> $jobs */
    private function write(array $jobs): void
    {
        $directory = dirname($this->path());
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new PlatformUpdateException('The update job directory cannot be created.');
        }
        $temporary = $this->path() . '.tmp-' . bin2hex(random_bytes(4));
        $data = array_map(static fn(UpdateJob $job): array => $job->toArray(), $jobs);
        if (file_put_contents($temporary, json_encode($data, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL, LOCK_EX) === false || !rename($temporary, $this->path())) {
            @unlink($temporary);
            throw new PlatformUpdateException('The update job store cannot be written.');
        }
    }

    /** @param list<UpdateJob> $jobs */
    private function recoverStale(array $jobs): array
    {
        $now = time();
        return array_map(static function (UpdateJob $job) use ($now): UpdateJob {
            $started = $job->startedAt === null ? false : strtotime($job->startedAt);
            if ($job->status !== self::STATUS_RUNNING || $started === false || $now - $started <= self::STALE_AFTER) {
                return $job;
            }

            return new UpdateJob($job->id, $job->type, self::STATUS_PENDING, $job->dryRun, $job->createdAt, null, null, 'Previous worker timed out; job was requeued.', [], $job->packageId);
        }, $jobs);
    }

    private function path(): string
    {
        return $this->basePath . '/storage/updates/jobs.json';
    }

    private function withLock(callable $callback): mixed
    {
        $directory = dirname($this->basePath . '/storage/updates/jobs.lock');
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new PlatformUpdateException('The update job lock directory cannot be created.');
        }
        $handle = fopen($directory . '/jobs.lock', 'c');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            throw new PlatformUpdateException('The update job store is locked.');
        }
        try {
            return $callback();
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
