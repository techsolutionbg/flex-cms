<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Configuration\ProjectPaths;
use Flex\Extensions\Exception\InvalidPluginManifest;
use Illuminate\Database\Eloquent\Collection;

final readonly class PluginRegistry
{
    public function __construct(private ProjectPaths $paths) {}

    public function pluginsPath(): string
    {
        return $this->paths->plugins();
    }

    /** @return list<array{manifest: PluginManifest, path: string}> */
    public function discover(): array
    {
        $pluginsPath = $this->paths->plugins();
        if (!is_dir($pluginsPath)) {
            return [];
        }

        $discovered = [];
        $directories = scandir($pluginsPath);
        if ($directories === false) {
            throw new InvalidPluginManifest(sprintf('Plugin directory "%s" cannot be read.', $pluginsPath));
        }

        foreach ($directories as $directory) {
            if ($directory === '.' || $directory === '..' || $directory[0] === '.') {
                continue;
            }

            $path = $pluginsPath . '/' . $directory;
            if (!is_dir($path)) {
                continue;
            }

            foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS)) as $file) {
                if (!$file->isFile() || $file->getFilename() !== 'plugin.json') {
                    continue;
                }

                $manifest = PluginManifest::fromFile($file->getPathname());
                $discovered[] = ['manifest' => $manifest, 'path' => $file->getPath()];
            }
        }

        usort($discovered, static fn(array $left, array $right): int => $left['manifest']->id <=> $right['manifest']->id);

        return $discovered;
    }

    /** @return Collection<int, Plugin> */
    public function all(): Collection
    {
        /** @var Collection<int, Plugin> $plugins */
        $plugins = Plugin::query()->orderBy('id')->get();

        return $plugins;
    }

    public function find(string $id): ?Plugin
    {
        $plugin = Plugin::query()->find($id);

        return $plugin instanceof Plugin ? $plugin : null;
    }

    /** @return list<Plugin> */
    public function sync(): array
    {
        $plugins = [];
        foreach ($this->discover() as $entry) {
            $manifest = $entry['manifest'];
            $plugin = $this->find($manifest->id) ?? new Plugin(['id' => $manifest->id]);
            $plugin->fill([
                'name' => $manifest->name,
                'version' => $manifest->version,
                'description' => $manifest->description,
                'entrypoint' => $manifest->entrypoint,
                'path' => $entry['path'],
                'manifest' => $manifest->toArray(),
                'status' => $plugin->exists ? $plugin->getAttribute('status') : 'inactive',
                'installed_at' => $plugin->exists ? $plugin->getAttribute('installed_at') : new \DateTimeImmutable(),
            ]);
            $plugin->saveOrFail();
            $plugins[] = $plugin;
        }

        return $plugins;
    }
}
