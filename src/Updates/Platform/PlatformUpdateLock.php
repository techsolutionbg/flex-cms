<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\PlatformUpdateException;
use Flex\Updates\Exception\PlatformUpdateLocked;

final class PlatformUpdateLock
{
    /** @var resource|null */
    private $handle = null;

    private function __construct(private readonly string $path) {}

    public static function acquire(string $basePath): self
    {
        $directory = $basePath . '/storage/tmp';
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new PlatformUpdateException('The platform update lock directory cannot be created.');
        }

        $lock = new self($directory . '/platform-update.lock');
        $handle = @fopen($lock->path, 'c+');
        if ($handle === false) {
            throw new PlatformUpdateException('The platform update lock cannot be opened.');
        }
        $lock->handle = $handle;
        if (!flock($lock->handle, LOCK_EX | LOCK_NB)) {
            fclose($lock->handle);
            $lock->handle = null;
            throw new PlatformUpdateLocked('Another platform installation is already running.');
        }

        return $lock;
    }

    public function release(): void
    {
        if ($this->handle !== null) {
            flock($this->handle, LOCK_UN);
            fclose($this->handle);
            $this->handle = null;
        }
    }

    public function __destruct()
    {
        $this->release();
    }
}
