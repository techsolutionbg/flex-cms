<?php

declare(strict_types=1);

namespace Flex\Configuration;

use Flex\Configuration\Exception\ConfigurationValidationFailed;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final class EnvironmentValidator
{
    public function validate(ConfigRepositoryInterface $configuration): void
    {
        $errors = [];

        $this->requireNonEmpty($configuration, 'app.name', $errors);
        $environment = $this->string($configuration, 'app.environment', $errors);
        if ($environment !== null && !in_array($environment, ['local', 'testing', 'staging', 'production'], true)) {
            $errors[] = 'app.environment must be local, testing, staging or production.';
        }

        $url = $this->string($configuration, 'app.url', $errors);
        if ($url !== null && (filter_var($url, FILTER_VALIDATE_URL) === false || !in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true))) {
            $errors[] = 'app.url must be a valid HTTP or HTTPS URL.';
        }

        $key = $this->string($configuration, 'app.key', $errors);
        if ($key !== null && preg_match('/^[a-f0-9]{64}$/', $key) !== 1) {
            $errors[] = 'app.key must be a random 64-character hexadecimal value.';
        }

        $timezone = $this->string($configuration, 'app.timezone', $errors);
        if ($timezone !== null && !in_array($timezone, timezone_identifiers_list(), true)) {
            $errors[] = 'app.timezone must be a valid PHP timezone identifier.';
        }

        foreach (['app.locale', 'app.fallback_locale'] as $keyName) {
            $locale = $this->string($configuration, $keyName, $errors);
            if ($locale !== null && preg_match('/^[a-z]{2,3}(?:[_-][A-Z]{2})?$/', $locale) !== 1) {
                $errors[] = sprintf('%s must be a valid locale identifier.', $keyName);
            }
        }

        if ($environment === 'production') {
            if ($this->bool($configuration, 'app.debug', $errors) === true) {
                $errors[] = 'app.debug must be false in production.';
            }
            if ($this->bool($configuration, 'app.force_https', $errors) !== true) {
                $errors[] = 'app.force_https must be true in production.';
            }
        }

        $defaultConnection = $this->string($configuration, 'database.default', $errors);
        if ($defaultConnection !== null && !$configuration->has('database.connections.' . $defaultConnection)) {
            $errors[] = sprintf('database.default references the undefined connection "%s".', $defaultConnection);
        }

        if ($defaultConnection !== null && $this->string($configuration, 'database.connections.' . $defaultConnection . '.driver', $errors) !== 'mysql') {
            $errors[] = 'The default database driver must be mysql.';
        }

        $connectionPrefix = 'database.connections.' . ($defaultConnection ?? 'mysql') . '.';
        foreach (['host', 'database', 'username', 'charset', 'collation'] as $keyName) {
            $keyName = $connectionPrefix . $keyName;
            $this->requireNonEmpty($configuration, $keyName, $errors);
        }
        $port = $this->int($configuration, $connectionPrefix . 'port', $errors);
        if ($port !== null && ($port < 1 || $port > 65535)) {
            $errors[] = $connectionPrefix . 'port must be between 1 and 65535.';
        }

        $sameSite = $this->string($configuration, 'session.same_site', $errors);
        if ($sameSite !== null && !in_array($sameSite, ['lax', 'strict', 'none'], true)) {
            $errors[] = 'session.same_site must be lax, strict or none.';
        }
        if ($sameSite === 'none' && $this->bool($configuration, 'session.secure', $errors) !== true) {
            $errors[] = 'session.secure must be true when session.same_site is none.';
        }

        foreach (['paths.storage', 'paths.plugins', 'paths.themes', 'paths.public_media'] as $keyName) {
            $path = $this->string($configuration, $keyName, $errors);
            if ($path !== null && !$this->isSafeRelativePath($path)) {
                $errors[] = sprintf('%s must be a safe path relative to the project root.', $keyName);
            }
        }

        if ($errors !== []) {
            throw new ConfigurationValidationFailed(array_values(array_unique($errors)));
        }
    }

    /** @param list<string> $errors */
    private function requireNonEmpty(ConfigRepositoryInterface $configuration, string $key, array &$errors): void
    {
        $value = $this->string($configuration, $key, $errors);
        if ($value !== null && trim($value) === '') {
            $errors[] = sprintf('%s cannot be empty.', $key);
        }
    }

    /** @param list<string> $errors */
    private function string(ConfigRepositoryInterface $configuration, string $key, array &$errors): ?string
    {
        try {
            return $configuration->string($key);
        } catch (\Throwable $exception) {
            $errors[] = $exception->getMessage();

            return null;
        }
    }

    /** @param list<string> $errors */
    private function int(ConfigRepositoryInterface $configuration, string $key, array &$errors): ?int
    {
        try {
            return $configuration->int($key);
        } catch (\Throwable $exception) {
            $errors[] = $exception->getMessage();

            return null;
        }
    }

    /** @param list<string> $errors */
    private function bool(ConfigRepositoryInterface $configuration, string $key, array &$errors): ?bool
    {
        try {
            return $configuration->bool($key);
        } catch (\Throwable $exception) {
            $errors[] = $exception->getMessage();

            return null;
        }
    }

    private function isSafeRelativePath(string $path): bool
    {
        if ($path === '' || str_starts_with($path, '/') || str_contains($path, '\\') || str_contains($path, "\0")) {
            return false;
        }

        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return false;
            }
        }

        return true;
    }
}
