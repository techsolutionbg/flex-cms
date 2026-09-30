<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Configuration\ProjectPaths;
use Flex\Themes\ThemeManifest;
use Flex\Themes\ThemeManager;
use Flex\Updates\Exception\InvalidPlatformPackage;

final readonly class ThemePackageInstaller
{
    public function __construct(private ProjectPaths $paths, private ThemeManager $themes, private string $basePath) {}

    /** @return array{theme_id: string, from: string, to: string, active: bool, backup_path: string} */
    public function installArchive(string $archive, string $expectedId, string $expectedVersion): array
    {
        $stage = $this->basePath . '/storage/tmp/theme-install-' . bin2hex(random_bytes(8));
        $target = $this->paths->themes($expectedId);
        $backup = $this->basePath . '/storage/backups/themes/' . $expectedId . '/' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(4));
        $active = $this->themes->activeTheme() === $expectedId;
        $oldVersion = '—';
        try {
            $root = $this->extract($archive, $stage, $expectedId, $expectedVersion);
            foreach ($this->themes->all() as $theme) if ($theme['id'] === $expectedId) $oldVersion = (string) $theme['version'];
            $this->assertManagedPath($target);
            if (is_dir($target)) {
                if (!is_dir(dirname($backup)) && !mkdir(dirname($backup), 0775, true) && !is_dir(dirname($backup))) throw new InvalidPlatformPackage('Backup папката на темата не може да бъде създадена.');
                if (!rename($target, $backup)) throw new InvalidPlatformPackage('Старата версия на темата не може да бъде архивирана.');
            }
            if (!rename($root, $target)) throw new InvalidPlatformPackage('Файловете на темата не могат да бъдат инсталирани.');
            return ['theme_id' => $expectedId, 'from' => $oldVersion, 'to' => $expectedVersion, 'active' => $active, 'backup_path' => $backup];
        } catch (\Throwable $exception) {
            if (is_dir($target)) $this->deleteDirectory($target);
            if (is_dir($backup) && !is_dir($target)) @rename($backup, $target);
            throw $exception;
        } finally {
            $this->deleteDirectory($stage);
        }
    }

    private function extract(string $archive, string $stage, string $expectedId, string $expectedVersion): string
    {
        if (!class_exists(\ZipArchive::class) || !is_file($archive)) throw new InvalidPlatformPackage('Необходим е четим ZIP пакет на тема и PHP ZIP разширение.');
        if (!mkdir($stage, 0770, true) && !is_dir($stage)) throw new InvalidPlatformPackage('Временната папка за темата не може да бъде създадена.');
        $zip = new \ZipArchive();
        if ($zip->open($archive) !== true) throw new InvalidPlatformPackage('ZIP пакетът на темата не може да бъде отворен.');
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (!is_string($name) || $name === '' || str_starts_with($name, '/') || preg_match('~(^|/)\.\.(?:/|$)~', $name) === 1) { $zip->close(); throw new InvalidPlatformPackage('Пакетът на темата съдържа опасен път.'); }
        }
        if (!$zip->extractTo($stage)) { $zip->close(); throw new InvalidPlatformPackage('Пакетът на темата не може да бъде разархивиран.'); }
        $zip->close();
        $manifestPath = null;
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($stage, \FilesystemIterator::SKIP_DOTS)) as $file) if ($file->isFile() && $file->getFilename() === 'theme.json') { if ($manifestPath !== null) throw new InvalidPlatformPackage('Пакетът трябва да съдържа точно един theme.json.'); $manifestPath = $file->getPathname(); }
        if ($manifestPath === null) throw new InvalidPlatformPackage('Пакетът на темата не съдържа theme.json.');
        $manifest = ThemeManifest::fromArray(json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR));
        if ($manifest->id !== $expectedId || $manifest->version !== $expectedVersion) throw new InvalidPlatformPackage('Манифестът на темата не съвпада с избрания release.');
        if (!is_dir(dirname($manifestPath) . '/templates')) throw new InvalidPlatformPackage('Пакетът на темата не съдържа папка templates.');
        return dirname($manifestPath);
    }

    private function assertManagedPath(string $target): void
    {
        $root = realpath($this->paths->themes());
        if ($root === false) { if (!is_dir($this->paths->themes()) && !mkdir($this->paths->themes(), 0770, true) && !is_dir($this->paths->themes())) throw new InvalidPlatformPackage('Папката за теми не може да бъде създадена.'); $root = realpath($this->paths->themes()); }
        $parent = dirname($target);
        if ($root === false || ($parent !== $root && !str_starts_with($parent, rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR))) throw new InvalidPlatformPackage('Пътят на темата е извън управляваната папка.');
    }

    private function deleteDirectory(string $path): void
    {
        if (!is_dir($path)) return;
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $item) $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        @rmdir($path);
    }
}
