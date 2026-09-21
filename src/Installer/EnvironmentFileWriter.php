<?php

declare(strict_types=1);

namespace Flex\Installer;

use Flex\Installer\Contracts\EnvironmentWriterInterface;
use Flex\Installer\Exception\InstallerException;

final readonly class EnvironmentFileWriter implements EnvironmentWriterInterface
{
    public function __construct(
        private string $basePath,
    ) {}

    /** @param array<string, string> $values */
    public function write(array $values): void
    {
        $target = $this->basePath . '/.env';
        if (file_exists($target)) {
            throw new InstallerException('The environment file already exists.');
        }

        $template = @file_get_contents($this->basePath . '/.env.example');
        if (!is_string($template)) {
            throw new InstallerException('The .env.example template cannot be read.');
        }

        foreach ($values as $key => $value) {
            $encoded = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $pattern = '/^' . preg_quote($key, '/') . '=.*$/m';
            if (preg_match($pattern, $template) !== 1) {
                throw new InstallerException(sprintf('Environment key "%s" is missing from .env.example.', $key));
            }
            $template = (string) preg_replace($pattern, $key . '=' . $encoded, $template, 1);
        }

        $temporary = $target . '.installing';
        if (file_put_contents($temporary, $template, LOCK_EX) === false || !@rename($temporary, $target)) {
            @unlink($temporary);
            throw new InstallerException('The .env file could not be written.');
        }

        @chmod($target, 0600);
    }

    public function remove(): void
    {
        @unlink($this->basePath . '/.env');
        @unlink($this->basePath . '/.env.installing');
    }
}
