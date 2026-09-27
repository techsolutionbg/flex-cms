<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\ApiError;
use Flex\Updates\Remote\PluginPackageInstaller;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPluginUploadController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PluginPackageInstaller $installer,
        private ResponseFactoryInterface $responses,
    ) {}

    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(ApiError::payload(403, 'super_admin_required', 'Super administrator access is required.'), 403);
        }

        try {
            $uploaded = $request->getUploadedFiles()['plugin'] ?? null;
            if (!$uploaded instanceof \Psr\Http\Message\UploadedFileInterface) {
                throw new \RuntimeException('Please select a plugin ZIP package.');
            }
            $id = $this->installer->installUpload($uploaded);

            return $this->responses->json(['plugin_id' => $id, 'message' => 'Plugin uploaded and installed.']);
        } catch (\Throwable $exception) {
            return $this->responses->json(ApiError::payload(422, 'plugin_upload_failed', $exception->getMessage()), 422);
        }
    }
}
