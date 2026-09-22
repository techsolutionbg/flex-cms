<?php

declare(strict_types=1);

namespace Flex\Pages\Exception;

final class PageValidationFailed extends \RuntimeException
{
    /** @param array<string, list<string>> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct(implode(' ', $errors));
    }
}
