<?php

declare(strict_types=1);

namespace Flex\Container\Exception;

use RuntimeException;
use Psr\Container\ContainerExceptionInterface;

final class ContainerException extends RuntimeException implements ContainerExceptionInterface
{
}
