<?php

declare(strict_types=1);

namespace Flex\Configuration\Exception;

final class ConfigurationValidationFailed extends ConfigurationException
{
    /** @param list<string> $errors */
    public function __construct(
        public readonly array $errors,
    ) {
        parent::__construct("The application configuration is invalid:\n- " . implode("\n- ", $errors));
    }
}
