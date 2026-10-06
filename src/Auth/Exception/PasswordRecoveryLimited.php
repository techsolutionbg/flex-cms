<?php

declare(strict_types=1);

namespace Flex\Auth\Exception;

final class PasswordRecoveryLimited extends \InvalidArgumentException
{
    public function __construct(public readonly int $retryAfter)
    {
        parent::__construct('Твърде много заявки. Изчакайте и опитайте отново.', 429);
    }
}