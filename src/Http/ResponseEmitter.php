<?php

declare(strict_types=1);

namespace Flex\Http;

use Psr\Http\Message\ResponseInterface;

final class ResponseEmitter
{
    public function emit(ResponseInterface $response, bool $withoutBody = false): void
    {
        if (!headers_sent()) {
            http_response_code($response->getStatusCode());
            foreach ($response->getHeaders() as $name => $values) {
                $replace = strtolower($name) !== 'set-cookie';
                foreach ($values as $value) {
                    header(sprintf('%s: %s', $name, $value), $replace);
                    $replace = false;
                }
            }
        }

        if ($withoutBody || $this->statusHasNoBody($response->getStatusCode())) {
            return;
        }

        $body = $response->getBody();
        if ($body->isSeekable()) {
            $body->rewind();
        }
        while (!$body->eof()) {
            echo $body->read(8192);
        }
    }

    private function statusHasNoBody(int $status): bool
    {
        return ($status >= 100 && $status < 200) || in_array($status, [204, 304], true);
    }
}
