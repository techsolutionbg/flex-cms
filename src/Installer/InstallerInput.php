<?php

declare(strict_types=1);

namespace Flex\Installer;

use Flex\Installer\Exception\InstallerException;

final readonly class InstallerInput
{
    public function __construct(
        public string $siteName,
        public string $siteUrl,
        public string $timezone,
        public string $locale,
        public string $databaseHost,
        public int $databasePort,
        public string $databaseName,
        public string $databaseUsername,
        public string $databasePassword,
        public string $adminName,
        public string $adminEmail,
        public string $adminPassword,
    ) {}

    /** @param array<string, mixed> $values */
    public static function fromArray(array $values): self
    {
        $input = new self(
            self::text($values, 'site_name'),
            rtrim(self::text($values, 'site_url'), '/'),
            self::text($values, 'timezone'),
            self::text($values, 'locale'),
            self::text($values, 'database_host'),
            filter_var($values['database_port'] ?? null, FILTER_VALIDATE_INT) ?: 0,
            self::text($values, 'database_name'),
            self::text($values, 'database_username'),
            (string) ($values['database_password'] ?? ''),
            self::text($values, 'admin_name'),
            strtolower(self::text($values, 'admin_email')),
            (string) ($values['admin_password'] ?? ''),
        );
        $input->validate();

        return $input;
    }

    private function validate(): void
    {
        $errors = [];
        if ($this->siteName === '' || mb_strlen($this->siteName) > 120) {
            $errors[] = 'Site name is required and must not exceed 120 characters.';
        }
        if (filter_var($this->siteUrl, FILTER_VALIDATE_URL) === false || parse_url($this->siteUrl, PHP_URL_SCHEME) !== 'https') {
            $errors[] = 'Site URL must be a valid HTTPS URL.';
        }
        if (!in_array($this->timezone, timezone_identifiers_list(), true)) {
            $errors[] = 'Timezone is invalid.';
        }
        if (preg_match('/^[a-z]{2,3}(?:[_-][A-Z]{2})?$/', $this->locale) !== 1) {
            $errors[] = 'Locale is invalid.';
        }
        if ($this->databaseHost === '' || preg_match('/^[a-zA-Z0-9._:\[\]-]+$/', $this->databaseHost) !== 1) {
            $errors[] = 'Database host is invalid.';
        }
        if ($this->databasePort < 1 || $this->databasePort > 65535) {
            $errors[] = 'Database port must be between 1 and 65535.';
        }
        if (preg_match('/^[a-zA-Z0-9_$-]+$/', $this->databaseName) !== 1) {
            $errors[] = 'Database name contains unsupported characters.';
        }
        if ($this->databaseUsername === '' || strlen($this->databaseUsername) > 128 || str_contains($this->databaseUsername, "\0")) {
            $errors[] = 'Database username is invalid.';
        }
        if ($this->adminName === '' || mb_strlen($this->adminName) > 120) {
            $errors[] = 'Administrator name is required and must not exceed 120 characters.';
        }
        if (filter_var($this->adminEmail, FILTER_VALIDATE_EMAIL) === false) {
            $errors[] = 'Administrator email is invalid.';
        }
        if (strlen($this->adminPassword) < 12) {
            $errors[] = 'Administrator password must contain at least 12 characters.';
        }

        if ($errors !== []) {
            throw new InstallerException(implode(' ', $errors));
        }
    }

    /** @param array<string, mixed> $values */
    private static function text(array $values, string $key): string
    {
        $value = $values[$key] ?? '';

        return is_string($value) ? trim($value) : '';
    }
}
