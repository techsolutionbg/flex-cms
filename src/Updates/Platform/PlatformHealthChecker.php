<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Updates\PlatformHealthCheckerInterface;
use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PlatformHealthChecker implements PlatformHealthCheckerInterface
{
    public function __construct(private ConfigRepositoryInterface $configuration) {}

    public function check(): void
    {
        $url = $this->configuration->string('extensions.updates.healthcheck_url');
        if ($url === '') {
            throw new PlatformUpdateException('The platform health check URL is not configured.');
        }

        $handle = curl_init($url);
        if ($handle === false) {
            throw new PlatformUpdateException('The platform health check could not be initialized.');
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if (!is_string($body) || $status < 200 || $status >= 300) {
            throw new PlatformUpdateException(sprintf(
                'The post-update health check failed with HTTP %d%s.',
                $status,
                $error !== '' ? ': ' . $error : '',
            ));
        }

        try {
            $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new PlatformUpdateException('The post-update health check returned invalid JSON.', 0, $exception);
        }

        if (!is_array($payload) || ($payload['status'] ?? null) !== 'ok') {
            throw new PlatformUpdateException('The post-update health check returned an invalid response.');
        }
    }
}
