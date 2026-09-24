<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extensions\Exception\InvalidPluginManifest;

final readonly class PluginManifest
{
    /**
     * @param array<string, string> $autoload
     * @param list<string> $permissions
     * @param array<string, string> $dependencies
     * @param array{scripts?: list<string>, styles?: list<string>} $frontend
     * @param array<string, mixed> $metadata
     */
    public function __construct(
        public string $id,
        public string $name,
        public string $version,
        public string $entrypoint,
        public string $description = '',
        public string $minimumPlatformVersion = '',
        public array $autoload = [],
        public array $permissions = [],
        public array $dependencies = [],
        public array $frontend = [],
        public array $metadata = [],
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $id = self::requiredString($data, 'id');
        $name = self::requiredString($data, 'name');
        $version = self::requiredString($data, 'version');
        $entrypoint = self::requiredString($data, 'entrypoint');

        self::assertPattern($id, '/^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/', 'id', 'vendor/name format.');
        self::assertPattern($version, '/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/', 'version', 'semantic version format.');
        self::assertClassName($entrypoint, 'entrypoint');

        $minimumPlatformVersion = self::optionalString($data, 'minimum_platform_version');
        if ($minimumPlatformVersion !== '') {
            self::assertPattern($minimumPlatformVersion, '/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/', 'minimum_platform_version', 'semantic version format.');
        }

        $autoload = self::stringMap($data, 'autoload', true);
        /** @var list<string> $permissions */
        $permissions = self::stringList($data, 'permissions');
        $dependencies = self::stringMap($data, 'dependencies');
        $metadata = $data['metadata'] ?? [];
        if (!is_array($metadata)) {
            throw new InvalidPluginManifest('Manifest field "metadata" must be an object.');
        }
        $frontend = self::frontend($data['frontend'] ?? []);

        return new self(
            id: $id,
            name: $name,
            version: $version,
            entrypoint: $entrypoint,
            description: self::optionalString($data, 'description'),
            minimumPlatformVersion: $minimumPlatformVersion,
            autoload: $autoload,
            permissions: $permissions,
            dependencies: $dependencies,
            frontend: $frontend,
            metadata: $metadata,
        );
    }

    public static function fromFile(string $path): self
    {
        if (!is_file($path) || !is_readable($path)) {
            throw new InvalidPluginManifest(sprintf('Plugin manifest "%s" does not exist or is not readable.', $path));
        }

        try {
            $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new InvalidPluginManifest(sprintf('Plugin manifest "%s" contains invalid JSON.', $path), previous: $exception);
        }

        if (!is_array($data)) {
            throw new InvalidPluginManifest(sprintf('Plugin manifest "%s" must contain a JSON object.', $path));
        }

        return self::fromArray($data);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'version' => $this->version,
            'entrypoint' => $this->entrypoint,
            'description' => $this->description,
            'minimum_platform_version' => $this->minimumPlatformVersion,
            'autoload' => $this->autoload,
            'permissions' => $this->permissions,
            'dependencies' => $this->dependencies,
            'frontend' => $this->frontend,
            'metadata' => $this->metadata,
        ];
    }

    /** @param array<string, mixed> $data */
    private static function requiredString(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || trim($value) === '') {
            throw new InvalidPluginManifest(sprintf('Manifest field "%s" must be a non-empty string.', $key));
        }

        return trim($value);
    }

    /** @param array<string, mixed> $data */
    private static function optionalString(array $data, string $key): string
    {
        $value = $data[$key] ?? '';
        if (!is_string($value)) {
            throw new InvalidPluginManifest(sprintf('Manifest field "%s" must be a string.', $key));
        }

        return trim($value);
    }

    private static function assertPattern(string $value, string $pattern, string $key, string $description): void
    {
        if (preg_match($pattern, $value) !== 1) {
            throw new InvalidPluginManifest(sprintf('Manifest field "%s" must use %s', $key, $description));
        }
    }

    private static function assertClassName(string $value, string $key): void
    {
        if (preg_match('/^(?:[A-Za-z_][A-Za-z0-9_]*\\\\)*[A-Za-z_][A-Za-z0-9_]*$/', $value) !== 1) {
            throw new InvalidPluginManifest(sprintf('Manifest field "%s" must contain a valid PHP class name.', $key));
        }
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    private static function stringMap(array $data, string $key, bool $psr4 = false): array
    {
        $value = $data[$key] ?? [];
        if (!is_array($value)) {
            throw new InvalidPluginManifest(sprintf('Manifest field "%s" must be an object.', $key));
        }

        $result = [];
        foreach ($value as $mapKey => $mapValue) {
            if (!is_string($mapKey) || !is_string($mapValue) || $mapValue === '') {
                throw new InvalidPluginManifest(sprintf('Manifest field "%s" must contain only string key/value pairs.', $key));
            }
            if ($psr4 && preg_match('/^(?:[A-Za-z_][A-Za-z0-9_]*\\\\)*$/', $mapKey) !== 1) {
                throw new InvalidPluginManifest(sprintf('Manifest field "%s" contains an invalid PSR-4 namespace.', $key));
            }
            if ($psr4 && (str_starts_with($mapValue, '/') || str_contains($mapValue, '..'))) {
                throw new InvalidPluginManifest(sprintf('Manifest field "%s" contains an unsafe path.', $key));
            }
            $result[$mapKey] = $mapValue;
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $data
     * @return list<string>
     */
    private static function stringList(array $data, string $key): array
    {
        $value = $data[$key] ?? [];
        if (!is_array($value)) {
            throw new InvalidPluginManifest(sprintf('Manifest field "%s" must be an array of strings.', $key));
        }

        foreach ($value as $item) {
            if (!is_string($item) || trim($item) === '') {
                throw new InvalidPluginManifest(sprintf('Manifest field "%s" must contain only non-empty strings.', $key));
            }
        }

        /** @var list<string> $result */
        $result = array_values(array_unique(array_map('trim', $value)));

        return $result;
    }

    /** @return array{scripts: list<string>, styles: list<string>} */
    private static function frontend(mixed $value): array
    {
        if (!is_array($value)) {
            throw new InvalidPluginManifest('Manifest field "frontend" must be an object.');
        }

        $result = ['scripts' => [], 'styles' => []];
        foreach (['scripts', 'styles'] as $type) {
            $assets = $value[$type] ?? [];
            if (!is_array($assets)) {
                throw new InvalidPluginManifest(sprintf('Manifest field "frontend.%s" must be an array of paths.', $type));
            }
            foreach ($assets as $asset) {
                if (!is_string($asset) || $asset === '' || str_starts_with($asset, '/') || str_contains($asset, '..') || preg_match('/\A[A-Za-z0-9_\/.\-]+\z/D', $asset) !== 1) {
                    throw new InvalidPluginManifest(sprintf('Manifest field "frontend.%s" contains an unsafe asset path.', $type));
                }
                $result[$type][] = $asset;
            }
        }

        return $result;
    }
}
