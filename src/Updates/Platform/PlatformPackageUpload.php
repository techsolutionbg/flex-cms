<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\InvalidPlatformPackage;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;

final readonly class PlatformPackageUpload
{
    public function __construct(private string $basePath) {}

    public function store(ServerRequestInterface $request): string
    {
        $uploaded = $request->getUploadedFiles()['package'] ?? null;
        if (!$uploaded instanceof UploadedFileInterface || $uploaded->getError() !== UPLOAD_ERR_OK) {
            throw new InvalidPlatformPackage('Please select a readable platform ZIP package.');
        }

        $directory = $this->basePath . '/storage/tmp';
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new InvalidPlatformPackage('The upload staging directory cannot be created.');
        }
        $path = $directory . '/admin-platform-upload-' . bin2hex(random_bytes(8)) . '.zip';
        try {
            $uploaded->moveTo($path);
        } catch (\Throwable $exception) {
            @unlink($path);
            throw new InvalidPlatformPackage('The platform package could not be staged.', 0, $exception);
        }

        if (!is_file($path) || !is_readable($path)) {
            @unlink($path);
            throw new InvalidPlatformPackage('The staged platform package is not readable.');
        }

        return $path;
    }
}
