<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Session\CsrfTokenManager;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Platform\PlatformPackageInspector;
use Flex\Updates\Platform\PlatformPackageUpload;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUpdatesInspectController
{
    public function __construct(
        private ConfigRepositoryInterface $configuration,
        private PlatformHistory $history,
        private PlatformPackageInspector $inspector,
        private PlatformPackageUpload $uploads,
        private RequestInput $input,
        private AdminUpdatesPage $page,
        private CsrfTokenManager $csrf,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $path = null;
        try {
            $input = $this->input->all($request);
            $checksum = is_string($input['checksum'] ?? null) ? trim($input['checksum']) : null;
            if ($this->configuration->bool('extensions.updates.require_checksum') && ($checksum === null || $checksum === '')) {
                throw new \InvalidArgumentException('A package checksum is required.');
            }
            $path = $this->uploads->store($request);
            $package = $this->inspector->inspect($path, $checksum);

            return $this->responses->html($this->page->render(
                $this->csrf->token(),
                $this->history->all(),
                null,
                null,
                [
                    'version' => $package->manifest->version->value,
                    'files' => count($package->manifest->files),
                    'migrations' => $package->manifest->runMigrations,
                ],
            ));
        } catch (\Throwable $exception) {
            return $this->responses->html($this->page->render($this->csrf->token(), $this->history->all(), null, $exception->getMessage()), 422);
        } finally {
            if ($path !== null) {
                @unlink($path);
            }
        }
    }
}
