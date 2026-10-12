<?php

declare(strict_types=1);

namespace Flex\Themes\Exception;

final class ThemeResourceException extends \RuntimeException
{
    /** @param array<string, list<string>> $fields */
    public function __construct(string $message, int $code = 422, public readonly array $fields = [])
    {
        parent::__construct($message, $code);
    }
}
