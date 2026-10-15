<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Configuration\ProjectPaths;

final readonly class ThemeSourceBrowser
{
    public function __construct(private ProjectPaths $paths) {}

    private function root(string $id): string
    {
        if (preg_match('/^[a-z0-9][a-z0-9._-]*$/D', $id) !== 1) {
            throw new \InvalidArgumentException('Невалидна тема.', 422);
        }
        $base = realpath($this->paths->themes());
        $root = realpath($this->paths->themes($id));
        if ($base === false || $root === false || is_link($this->paths->themes($id)) || !str_starts_with($root, $base . DIRECTORY_SEPARATOR) || !is_file($root . DIRECTORY_SEPARATOR . 'theme.json')) {
            throw new \InvalidArgumentException('Темата не е намерена.', 404);
        }
        return $root;
    }

    /** @return list<string> */
    public function files(string $id): array
    {
        $root = $this->root($id);
        $files = [];
        $filter = new \RecursiveCallbackFilterIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
            static fn(\SplFileInfo $file): bool => !$file->isLink(),
        );
        foreach (new \RecursiveIteratorIterator($filter) as $file) {
            if ($file->isFile()) {
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
        $filter = new \RecursiveCallbackFilterIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
            static fn(\SplFileInfo $file): bool => !$file->isLink(),
        );
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
        $file = $this->file($id, $path);
        if (filesize($file) > 2 * 1024 * 1024) {
            throw new \InvalidArgumentException('Файлът е прекалено голям за редактиране (над 2 MB).', 422);
        }
        $content = file_get_contents($file);
        if ($content === false || str_contains($content, "\0") || !mb_check_encoding($content, 'UTF-8')) {
            throw new \InvalidArgumentException('Файлът не съдържа текст във формат UTF-8.', 422);
        }
        return $content;
    }

    /** @return array{content: string, mime: string} */
    public function image(string $id, string $path): array
    {
        $file = $this->file($id, $path);
        if (filesize($file) > 10 * 1024 * 1024) {
            throw new \InvalidArgumentException('Изображението е прекалено голямо за преглед (над 10 MB).', 422);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file);
        $allowed = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp',
            'image/x-icon', 'image/vnd.microsoft.icon', 'image/tiff', 'image/svg+xml',
        ];
        if (!is_string($mime) || !in_array($mime, $allowed, true)) {
            throw new \InvalidArgumentException('Файлът не е изображение в поддържан формат.', 422);
        }
        $content = file_get_contents($file);
        if ($content === false) {
            throw new \InvalidArgumentException('Изображението не може да бъде заредено.', 422);
        }
        return ['content' => $content, 'mime' => $mime];
    }

    public function write(string $id, string $path, string $content): void
    {
        if (strlen($content) > 2 * 1024 * 1024 || str_contains($content, "\0") || !mb_check_encoding($content, 'UTF-8')) {
            throw new \InvalidArgumentException('Съдържанието трябва да е валиден UTF-8 текст до 2 MB.', 422);
        }
        $file = $this->file($id, $path);
        if (!is_writable($file) || file_put_contents($file, $content, LOCK_EX) === false) {
            throw new \InvalidArgumentException('Файлът не може да бъде записан.', 500);
        }
    }

    private function file(string $id, string $path): string
    {
        if ($path === '' || str_contains($path, '\\') || str_contains($path, ':') || str_starts_with($path, '/') || in_array('..', explode('/', $path), true)) {
            throw new \InvalidArgumentException('Невалиден път до файл.', 422);
        }
        $root = $this->root($id);
        $candidate = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
        $file = realpath($candidate);
        if ($file === false || is_link($candidate) || !is_file($file) || !str_starts_with($file, $root . DIRECTORY_SEPARATOR)) {
            throw new \InvalidArgumentException('Файлът не е намерен.', 404);
        }
        return $file;
    }
}
