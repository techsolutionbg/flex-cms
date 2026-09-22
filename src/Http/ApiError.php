<?php

declare(strict_types=1);

namespace Flex\Http;

final class ApiError
{
    /**
     * @param array<string, mixed> $details
     * @return array{error: array<string, mixed>}
     */
    public static function payload(int $status, string $code, string $message, array $details = []): array
    {
        $error = ['status' => $status, 'code' => $code, 'message' => $message];
        if ($details !== []) {
            $error['details'] = $details;
        }

        return ['error' => $error];
    }
}
