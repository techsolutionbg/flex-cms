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
        public ?string $signature,
        public ?string $signatureAlgorithm,
        public ?string $keyId,
        /** @var list<string> */
        public array $requiredExtensions,
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
        $signature = $data['signature'] ?? null;
        $signatureAlgorithm = $data['signature_algorithm'] ?? null;
        $keyId = $data['key_id'] ?? null;
        $requiredExtensions = $data['required_extensions'] ?? [];

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

        if (!is_array($remove) || !is_bool($runMigrations)
            || ($signature !== null && !is_string($signature))
            || ($signatureAlgorithm !== null && !is_string($signatureAlgorithm))
            || ($keyId !== null && !is_string($keyId))
            || !is_array($requiredExtensions)) {
            throw new InvalidPlatformPackage('Invalid remove or run_migrations value.');
        }

        $validatedFiles = [];
        foreach ($files as $path => $checksum) {
            if (!is_string($path) || !is_string($checksum) || preg_match('/^[a-f0-9]{64}$/', $checksum) !== 1) {
                throw new InvalidPlatformPackage('Every package file must have a valid SHA-256 checksum.');
            }

            $validatedFiles[$path] = $checksum;
        }

        if ($runMigrations && !array_filter(array_keys($validatedFiles), static fn(string $path): bool => str_starts_with($path, 'database/migrations/'))) {
            throw new InvalidPlatformPackage('A package with run_migrations=true must contain database migration files.');
        }

        $validatedRemove = [];
        foreach ($remove as $path) {
            if (!is_string($path)) {
                throw new InvalidPlatformPackage('Every removal path must be a string.');
            }

            $validatedRemove[] = $path;
        }

        $validatedExtensions = [];
        foreach ($requiredExtensions as $extension) {
            if (!is_string($extension) || preg_match('/^[a-zA-Z0-9_.-]+$/', $extension) !== 1) {
                throw new InvalidPlatformPackage('Every required PHP extension must be a valid name.');
            }
            $validatedExtensions[] = $extension;
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
            signature: $signature,
            signatureAlgorithm: $signatureAlgorithm,
            keyId: $keyId,
            requiredExtensions: array_values(array_unique($validatedExtensions)),
        );
    }

    /** @return array<string, mixed> */
    public function signingData(): array
    {
        $data = [
            'schema' => $this->schema,
            'package' => $this->package,
            'version' => $this->version->value,
            'minimum_php' => $this->minimumPhp,
            'compatible_from' => $this->compatibleFrom,
            'files' => $this->files,
            'remove' => $this->remove,
            'run_migrations' => $this->runMigrations,
        ];
        if ($this->signatureAlgorithm !== null) {
            $data['signature_algorithm'] = $this->signatureAlgorithm;
        }
        if ($this->keyId !== null) {
            $data['key_id'] = $this->keyId;
        }
        if ($this->requiredExtensions !== []) {
            $data['required_extensions'] = $this->requiredExtensions;
        }

        return $data;
    }
}
