<?php

declare(strict_types=1);

namespace Flex\Configuration;

final class ConfigurationRedactor
{
    /** @param array<array-key, mixed> $configuration
     *  @return array<array-key, mixed>
     */
    public function redact(array $configuration): array
    {
        $result = [];
        foreach ($configuration as $key => $value) {
            if (is_string($key) && $this->isSensitive($key)) {
                $result[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $result[$key] = $this->redact($value);
            } else {
                $result[$key] = $value;
            }
        }

        return $result;
    }

    private function isSensitive(string $key): bool
    {
        return preg_match('/(?:key|password|secret|token|dsn)$/i', $key) === 1;
    }
}
