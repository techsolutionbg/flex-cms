<?php

declare(strict_types=1);

namespace Flex\Installer;

final readonly class RequirementsChecker
{
    private const REQUIRED_EXTENSIONS = [
        'ctype', 'curl', 'dom', 'fileinfo', 'filter', 'hash', 'json', 'mbstring',
        'openssl', 'pcre', 'pdo', 'pdo_mysql', 'session', 'tokenizer', 'xml', 'zip',
    ];

    public function __construct(
        private string $basePath,
    ) {}

    public function check(): RequirementsReport
    {
        $this->prepareWritablePaths();
        $requirements = [
            new Requirement('PHP 8.3+', $this->supportsPhpVersion(PHP_VERSION), PHP_VERSION),
            new Requirement('64-bit PHP', PHP_INT_SIZE >= 8, sprintf('%d-bit', PHP_INT_SIZE * 8)),
        ];

        foreach (self::REQUIRED_EXTENSIONS as $extension) {
            $requirements[] = new Requirement(
                'PHP extension: ' . $extension,
                extension_loaded($extension),
                extension_loaded($extension) ? 'available' : 'missing',
            );
        }

        $requirements[] = new Requirement(
            'Image extension',
            extension_loaded('gd') || extension_loaded('imagick'),
            extension_loaded('imagick') ? 'imagick' : (extension_loaded('gd') ? 'gd' : 'missing'),
        );

        foreach ($this->writablePaths() as $label => $path) {
            $requirements[] = new Requirement($label, $this->isWritable($path), $path);
        }

        return new RequirementsReport($requirements);
    }

    private function prepareWritablePaths(): void
    {
        foreach ($this->writablePaths() as $path) {
            if (!is_dir($path) && !@mkdir($path, 0775, true) && !is_dir($path)) {
                continue;
            }
        }
    }

    /** @return array<string, string> */
    private function writablePaths(): array
    {
        $environmentPath = $this->basePath . '/.env';
        $environment = is_file($environmentPath)
            ? ['Environment file (.env)' => $environmentPath]
            : ['Project directory (.env)' => $this->basePath];

        return $environment + [
            'Storage directory' => $this->basePath . '/storage',
            'Cache directory' => $this->basePath . '/storage/cache',
            'Log directory' => $this->basePath . '/storage/logs',
            'Session directory' => $this->basePath . '/storage/sessions',
            'Temporary directory' => $this->basePath . '/storage/tmp',
            'Public media directory' => $this->basePath . '/public/media',
        ];
    }

    private function isWritable(string $path): bool
    {
        if (is_file($path)) {
            return is_writable($path);
        }

        if (!is_dir($path) && !@mkdir($path, 0775, true) && !is_dir($path)) {
            return false;
        }

        return is_writable($path);
    }

    private function supportsPhpVersion(string $version): bool
    {
        return version_compare($version, '8.3.0', '>=');
    }
}
