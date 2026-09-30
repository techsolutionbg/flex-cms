<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Themes\Exception\InvalidThemeManifest;
use Flex\Themes\ThemeManifest;
use PHPUnit\Framework\TestCase;

final class ThemeManifestTest extends TestCase
{
    public function testItValidatesThemeMetadata(): void
    {
        $manifest = ThemeManifest::fromArray(['id' => 'flex-default', 'name' => 'Flex Default', 'version' => '1.2.0', 'author' => 'Flex CMS']);

        self::assertSame('flex-default', $manifest->id);
        self::assertSame('1.2.0', $manifest->version);
        self::assertSame('Flex CMS', $manifest->author);
    }

    public function testItRejectsNonSemanticVersions(): void
    {
        $this->expectException(InvalidThemeManifest::class);
        ThemeManifest::fromArray(['id' => 'flex-default', 'name' => 'Flex Default', 'version' => 'latest']);
    }
}
