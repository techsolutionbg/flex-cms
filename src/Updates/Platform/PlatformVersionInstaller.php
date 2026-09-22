<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Composer\Semver\Semver;
use Flex\Contracts\Updates\PlatformDatabaseBackupInterface;
use Flex\Contracts\Updates\PlatformHealthCheckerInterface;
use Flex\Contracts\Updates\PlatformMigrationRunnerInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Updates\Exception\InvalidPlatformPackage;
use Flex\Updates\Exception\PlatformUpdateException;
use ZipArchive;

final readonly class PlatformVersionInstaller implements PlatformVersionInstallerInterface
{
    private PlatformUpdateStateStore $states;
    private PlatformPreflightChecker $preflight;
    private ?PlatformHealthCheckerInterface $healthChecker;
    private ?PlatformDatabaseBackupInterface $databaseBackup;

    public function __construct(
        private string $basePath,
        private PlatformPackageInspector $inspector,
        private PlatformVersionRegistry $versions,
        private PlatformMigrationRunnerInterface $migrationRunner,
        ?PlatformUpdateStateStore $stateStore = null,
        ?PlatformPreflightChecker $preflight = null,
        ?PlatformHealthCheckerInterface $healthChecker = null,
        ?PlatformDatabaseBackupInterface $databaseBackup = null,
    ) {
        $this->states = $stateStore ?? new PlatformUpdateStateStore($basePath);
        $this->preflight = $preflight ?? new PlatformPreflightChecker($basePath);
        $this->healthChecker = $healthChecker;
        $this->databaseBackup = $databaseBackup;
    }

    public function install(string $packagePath, PlatformInstallOptions $options): PlatformInstallResult
    {
        if ($options->requireChecksum && $options->expectedChecksum === null) {
            throw new InvalidPlatformPackage('An expected package SHA-256 checksum is required.');
        }

        $package = $this->inspector->inspect($packagePath, $options->expectedChecksum);
        $currentVersion = $this->versions->current();
        $this->assertCompatible($package->manifest, $currentVersion, $options);
        $this->preflight->assertReady($package);

        if ($options->dryRun) {
            return new PlatformInstallResult(
                from: $currentVersion,
                to: $package->manifest->version,
                packageChecksum: $package->checksum,
                backupPath: null,
                dryRun: true,
            );
        }

        $lock = PlatformUpdateLock::acquire($this->basePath);
        $workPath = null;
        $backupPath = null;
        $maintenancePath = $this->basePath . '/storage/maintenance.json';
        $recoveryRequired = false;
        $state = null;

        try {
            $workPath = $this->createWorkDirectory($package->manifest->version);
            $backupPath = $this->createBackupDirectory($currentVersion, $package->manifest->version);
            $state = new PlatformUpdateState(
                id: basename($backupPath),
                phase: 'started',
                from: $currentVersion->value,
                to: $package->manifest->version->value,
                checksum: $package->checksum,
                backupPath: $backupPath,
                workPath: $workPath,
                databaseBackupPath: $package->manifest->runMigrations ? $backupPath . '/database.json' : null,
                affectedPaths: $this->affectedPaths($package->manifest),
                startedAt: gmdate(DATE_ATOM),
            );
            $this->states->write($state);
            $this->extractPayload($package, $workPath);
            $state = $this->transition($state, 'staged');
            $this->backupAffectedFiles($package->manifest, $backupPath);
            $state = $this->transition($state, 'backed_up');
            if ($package->manifest->runMigrations) {
                if ($this->databaseBackup === null) {
                    throw new PlatformUpdateException('Database backup is required before running migrations.');
                }
                $this->databaseBackup->backup($state->databaseBackupPath ?? $backupPath . '/database.json');
            }
            $this->enableMaintenanceMode($maintenancePath, $currentVersion, $package->manifest->version);
            $state = $this->transition($state, 'maintenance_enabled');

            try {
                $this->applyPayload($package->manifest, $workPath);
                $state = $this->transition($state, 'files_activated');
                if ($package->manifest->runMigrations) {
                    $state = $this->transition($state, 'migrations_running');
                    $this->migrationRunner->migrate();
                }
                if ($this->healthChecker !== null) {
                    $state = $this->transition($state, 'health_checking');
                    $this->healthChecker->check();
                }
                $this->appendHistory($package, $currentVersion, $backupPath);
                $state = $this->transition($state, 'completed');
            } catch (\Throwable $exception) {
                try {
                    $this->restoreBackup($package->manifest, $backupPath);
                    if ($package->manifest->runMigrations && $this->databaseBackup !== null && $state->databaseBackupPath !== null) {
                        $this->databaseBackup->restore($state->databaseBackupPath);
                    }
                    $this->states->clear();
                } catch (\Throwable $recoveryException) {
                    $recoveryRequired = true;
                    $this->states->write($this->transition($state, 'recovery_required'));
                    throw new PlatformUpdateException('Platform installation failed and automatic recovery also failed. Run platform:recover.', 0, $recoveryException);
                }
                throw new PlatformUpdateException('Platform installation failed and the file backup was restored.', 0, $exception);
            }
        } finally {
            if (!$recoveryRequired) {
                @unlink($maintenancePath);
                if ($workPath !== null) {
                    $this->removeDirectory($workPath);
                }
            }
            $lock->release();
        }

        $this->states->clear();

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

    private function transition(PlatformUpdateState $state, string $phase): PlatformUpdateState
    {
        $next = new PlatformUpdateState(
            id: $state->id,
            phase: $phase,
            from: $state->from,
            to: $state->to,
            checksum: $state->checksum,
            backupPath: $state->backupPath,
            workPath: $state->workPath,
            databaseBackupPath: $state->databaseBackupPath,
            affectedPaths: $state->affectedPaths,
            startedAt: $state->startedAt,
        );
        $this->states->write($next);

        return $next;
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
            'id' => basename($backupPath),
            'from' => $from->value,
            'to' => $package->manifest->version->value,
            'checksum' => $package->checksum,
            'backup' => $backupPath,
            'database_backup' => $package->manifest->runMigrations ? $backupPath . '/database.json' : null,
            'affected_paths' => $this->affectedPaths($package->manifest),
            'migrations_ran' => $package->manifest->runMigrations,
            'migration_files' => array_values(array_filter(
                array_keys($package->manifest->files),
                static fn(string $path): bool => str_starts_with($path, 'database/migrations/'),
            )),
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
