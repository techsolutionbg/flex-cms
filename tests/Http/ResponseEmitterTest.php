<?php

declare(strict_types=1);

namespace Flex\Tests\Http;

use Flex\Http\ResponseEmitter;
use Nyholm\Psr7\Response;
use PHPUnit\Framework\TestCase;

final class ResponseEmitterTest extends TestCase
{
    public function testItEmitsAndSuppressesResponseBodies(): void
    {
        $emitter = new ResponseEmitter();

        ob_start();
        $emitter->emit(new Response(200, [], 'content'));
        self::assertSame('content', ob_get_clean());

        ob_start();
        $emitter->emit(new Response(200, [], 'hidden'), true);
        self::assertSame('', ob_get_clean());
    }
}
