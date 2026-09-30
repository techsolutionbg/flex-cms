<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Themes\Exception\InvalidThemeReleaseManifest;
use Flex\Themes\ThemeReleaseManifest;
use PHPUnit\Framework\TestCase;

final class ThemeReleaseManifestTest extends TestCase
{
    public function testItValidatesASignedThemeReleaseContract(): void
    {
        $manifest = ThemeReleaseManifest::fromArray($this->data());

        self::assertSame('flex-default', $manifest->package);
        self::assertSame('1.1.0', $manifest->version);
        self::assertSame('theme', $manifest->signingData()['type']);
    }

    public function testItRejectsNonHttpsDownloads(): void
    {
        $this->expectException(InvalidThemeReleaseManifest::class);
        ThemeReleaseManifest::fromArray([...$this->data(), 'download_url' => 'http://example.test/theme.zip']);
    }

    /** @return array<string, mixed> */
    private function data(): array
    {
        return ['schema' => 1, 'package' => 'flex-default', 'version' => '1.1.0', 'channel' => 'stable', 'download_url' => 'https://updates.flex-cms.com/themes/flex-default/1.1.0/theme.zip', 'checksum' => str_repeat('a', 64), 'size' => 1024, 'minimum_php' => '>=8.3', 'compatible_from' => '>=0.1.0 <1.0.0', 'published_at' => '2026-09-30T12:00:00+00:00', 'release_notes' => 'Initial theme release.'];
    }
}
