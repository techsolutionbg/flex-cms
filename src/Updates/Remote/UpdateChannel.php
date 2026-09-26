<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

enum UpdateChannel: string
{
    case STABLE = 'stable';
    case BETA = 'beta';
    case DEV = 'dev';
}
