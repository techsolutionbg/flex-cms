<?php

declare(strict_types=1);

namespace Flex\Auth;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final readonly class LoginThrottle
{
    private const MAX_ATTEMPTS = 5;
    private const WINDOW_SECONDS = 900;

    public function __construct(
        private ProjectPaths $paths,
        private ConfigRepositoryInterface $configuration,
    ) {}

    public function tooManyAttempts(string $email, string $ipAddress): bool
    {
        return count($this->attempts($email, $ipAddress)) >= self::MAX_ATTEMPTS;
    }

    public function recordFailure(string $email, string $ipAddress): void
    {
        $attempts = $this->attempts($email, $ipAddress);
        $attempts[] = time();
        $this->write($email, $ipAddress, $attempts);
    }

    public function clear(string $email, string $ipAddress): void
    {
        @unlink($this->path($email, $ipAddress));
    }

    /** @return list<int> */
    private function attempts(string $email, string $ipAddress): array
    {
        $contents = @file_get_contents($this->path($email, $ipAddress));
        if (!is_string($contents)) {
            return [];
        }

        $decoded = json_decode($contents, true);
        if (!is_array($decoded)) {
            return [];
        }

        $threshold = time() - self::WINDOW_SECONDS;

        return array_values(array_filter($decoded, static fn(mixed $attempt): bool => is_int($attempt) && $attempt >= $threshold));
    }

    /** @param list<int> $attempts */
    private function write(string $email, string $ipAddress, array $attempts): void
    {
        $path = $this->path($email, $ipAddress);
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new \RuntimeException('The authentication throttle directory cannot be created.');
        }
        $json = json_encode($attempts, JSON_THROW_ON_ERROR);
        if (file_put_contents($path, $json, LOCK_EX) === false) {
            throw new \RuntimeException('The authentication throttle state cannot be written.');
        }
    }

    private function path(string $email, string $ipAddress): string
    {
        $key = hash_hmac('sha256', strtolower($email) . '|' . $ipAddress, $this->configuration->string('app.key'));

        return $this->paths->storage('cache/auth/' . $key . '.json');
    }
}
