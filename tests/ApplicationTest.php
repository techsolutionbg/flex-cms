<?php

declare(strict_types=1);

namespace Flex\Tests;

use PHPUnit\Framework\TestCase;

final class ApplicationTest extends TestCase
{
    public function testProjectBootstrapIsLoaded(): void
    {
        self::assertTrue(class_exists(\Flex\Application::class));
    }
}
