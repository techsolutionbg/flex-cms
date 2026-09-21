<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Session\CsrfTokenManager;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Platform\PlatformInstallOptions;
use Flex\Updates\Platform\PlatformPackageUpload;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUpdatesInstallController
{
    public function __construct(
        private ConfigRepositoryInterface $configuration,
        private PlatformHistory $history,
        private PlatformPackageUpload $uploads,
        private PlatformVersionInstallerInterface $installer,
        private AdminUpdatesPage $page,
        private CsrfTokenManager $csrf,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $path = null;
        try {
            $path = $this->uploads->store($request);
            $checksum = hash_file('sha256', $path);
            if ($checksum === false) {
                throw new \RuntimeException('The uploaded platform package checksum cannot be calculated.');
            }
            $result = $this->installer->install($path, new PlatformInstallOptions(
                expectedChecksum: $checksum,
                dryRun: false,
                requireChecksum: $this->configuration->bool('extensions.updates.require_checksum'),
            ));

            return $this->responses->html($this->page->render(
                $this->csrf->token(),
                $this->history->all(),
                sprintf('Обновяването от %s до %s завърши успешно.', $result->from->value, $result->to->value),
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
