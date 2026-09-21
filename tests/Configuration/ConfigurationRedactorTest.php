<?php

declare(strict_types=1);

namespace Flex\Tests\Configuration;

use Flex\Configuration\ConfigurationRedactor;
use PHPUnit\Framework\TestCase;

final class ConfigurationRedactorTest extends TestCase
{
    public function testItRedactsSecretsAndPreservesLists(): void
    {
        $configuration = [
            'providers' => ['ProviderOne', 'ProviderTwo'],
            'database' => ['username' => 'flex', 'password' => 'secret'],
            'app_key' => 'secret-key',
        ];

        self::assertSame([
            'providers' => ['ProviderOne', 'ProviderTwo'],
            'database' => ['username' => 'flex', 'password' => '[REDACTED]'],
            'app_key' => '[REDACTED]',
        ], (new ConfigurationRedactor())->redact($configuration));
    }
}
