<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use RuntimeException;
use ZipArchive;

final readonly class PlatformPackageBuilder
{
    /** @var list<string> */
    private const DIRECTORIES = ['bin', 'config', 'contracts', 'database', 'public', 'resources', 'src', 'vendor'];

    public function __construct(
        private string $basePath,
        private PlatformVersionRegistry $registry,
    ) {
    }

    public function build(PlatformPackageBuildOptions $options): PlatformPackageBuildResult
    {
        $current = $this->registry->current();
        $version = new PlatformVersion($options->version ?? $current->value);
        $compatibleFrom = $options->compatibleFrom ?? sprintf('>=%s <%d.0.0', $current->value, $this->major($current->value) + 1);
        $outputPath = $options->outputPath ?? sprintf('%s/releases/%s/flex-cms-%s%s.zip', $this->basePath, $version->value, $version->value, $options->privateKeyPath === null ? '-unsigned' : '');
        $outputPath = $this->absolutePath($outputPath);
        $staging = sys_get_temp_dir() . '/flex-cms-platform-build-' . bin2hex(random_bytes(8));

        try {
            $payload = $staging . '/payload';
            if (!mkdir($payload, 0770, true) && !is_dir($payload)) {
                throw new RuntimeException('The release staging directory cannot be created.');
            }
            $files = $this->copySourceTree($payload, $version);
            if ($files === []) {
                throw new RuntimeException('The release package contains no files.');
            }

            ksort($files);
            $manifest = [
                'schema' => 1,
                'package' => 'flex-cms',
                'version' => $version->value,
                'minimum_php' => $options->minimumPhp,
                'compatible_from' => $compatibleFrom,
                'files' => $files,
                'remove' => [],
                'run_migrations' => $options->runMigrations,
            ];
            if ($options->requiredExtensions !== []) {
                $manifest['required_extensions'] = array_values(array_unique($options->requiredExtensions));
            }
            if ($options->privateKeyPath !== null) {
                $privateKey = @file_get_contents($options->privateKeyPath);
                if ($privateKey === false) {
                    throw new RuntimeException('The release private key cannot be read.');
                }
                $manifest['signature_algorithm'] = PlatformPackageSignature::ALGORITHM;
                if ($options->keyId !== null && $options->keyId !== '') {
                    $manifest['key_id'] = $options->keyId;
                }
                PlatformPackageManifest::fromArray($manifest);
                $manifest['signature'] = PlatformPackageSignature::sign($manifest, trim($privateKey));
            }
            PlatformPackageManifest::fromArray($manifest);
            $manifestPath = $staging . '/manifest.json';
            file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL, LOCK_EX);

            $directory = dirname($outputPath);
            if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                throw new RuntimeException('The release output directory cannot be created.');
            }
            @chmod($directory, 0775);
            $this->createArchive($outputPath, $manifestPath, $payload, array_keys($files));
            @chmod($outputPath, 0664);
            $checksum = hash_file('sha256', $outputPath);
            if ($checksum === false) {
                throw new RuntimeException('The release package checksum cannot be calculated.');
            }
            if (file_put_contents($outputPath . '.sha256', $checksum . '  ' . basename($outputPath) . PHP_EOL, LOCK_EX) === false) {
                throw new RuntimeException('The release checksum file cannot be written.');
            }
            @chmod($outputPath . '.sha256', 0664);

            return new PlatformPackageBuildResult($outputPath, $checksum, $version->value, count($files), $options->privateKeyPath !== null);
        } finally {
            $this->removeDirectory($staging);
        }
    }

    /** @return array<string, string> */
    private function copySourceTree(string $payload, PlatformVersion $version): array
    {
        $files = [];
        foreach (self::DIRECTORIES as $directory) {
            $source = $this->basePath . '/' . $directory;
            if (is_dir($source)) {
                $this->copyDirectory($source, $payload . '/' . $directory, $files);
            }
        }
        foreach (['.env.example', 'composer.json', 'composer.lock', 'phinx.php'] as $file) {
            $source = $this->basePath . '/' . $file;
            if (is_file($source)) {
                $destination = $payload . '/' . $file;
                copy($source, $destination);
                $files[$file] = $this->checksum($destination);
            }
        }
        $platformManifest = $this->basePath . '/platform.json';
        if (!is_file($platformManifest)) {
            throw new RuntimeException('The platform.json file is missing.');
        }
        $data = json_decode((string) file_get_contents($platformManifest), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data)) {
            throw new RuntimeException('The platform.json file is invalid.');
        }
        $data['version'] = $version->value;
        $destination = $payload . '/platform.json';
        file_put_contents($destination, json_encode($data, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL, LOCK_EX);
        $files['platform.json'] = $this->checksum($destination);

        return $files;
    }

    /** @param array<string, string> $files */
    private function copyDirectory(string $source, string $destination, array &$files): void
    {
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile() || $file->isLink()) {
                continue;
            }
            $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($this->basePath) + 1));
            if ($relative === 'public/media' || str_starts_with($relative, 'public/media/')) {
                continue;
            }
            $target = $destination . '/' . substr($relative, strlen(basename($source)) + 1);
            if (!is_dir(dirname($target))) {
                mkdir(dirname($target), 0770, true);
            }
            copy($file->getPathname(), $target);
            $files[$relative] = $this->checksum($target);
        }
    }

    /** @param list<string> $files */
    private function createArchive(string $output, string $manifest, string $payload, array $files): void
    {
        $archive = new ZipArchive();
        if ($archive->open($output, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('The release ZIP archive cannot be created.');
        }
        try {
            $archive->addFile($manifest, 'manifest.json');
            foreach ($files as $file) {
                $archive->addFile($payload . '/' . $file, 'payload/' . $file);
            }
            if (!$archive->close()) {
                throw new RuntimeException('The release ZIP archive cannot be finalized.');
            }
        } catch (\Throwable $exception) {
            $archive->close();
            throw $exception;
        }
    }

    private function absolutePath(string $path): string
    {
        return str_starts_with($path, '/') ? $path : $this->basePath . '/' . $path;
    }

    /** @return non-empty-string */
    private function checksum(string $path): string
    {
        $checksum = hash_file('sha256', $path);
        if ($checksum === false) {
            throw new RuntimeException(sprintf('The checksum for "%s" cannot be calculated.', $path));
        }

        return $checksum;
    }

    private function major(string $version): int
    {
        return (int) explode('.', $version, 2)[0];
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($directory);
    }
}
