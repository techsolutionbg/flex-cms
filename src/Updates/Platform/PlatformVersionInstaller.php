<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Composer\Semver\Semver;
use Flex\Contracts\Updates\PlatformMigrationRunnerInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Updates\Exception\InvalidPlatformPackage;
use Flex\Updates\Exception\PlatformUpdateException;
use Flex\Updates\Exception\PlatformUpdateLocked;
use ZipArchive;

final readonly class PlatformVersionInstaller implements PlatformVersionInstallerInterface
{
    public function __construct(
        private string $basePath,
        private PlatformPackageInspector $inspector,
        private PlatformVersionRegistry $versions,
        private PlatformMigrationRunnerInterface $migrationRunner,
    ) {
    }

    public function install(string $packagePath, PlatformInstallOptions $options): PlatformInstallResult
    {
        if ($options->requireChecksum && $options->expectedChecksum === null) {
            throw new InvalidPlatformPackage('An expected package SHA-256 checksum is required.');
        }

        $package = $this->inspector->inspect($packagePath, $options->expectedChecksum);
        $currentVersion = $this->versions->current();
        $this->assertCompatible($package->manifest, $currentVersion, $options);

        if ($options->dryRun) {
            return new PlatformInstallResult(
                from: $currentVersion,
                to: $package->manifest->version,
                packageChecksum: $package->checksum,
                backupPath: null,
                dryRun: true,
            );
        }

        $lock = $this->acquireLock();
        $workPath = $this->createWorkDirectory($package->manifest->version);
        $backupPath = $this->createBackupDirectory($currentVersion, $package->manifest->version);
        $maintenancePath = $this->basePath . '/storage/maintenance.json';

        try {
            $this->extractPayload($package, $workPath);
            $this->backupAffectedFiles($package->manifest, $backupPath);
            $this->enableMaintenanceMode($maintenancePath, $currentVersion, $package->manifest->version);

            try {
                $this->applyPayload($package->manifest, $workPath);
                if ($package->manifest->runMigrations) {
                    $this->migrationRunner->migrate();
                }
                $this->appendHistory($package, $currentVersion, $backupPath);
            } catch (\Throwable $exception) {
                $this->restoreBackup($package->manifest, $backupPath);
                throw new PlatformUpdateException('Platform installation failed and the file backup was restored.', 0, $exception);
            }
        } finally {
            @unlink($maintenancePath);
            $this->removeDirectory($workPath);
            flock($lock, LOCK_UN);
            fclose($lock);
        }

        return new PlatformInstallResult(
            from: $currentVersion,
            to: $package->manifest->version,
            packageChecksum: $package->checksum,
            backupPath: $backupPath,
            dryRun: false,
        );
    }

    private function assertCompatible(
        PlatformPackageManifest $manifest,
        PlatformVersion $currentVersion,
        PlatformInstallOptions $options,
    ): void {
        if (!Semver::satisfies(PHP_VERSION, $manifest->minimumPhp)) {
            throw new InvalidPlatformPackage(sprintf('The package requires PHP %s; the current version is %s.', $manifest->minimumPhp, PHP_VERSION));
        }

        if (!Semver::satisfies($currentVersion->value, $manifest->compatibleFrom)) {
            throw new InvalidPlatformPackage(sprintf('Platform %s does not satisfy the package compatibility constraint %s.', $currentVersion, $manifest->compatibleFrom));
        }

        $comparison = $manifest->version->compare($currentVersion);
        if ($comparison === 0) {
            throw new InvalidPlatformPackage(sprintf('Platform version %s is already installed.', $currentVersion));
        }

        if ($comparison < 0 && !$options->allowDowngrade) {
            throw new InvalidPlatformPackage('Installing an older platform version requires the explicit allow-downgrade option.');
        }
    }

    /** @return resource */
    private function acquireLock()
    {
        $directory = $this->basePath . '/storage/tmp';
        $this->ensureDirectory($directory);

        $lock = @fopen($directory . '/platform-update.lock', 'c+');
        if ($lock === false) {
            throw new PlatformUpdateException('The platform update lock cannot be opened.');
        }

        if (!flock($lock, LOCK_EX | LOCK_NB)) {
            fclose($lock);
            throw new PlatformUpdateLocked('Another platform installation is already running.');
        }

        return $lock;
    }

    private function createWorkDirectory(PlatformVersion $version): string
    {
        $path = sprintf('%s/storage/tmp/platform-update-%s-%s', $this->basePath, $version, bin2hex(random_bytes(6)));
        $this->ensureDirectory($path);

        return $path;
    }

    private function createBackupDirectory(PlatformVersion $from, PlatformVersion $to): string
    {
        $path = sprintf(
            '%s/storage/backups/platform/%s-%s-to-%s-%s',
            $this->basePath,
            gmdate('YmdHis'),
            $from,
            $to,
            bin2hex(random_bytes(4)),
        );
        $this->ensureDirectory($path . '/files');

        return $path;
    }

    private function extractPayload(InspectedPlatformPackage $package, string $workPath): void
    {
        $checksum = hash_file('sha256', $package->path);
        if ($checksum === false || !hash_equals($package->checksum, $checksum)) {
            throw new InvalidPlatformPackage('The platform package changed after verification.');
        }

        $archive = new ZipArchive();
        if ($archive->open($package->path, ZipArchive::RDONLY) !== true) {
            throw new InvalidPlatformPackage('The verified platform package can no longer be opened.');
        }

        try {
            foreach (array_keys($package->manifest->files) as $path) {
                $contents = $archive->getFromName('payload/' . $path);
                if ($contents === false) {
                    throw new InvalidPlatformPackage(sprintf('Package file "%s" cannot be extracted.', $path));
                }

                $destination = $workPath . '/' . $path;
                $this->ensureDirectory(dirname($destination));
                if (file_put_contents($destination, $contents, LOCK_EX) === false) {
                    throw new PlatformUpdateException(sprintf('Cannot stage package file "%s".', $path));
                }
            }
        } finally {
            $archive->close();
        }
    }

    private function backupAffectedFiles(PlatformPackageManifest $manifest, string $backupPath): void
    {
        $existing = [];
        $missing = [];

        foreach ($this->affectedPaths($manifest) as $path) {
            $source = $this->destination($path);
            if (is_dir($source)) {
                throw new PlatformUpdateException(sprintf('Platform packages cannot replace or remove the directory "%s".', $path));
            }

            if (is_file($source)) {
                $destination = $backupPath . '/files/' . $path;
                $this->ensureDirectory(dirname($destination));
                if (!copy($source, $destination)) {
                    throw new PlatformUpdateException(sprintf('Cannot back up "%s".', $path));
                }
                $existing[] = $path;
            } else {
                $missing[] = $path;
            }
        }

        $metadata = json_encode([
            'existing' => $existing,
            'missing' => $missing,
        ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

        if (file_put_contents($backupPath . '/metadata.json', $metadata . PHP_EOL, LOCK_EX) === false) {
            throw new PlatformUpdateException('Cannot write the platform backup metadata.');
        }
    }

    private function applyPayload(PlatformPackageManifest $manifest, string $workPath): void
    {
        foreach (array_keys($manifest->files) as $path) {
            $source = $workPath . '/' . $path;
            $destination = $this->destination($path);
            $this->ensureDirectory(dirname($destination));

            $temporary = $destination . '.flex-update-' . bin2hex(random_bytes(4));
            if (!copy($source, $temporary)) {
                throw new PlatformUpdateException(sprintf('Cannot prepare replacement for "%s".', $path));
            }

            if (!rename($temporary, $destination)) {
                @unlink($temporary);
                throw new PlatformUpdateException(sprintf('Cannot activate replacement for "%s".', $path));
            }
        }

        foreach ($manifest->remove as $path) {
            $destination = $this->destination($path);
            if (is_file($destination) && !unlink($destination)) {
                throw new PlatformUpdateException(sprintf('Cannot remove obsolete file "%s".', $path));
            }
        }
    }

    private function restoreBackup(PlatformPackageManifest $manifest, string $backupPath): void
    {
        foreach (array_reverse($this->affectedPaths($manifest)) as $path) {
            $backup = $backupPath . '/files/' . $path;
            $destination = $this->destination($path);

            if (is_file($backup)) {
                $this->ensureDirectory(dirname($destination));
                if (!copy($backup, $destination)) {
                    throw new PlatformUpdateException(sprintf('Rollback could not restore "%s".', $path));
                }
            } elseif (is_file($destination) && !unlink($destination)) {
                throw new PlatformUpdateException(sprintf('Rollback could not remove newly installed file "%s".', $path));
            }
        }
    }

    private function enableMaintenanceMode(string $path, PlatformVersion $from, PlatformVersion $to): void
    {
        $contents = json_encode([
            'reason' => 'platform-update',
            'from' => $from->value,
            'to' => $to->value,
            'started_at' => gmdate(DATE_ATOM),
        ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

        if (file_put_contents($path, $contents . PHP_EOL, LOCK_EX) === false) {
            throw new PlatformUpdateException('Cannot enable maintenance mode.');
        }
    }

    private function appendHistory(InspectedPlatformPackage $package, PlatformVersion $from, string $backupPath): void
    {
        $directory = $this->basePath . '/storage/updates';
        $this->ensureDirectory($directory);
        $record = json_encode([
            'type' => 'platform',
            'from' => $from->value,
            'to' => $package->manifest->version->value,
            'checksum' => $package->checksum,
            'backup' => $backupPath,
            'installed_at' => gmdate(DATE_ATOM),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

        if (file_put_contents($directory . '/history.jsonl', $record . PHP_EOL, FILE_APPEND | LOCK_EX) === false) {
            throw new PlatformUpdateException('Cannot write the platform update history.');
        }
    }

    /** @return list<string> */
    private function affectedPaths(PlatformPackageManifest $manifest): array
    {
        return array_values(array_unique([...array_keys($manifest->files), ...$manifest->remove]));
    }

    private function destination(string $path): string
    {
        $destination = $this->basePath . '/' . $path;
        $cursor = $destination;

        while ($cursor !== $this->basePath && $cursor !== dirname($cursor)) {
            if (is_link($cursor)) {
                throw new PlatformUpdateException(sprintf('Platform updates cannot write through symbolic link "%s".', $path));
            }
            $cursor = dirname($cursor);
        }

        return $destination;
    }

    private function ensureDirectory(string $path): void
    {
        if (!is_dir($path) && !mkdir($path, 0775, true) && !is_dir($path)) {
            throw new PlatformUpdateException(sprintf('Cannot create directory "%s".', $path));
        }
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($iterator as $item) {
            if ($item->isDir() && !$item->isLink()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }

        @rmdir($path);
    }
}
