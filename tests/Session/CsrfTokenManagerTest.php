<?php

declare(strict_types=1);

namespace Flex\Tests\Session;

use Flex\Configuration\ConfigurationRepository;
use Flex\Session\CsrfTokenManager;
use Flex\Tests\Support\ArraySession;
use PHPUnit\Framework\TestCase;

final class CsrfTokenManagerTest extends TestCase
{
    public function testItCreatesValidatesAndRotatesTokens(): void
    {
        $session = new ArraySession();
        $tokens = new CsrfTokenManager(
            $session,
            new ConfigurationRepository(['session' => ['csrf_token_lifetime' => 7200]]),
        );

        $first = $tokens->token();
        self::assertSame(64, strlen($first));
        self::assertTrue($tokens->validate($first));
        self::assertFalse($tokens->validate('invalid'));

        $second = $tokens->rotate();
        self::assertNotSame($first, $second);
        self::assertFalse($tokens->validate($first));
        self::assertTrue($tokens->validate($second));
    }
}
