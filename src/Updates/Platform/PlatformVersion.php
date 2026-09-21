<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Composer\Semver\VersionParser;
use Flex\Updates\Exception\InvalidPlatformPackage;

final readonly class PlatformVersion
{
    public function __construct(
        public string $value,
    ) {
        try {
            (new VersionParser())->normalize($value);
        } catch (\UnexpectedValueException $exception) {
            throw new InvalidPlatformPackage(sprintf('Invalid platform version "%s".', $value), 0, $exception);
        }
    }

    public function compare(self $other): int
    {
        return version_compare($this->value, $other->value);
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
