<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Updates\Jobs\UpdateJobStore;
use PHPUnit\Framework\TestCase;

final class UpdateJobStoreTest extends TestCase
{
    private string $basePath;

    protected function setUp(): void
    {
        $this->basePath = sys_get_temp_dir() . '/flex-update-jobs-' . bin2hex(random_bytes(6));
        mkdir($this->basePath, 0770, true);
    }

    protected function tearDown(): void
    {
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->basePath, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($this->basePath);
    }

    public function testItQueuesOnlyOneEquivalentPendingJob(): void
    {
        $store = new UpdateJobStore($this->basePath);

        $first = $store->queuePlatformUpdate();
        $second = $store->queuePlatformUpdate();

        self::assertSame($first->id, $second->id);
        self::assertCount(1, $store->all());
    }

    public function testItClaimsAndCompletesAJob(): void
    {
        $store = new UpdateJobStore($this->basePath);
        $queued = $store->queuePlatformUpdate(true);
        $running = $store->claimNext();
        self::assertNotNull($running);
        self::assertSame($queued->id, $running->id);

        $completed = $store->complete($running, ['version' => '1.1.0']);

        self::assertSame(UpdateJobStore::STATUS_COMPLETED, $completed->status);
        self::assertSame('1.1.0', $store->all()[0]->result['version']);
    }
}
