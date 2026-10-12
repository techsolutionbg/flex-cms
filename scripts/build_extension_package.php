<?php

declare(strict_types=1);

// Builds plugin or theme ZIP archives with forward-slash paths (Linux-safe).
if ($argc < 4) {
    fwrite(STDERR, "Usage: php build_extension_package.php <plugin|theme> <source-root> <output.zip>\n");
    exit(1);
}

$type = $argv[1];
$sourceRoot = realpath($argv[2]);
$output = $argv[3];
if (!in_array($type, ['plugin', 'theme'], true) || $sourceRoot === false || !is_dir($sourceRoot)) {
    fwrite(STDERR, "Invalid arguments.\n");
    exit(1);
}

$manifestName = $type === 'theme' ? 'theme.json' : 'plugin.json';
$manifestPath = $sourceRoot . DIRECTORY_SEPARATOR . $manifestName;
if (!is_file($manifestPath)) {
    fwrite(STDERR, "Missing {$manifestName}.\n");
    exit(1);
}

/** @var array<string, mixed> $manifest */
$manifest = json_decode((string) file_get_contents($manifestPath), true, 32, JSON_THROW_ON_ERROR);
$version = $manifest['version'] ?? null;
if (!is_string($version) || preg_match('/^\d+\.\d+\.\d+/', $version) !== 1) {
    fwrite(STDERR, "Invalid version in manifest.\n");
    exit(1);
}

$excludeDirs = ['.git', '.github', 'node_modules', 'vendor', 'dist', 'tests', '.idea', '.vscode', '.phpunit.cache'];
$excludeFiles = ['.phpunit.result.cache', '.php-cs-fixer.cache'];

$archivePrefix = '';
if ($type === 'theme') {
    $id = $manifest['id'] ?? null;
    if (!is_string($id) || $id === '') {
        fwrite(STDERR, "Theme id missing.\n");
        exit(1);
    }
    $archivePrefix = $id . '/';
}

$zip = new ZipArchive();
if ($zip->open($output, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    fwrite(STDERR, "Cannot create ZIP.\n");
    exit(1);
}

try {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceRoot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST,
    );
    foreach ($iterator as $file) {
        if (!$file->isFile() || $file->isLink()) {
            continue;
        }
        $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($sourceRoot) + 1));
        foreach (explode('/', $relative) as $segment) {
            if (in_array($segment, $excludeDirs, true)) {
                continue 2;
            }
        }
        $basename = basename($relative);
        if (in_array($basename, $excludeFiles, true) || str_starts_with($basename, '.env')) {
            continue;
        }
        if (!$zip->addFile($file->getPathname(), $archivePrefix . $relative)) {
            throw new RuntimeException('Cannot add file to archive.');
        }
    }
} finally {
    $zip->close();
}

echo json_encode(['path' => $output, 'sha256' => hash_file('sha256', $output)], JSON_THROW_ON_ERROR) . PHP_EOL;
