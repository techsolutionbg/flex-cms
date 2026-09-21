<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Composer\Semver\VersionParser;
use Flex\Updates\Exception\InvalidPlatformPackage;

final readonly class PlatformPackageManifest
{
    /**
     * @param array<string, string> $files
     * @param list<string>          $remove
     */
    public function __construct(
        public int $schema,
        public string $package,
        public PlatformVersion $version,
        public string $minimumPhp,
        public string $compatibleFrom,
        public array $files,
        public array $remove,
        public bool $runMigrations,
    ) {
    }

    /** @param array<mixed> $data */
    public static function fromArray(array $data): self
    {
        $schema = $data['schema'] ?? null;
        $package = $data['package'] ?? null;
        $version = $data['version'] ?? null;
        $minimumPhp = $data['minimum_php'] ?? null;
        $compatibleFrom = $data['compatible_from'] ?? null;
        $files = $data['files'] ?? null;
        $remove = $data['remove'] ?? [];
        $runMigrations = $data['run_migrations'] ?? false;

        if ($schema !== 1) {
            throw new InvalidPlatformPackage('Unsupported platform package schema.');
        }

        if ($package !== 'flex-cms') {
            throw new InvalidPlatformPackage('The package is not a Flex CMS platform package.');
        }

        if (!is_string($version) || !is_string($minimumPhp) || !is_string($compatibleFrom)) {
            throw new InvalidPlatformPackage('The version compatibility fields are required.');
        }

        try {
            $parser = new VersionParser();
            $parser->parseConstraints($minimumPhp);
            $parser->parseConstraints($compatibleFrom);
        } catch (\UnexpectedValueException $exception) {
            throw new InvalidPlatformPackage('The package contains an invalid version constraint.', 0, $exception);
        }

        if (!is_array($files) || $files === []) {
            throw new InvalidPlatformPackage('The package must contain at least one file.');
        }

        if (!is_array($remove) || !is_bool($runMigrations)) {
            throw new InvalidPlatformPackage('Invalid remove or run_migrations value.');
        }

        $validatedFiles = [];
        foreach ($files as $path => $checksum) {
            if (!is_string($path) || !is_string($checksum) || preg_match('/^[a-f0-9]{64}$/', $checksum) !== 1) {
                throw new InvalidPlatformPackage('Every package file must have a valid SHA-256 checksum.');
            }

            $validatedFiles[$path] = $checksum;
        }

        $validatedRemove = [];
        foreach ($remove as $path) {
            if (!is_string($path)) {
                throw new InvalidPlatformPackage('Every removal path must be a string.');
            }

            $validatedRemove[] = $path;
        }

        return new self(
            schema: $schema,
            package: $package,
            version: new PlatformVersion($version),
            minimumPhp: $minimumPhp,
            compatibleFrom: $compatibleFrom,
            files: $validatedFiles,
            remove: $validatedRemove,
            runMigrations: $runMigrations,
        );
    }
}
