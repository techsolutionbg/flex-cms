<?php

declare(strict_types=1);

namespace Flex\Logging;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;

/**
 * Append-only journal of server-side operation failures (platform, plugins, themes).
 */
final class OperationErrorJournal
{
    private const DEFAULT_MAX_ENTRIES = 500;

    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
        private readonly ProjectPaths $paths,
    ) {}

    /**
     * @param array<string, mixed> $context
     */
    public function record(
        string $scope,
        string $component,
        string $operation,
        string $message,
        ?\Throwable $exception = null,
        array $context = [],
    ): void {
        $entry = [
            'id' => bin2hex(random_bytes(8)),
            'recorded_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'scope' => $scope,
            'component' => $component,
            'operation' => $operation,
            'message' => $this->truncate($message, 4000),
            'exception_class' => $exception !== null ? $exception::class : null,
            'file' => $exception?->getFile(),
            'line' => $exception?->getLine(),
            'trace' => $exception !== null ? $this->truncate($exception->getTraceAsString(), 12000) : null,
            'context' => $this->sanitizeContext($context),
        ];
        $line = json_encode($entry, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE) . "\n";
        $path = $this->path();
        $this->ensureDirectory($path);
        if (@file_put_contents($path, $line, FILE_APPEND | LOCK_EX) === false) {
            return;
        }
        $this->trim($path);
    }

    public function recordThrowable(
        \Throwable $exception,
        string $scope,
        string $component,
        string $operation,
        array $context = [],
    ): void {
        $this->record($scope, $component, $operation, $exception->getMessage(), $exception, $context);
    }

    /** @return list<array<string, mixed>> */
    public function recent(int $limit = 50): array
    {
        $limit = max(1, min(200, $limit));
        $path = $this->path();
        if (!is_file($path) || !is_readable($path)) {
            return [];
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false || $lines === []) {
            return [];
        }
        $entries = [];
        foreach (array_reverse($lines) as $line) {
            try {
                /** @var array<string, mixed> $decoded */
                $decoded = json_decode($line, true, 64, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                continue;
            }
            $entries[] = $decoded;
            if (count($entries) >= $limit) {
                break;
            }
        }

        return $entries;
    }

    public function clear(): void
    {
        $path = $this->path();
        if (is_file($path)) {
            file_put_contents($path, '', LOCK_EX);
        }
    }

    public function count(): int
    {
        $path = $this->path();
        if (!is_file($path) || !is_readable($path)) {
            return 0;
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        return $lines === false ? 0 : count($lines);
    }

    /** @return array{path: string, content: string, bytes: int, truncated: bool} */
    public function fileContents(int $maxBytes = 524_288): array
    {
        $displayPath = 'storage/logs/operation-errors.jsonl';
        $path = $this->path();
        if (!is_file($path) || !is_readable($path)) {
            return ['path' => $displayPath, 'content' => '', 'bytes' => 0, 'truncated' => false];
        }
        $bytes = filesize($path);
        if ($bytes === false || $bytes === 0) {
            return ['path' => $displayPath, 'content' => '', 'bytes' => 0, 'truncated' => false];
        }
        $maxBytes = max(4096, min(2_097_152, $maxBytes));
        $truncated = $bytes > $maxBytes;
        if ($truncated) {
            $handle = fopen($path, 'rb');
            if ($handle === false) {
                return ['path' => $displayPath, 'content' => '', 'bytes' => 0, 'truncated' => false];
            }
            fseek($handle, -$maxBytes, SEEK_END);
            $content = stream_get_contents($handle) ?: '';
            fclose($handle);
            $content = "… (показани последните {$maxBytes} байта от {$bytes})\n" . $content;
        } else {
            $content = file_get_contents($path);
            if ($content === false) {
                $content = '';
            }
        }

        return [
            'path' => $displayPath,
            'content' => $content,
            'bytes' => $bytes,
            'truncated' => $truncated,
        ];
    }

    private function path(): string
    {
        $default = $this->paths->storage('logs/operation-errors.jsonl');
        if (!$this->configuration->has('logging.operation_errors.path')) {
            return $default;
        }
        $configured = trim($this->configuration->string('logging.operation_errors.path'));
        if ($configured === '') {
            return $default;
        }
        $base = str_replace('\\', '/', $this->paths->base());
        $candidate = str_replace('\\', '/', $configured);

        return str_starts_with($candidate, $base) ? $configured : $default;
    }

    private function maxEntries(): int
    {
        $max = $this->configuration->get('logging.operation_errors.max_entries', self::DEFAULT_MAX_ENTRIES);
        if (!is_int($max) && !(is_string($max) && ctype_digit($max))) {
            return self::DEFAULT_MAX_ENTRIES;
        }
        $max = (int) $max;

        return $max > 0 ? min(5000, $max) : self::DEFAULT_MAX_ENTRIES;
    }

    private function ensureDirectory(string $path): void
    {
        $directory = dirname($path);
        if (is_dir($directory)) {
            return;
        }
        @mkdir($directory, 0775, true);
    }

    private function trim(string $path): void
    {
        $max = $this->maxEntries();
        $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false || count($lines) <= $max) {
            return;
        }
        $lines = array_slice($lines, -$max);
        file_put_contents($path, implode("\n", $lines) . "\n", LOCK_EX);
    }

    /** @param array<string, mixed> $context */
    private function sanitizeContext(array $context): array
    {
        $result = [];
        foreach ($context as $key => $value) {
            if (!is_string($key) || $key === '') {
                continue;
            }
            if (in_array(strtolower($key), ['password', 'token', 'secret', 'authorization'], true)) {
                $result[$key] = '[redacted]';
                continue;
            }
            if (is_scalar($value) || $value === null) {
                $result[$key] = $value;
                continue;
            }
            if (is_array($value)) {
                $result[$key] = $this->sanitizeContext($value);
            }
        }

        return $result;
    }

    private function truncate(string $value, int $max): string
    {
        if (strlen($value) <= $max) {
            return $value;
        }

        return substr($value, 0, $max - 1) . '…';
    }
}
