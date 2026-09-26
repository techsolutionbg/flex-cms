<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Contracts\Updates\RemotePackageTransportInterface;
use Flex\Updates\Exception\RemoteCatalogException;

final class CurlRemotePackageTransport implements RemotePackageTransportInterface
{
    public function __construct(
        private readonly int $timeout = 300,
        private readonly string $userAgent = 'Flex-CMS-Update-Client/1.0',
    ) {}

    public function download(string $url, string $destination, int $maximumBytes): int
    {
        $file = @fopen($destination, 'wb');
        if ($file === false) {
            throw new RemoteCatalogException('The update package temporary file cannot be opened.');
        }

        $bytes = 0;
        $overflow = false;
        $handle = curl_init($url);
        if ($handle === false) {
            fclose($file);
            throw new RemoteCatalogException('The update package HTTP client could not be initialized.');
        }

        curl_setopt_array($handle, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_USERAGENT => $this->userAgent,
            CURLOPT_HTTPHEADER => ['Accept: application/zip, application/octet-stream'],
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$bytes, &$overflow, $maximumBytes, $file): int {
                $length = strlen($chunk);
                if ($bytes + $length > $maximumBytes) {
                    $overflow = true;

                    return 0;
                }
                $written = fwrite($file, $chunk);
                if ($written === false || $written !== $length) {
                    return 0;
                }
                $bytes += $written;

                return $written;
            },
        ]);

        $success = curl_exec($handle);
        $error = curl_error($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
        fclose($file);

        if ($success === false || $overflow) {
            @unlink($destination);
            throw new RemoteCatalogException($overflow ? 'The update package exceeds the configured download limit.' : sprintf('The update package download failed: %s', $error !== '' ? $error : 'unknown transport error.'));
        }
        if ($status !== 200) {
            @unlink($destination);
            throw new RemoteCatalogException(sprintf('The update package request returned HTTP %d.', $status));
        }

        return $bytes;
    }
}
