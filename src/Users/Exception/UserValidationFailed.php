<?php

declare(strict_types=1);

namespace Flex\Users\Exception;

final class UserValidationFailed extends \DomainException
{
    /** @param list<string> $errors */
    public function __construct(
        public readonly array $errors,
    ) {
        parent::__construct(implode(' ', $errors));
    }
}
