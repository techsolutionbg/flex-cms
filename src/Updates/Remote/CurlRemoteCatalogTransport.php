<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Contracts\Updates\RemoteCatalogTransportInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportResponse;
use Flex\Updates\Exception\RemoteCatalogException;

final class CurlRemoteCatalogTransport implements RemoteCatalogTransportInterface
{
    public function __construct(
        private readonly int $timeout = 10,
        private readonly string $userAgent = 'Flex-CMS-Update-Client/1.0',
    ) {}

    public function get(string $url, array $headers = []): RemoteCatalogTransportResponse
    {
        $handle = curl_init($url);
        if ($handle === false) {
            throw new RemoteCatalogException('The update catalog HTTP client could not be initialized.');
        }

        $responseHeaders = [];
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => min($this->timeout, 10),
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_USERAGENT => $this->userAgent,
            CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$responseHeaders): int {
                $separator = strpos($line, ':');
                if ($separator !== false) {
                    $name = strtolower(trim(substr($line, 0, $separator)));
                    $value = trim(substr($line, $separator + 1));
                    if ($name !== '') {
                        $responseHeaders[$name] = $value;
                    }
                }

                return strlen($line);
            },
        ]);

        $body = curl_exec($handle);
        $error = curl_error($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);

        if ($body === false) {
            throw new RemoteCatalogException(sprintf('The update catalog request failed: %s', $error !== '' ? $error : 'unknown transport error.'));
        }

        return new RemoteCatalogTransportResponse($status, $body, $responseHeaders);
    }
}
