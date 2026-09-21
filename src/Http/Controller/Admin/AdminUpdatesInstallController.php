<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Http\RequestInput;
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
            $dryRun = ($input['mode'] ?? 'install') === 'dry_run';
            $path = $this->uploads->store($request);
            $result = $this->installer->install($path, new PlatformInstallOptions(
                expectedChecksum: $checksum !== '' ? $checksum : null,
                dryRun: $dryRun,
                requireChecksum: $this->configuration->bool('extensions.updates.require_checksum'),
            ));

            return $this->responses->html($this->page->render(
                $this->csrf->token(),
                $this->history->all(),
                $dryRun
                    ? sprintf('Dry-run проверката за обновяване от %s до %s завърши успешно.', $result->from->value, $result->to->value)
                    : sprintf('Обновяването от %s до %s завърши успешно.', $result->from->value, $result->to->value),
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
