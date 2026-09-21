<?php

declare(strict_types=1);

namespace Flex\Installer;

final readonly class RequirementsReport
{
    /** @param list<Requirement> $requirements */
    public function __construct(
        public array $requirements,
    ) {}

    public function passed(): bool
    {
        foreach ($this->requirements as $requirement) {
            if (!$requirement->passed) {
                return false;
            }
        }

        return true;
    }
}
