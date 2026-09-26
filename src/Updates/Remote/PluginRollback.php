<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginRegistry;
use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PluginRollback
{
    public function __construct(private string $basePath, private PluginUpdateHistory $history, private PluginRegistry $plugins, private PluginManager $manager) {}

    /** @return array<string, mixed> */
    public function rollback(string $id): array
    {
        $record = $this->history->find($id);
        $pluginId = $record['plugin_id'] ?? null;
        $backup = $record['backup_path'] ?? null;
        if (!is_string($pluginId) || !is_string($backup) || !is_dir($backup)) throw new PlatformUpdateException('The plugin update history record has no usable backup.');
        $plugin = $this->plugins->find($pluginId);
        if ($plugin === null) throw new PlatformUpdateException(sprintf('Plugin "%s" is not installed.', $pluginId));
        $path = (string) $plugin->getAttribute('path');
        $active = ($record['active'] ?? false) === true;
        $temporary = $path . '.rollback-' . bin2hex(random_bytes(5));
        try {
            if ($active && $plugin->getAttribute('status') === PluginManager::STATUS_ACTIVE) $this->manager->deactivate($pluginId);
            if (!rename($path, $temporary) || !rename($backup, $path)) throw new PlatformUpdateException('The plugin rollback could not replace the installed files.');
            $this->manager->install($pluginId);
            if ($active) $this->manager->activate($pluginId);
            $record['type'] = 'plugin_rollback';
            $record['rolled_back_at'] = gmdate(DATE_ATOM);
            $this->appendRollback($record);
            $this->deleteDirectory($temporary);

            return $record;
        } catch (\Throwable $exception) {
            if (is_dir($path) && !is_dir($temporary)) @rename($path, $temporary);
            if (is_dir($temporary) && !is_dir($path)) @rename($temporary, $path);
            throw $exception;
        }
    }

    /** @param array<string, mixed> $record */
    private function appendRollback(array $record): void
    {
        $this->history->append(['id' => (string) ($record['id'] ?? ''), 'type' => 'plugin_rollback', 'plugin_id' => $record['plugin_id'], 'from' => $record['to'], 'to' => $record['from'], 'rolled_back_at' => $record['rolled_back_at']]);
    }

    private function deleteDirectory(string $path): void
    {
        if (!is_dir($path)) return;
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $item) $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        @rmdir($path);
    }
}
