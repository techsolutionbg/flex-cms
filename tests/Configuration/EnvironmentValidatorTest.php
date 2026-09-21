<?php

declare(strict_types=1);

namespace Flex\Tests\Configuration;

use Flex\Configuration\ConfigurationLoader;
use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\EnvironmentLoader;
use Flex\Configuration\EnvironmentValidator;
use Flex\Configuration\Exception\ConfigurationValidationFailed;
use PHPUnit\Framework\TestCase;

final class EnvironmentValidatorTest extends TestCase
{
    public function testProjectConfigurationIsValid(): void
    {
        $basePath = dirname(__DIR__, 2);
        (new EnvironmentLoader())->load($basePath);
        $configuration = (new ConfigurationLoader())->load($basePath, false);

        (new EnvironmentValidator())->validate($configuration);

        self::addToAssertionCount(1);
    }

    public function testItReportsAllInvalidEnvironmentValues(): void
    {
        $configuration = new ConfigurationRepository([
            'app' => [
                'name' => '', 'environment' => 'production', 'url' => 'invalid', 'key' => 'weak',
                'timezone' => 'Invalid/Zone', 'locale' => 'invalid_locale', 'fallback_locale' => 'en',
                'debug' => true, 'force_https' => false,
            ],
            'database' => [
                'driver' => 'sqlite', 'host' => '', 'database' => '', 'username' => '',
                'charset' => '', 'collation' => '', 'port' => 70000,
            ],
            'session' => ['same_site' => 'none', 'secure' => false],
            'paths' => [
                'storage' => '../storage', 'plugins' => 'plugins', 'themes' => 'themes', 'public_media' => 'public/media',
            ],
        ]);

        try {
            (new EnvironmentValidator())->validate($configuration);
            self::fail('Validation was expected to fail.');
        } catch (ConfigurationValidationFailed $exception) {
            self::assertGreaterThanOrEqual(10, count($exception->errors));
        }
    }
}
