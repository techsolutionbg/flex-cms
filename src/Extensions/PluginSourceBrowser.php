<?php

declare(strict_types=1);

namespace Flex\Extensions;

final readonly class PluginSourceBrowser
{
    private const EXTENSIONS = ['php', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'sass', 'less', 'html', 'twig', 'xml', 'yaml', 'yml', 'md', 'txt', 'sql', 'svg'];

    public function __construct(private PluginRegistry $plugins) {}

    private function root(string $id): string
    {
        foreach ($this->plugins->discover() as $entry) {
            if ($entry['manifest']->id === $id) {
                $root = realpath($entry['path']);
                $base = realpath($this->plugins->pluginsPath());
                if ($root !== false && $base !== false && str_starts_with($root, $base . DIRECTORY_SEPARATOR)) {
                    return $root;
                }
            }
        }
        throw new \InvalidArgumentException('Разширението не е намерено.', 404);
    }

    /** @return list<string> */
    public function files(string $id): array
    {
        $root = $this->root($id);
        $files = [];
        $filter = new \RecursiveCallbackFilterIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS), static fn(\SplFileInfo $file): bool => !$file->isLink() && !str_starts_with($file->getFilename(), '.') && !in_array($file->getFilename(), ['node_modules', 'vendor'], true));
        foreach (new \RecursiveIteratorIterator($filter) as $file) {
            if ($file->isFile() && in_array(strtolower($file->getExtension()), self::EXTENSIONS, true)) {
                $files[] = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($root) + 1));
            }
        }
        sort($files, SORT_STRING);
        return $files;
    }

    /** @return list<string> */
    public function directories(string $id): array
    {
        $root = $this->root($id);
        $directories = [];
        $filter = new \RecursiveCallbackFilterIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS), static fn(\SplFileInfo $file): bool => !$file->isLink() && !str_starts_with($file->getFilename(), '.') && !in_array($file->getFilename(), ['node_modules', 'vendor'], true));
        foreach (new \RecursiveIteratorIterator($filter, \RecursiveIteratorIterator::SELF_FIRST) as $file) {
            if ($file->isDir()) {
                $directories[] = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($root) + 1));
            }
        }
        sort($directories, SORT_STRING);
        return $directories;
    }

    public function read(string $id, string $path): string
    {
        if (!in_array($path, $this->files($id), true)) {
            throw new \InvalidArgumentException('Файлът не е намерен.', 404);
        }
        $root = $this->root($id);
        $file = realpath($root . DIRECTORY_SEPARATOR . $path);
        if ($file === false || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || is_link($file)) {
            throw new \InvalidArgumentException('Файлът не е намерен.', 404);
        }
        if (filesize($file) > 2 * 1024 * 1024) {
            throw new \InvalidArgumentException('Файлът е прекалено голям за преглед (над 2 MB).', 422);
        }
        $content = file_get_contents($file);
        if ($content === false || str_contains($content, "\0") || !mb_check_encoding($content, 'UTF-8')) {
            throw new \InvalidArgumentException('Файлът не съдържа валиден UTF-8 текст.', 422);
        }
        return $content;
    }
}
