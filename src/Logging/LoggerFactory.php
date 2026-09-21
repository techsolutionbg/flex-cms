<?php

declare(strict_types=1);

namespace Flex\Logging;

use Flex\Configuration\ProjectPaths;
use Flex\Configuration\Exception\InvalidConfigurationValue;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;
use Psr\Log\LoggerInterface;

final readonly class LoggerFactory
{
    public function __construct(
        private ConfigRepositoryInterface $configuration,
        private ProjectPaths $paths,
    ) {
    }

    public function create(): LoggerInterface
    {
        $logger = new Logger('flex-cms');
        $configuredLevel = strtolower($this->configuration->string('logging.level'));
        $level = match ($configuredLevel) {
            'debug' => Level::Debug,
            'info' => Level::Info,
            'notice' => Level::Notice,
            'warning' => Level::Warning,
            'error' => Level::Error,
            'critical' => Level::Critical,
            'alert' => Level::Alert,
            'emergency' => Level::Emergency,
            default => throw new InvalidConfigurationValue(sprintf('Unsupported logging level "%s".', $configuredLevel)),
        };
        $logPath = $this->writableLogTarget($this->paths->storage('logs/flex-cms.log'));

        if ($this->configuration->string('logging.channel') === 'daily') {
            $logger->pushHandler(new RotatingFileHandler(
                $logPath,
                $this->configuration->int('logging.max_files'),
                $level,
            ));
        } else {
            $logger->pushHandler(new StreamHandler($logPath, $level));
        }

        return $logger;
    }

    private function writableLogTarget(string $logPath): string
    {
        $directory = dirname($logPath);

        if (!is_dir($directory) && !@mkdir($directory, 0775, true) && !is_dir($directory)) {
            return 'php://stderr';
        }

        if (!is_writable($directory)) {
            return 'php://stderr';
        }

        if (is_file($logPath) && !is_writable($logPath)) {
            return 'php://stderr';
        }

        return $logPath;
    }
}
