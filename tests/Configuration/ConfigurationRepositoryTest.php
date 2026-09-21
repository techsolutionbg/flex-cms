<?php

declare(strict_types=1);

namespace Flex\Tests\Configuration;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\Exception\ConfigurationKeyNotFound;
use Flex\Configuration\Exception\InvalidConfigurationValue;
use PHPUnit\Framework\TestCase;

final class ConfigurationRepositoryTest extends TestCase
{
    public function testItResolvesDotNotationAndTypedValues(): void
    {
        $configuration = new ConfigurationRepository([
            'app' => [
                'name' => 'Flex CMS',
                'debug' => true,
                'retries' => 3,
                'locales' => ['bg', 'en'],
            ],
        ]);

        self::assertTrue($configuration->has('app.name'));
        self::assertFalse($configuration->has('app.missing'));
        self::assertSame('Flex CMS', $configuration->string('app.name'));
        self::assertTrue($configuration->bool('app.debug'));
        self::assertSame(3, $configuration->int('app.retries'));
        self::assertSame(['bg', 'en'], $configuration->array('app.locales'));
        self::assertSame('fallback', $configuration->string('app.missing', 'fallback'));
    }

    public function testTypedGetterRejectsWrongType(): void
    {
        $configuration = new ConfigurationRepository(['app' => ['debug' => 'true']]);

        $this->expectException(InvalidConfigurationValue::class);
        $configuration->bool('app.debug');
    }

    public function testTypedGetterRejectsMissingKeyWithoutDefault(): void
    {
        $configuration = new ConfigurationRepository([]);

        $this->expectException(ConfigurationKeyNotFound::class);
        $configuration->string('app.name');
    }
}
