<?php

declare(strict_types=1);

namespace Flex\Tests\PageBuilder;

use Flex\PageBuilder\HtmlCompiler;
use PHPUnit\Framework\TestCase;

final class HtmlCompilerTest extends TestCase
{
    private HtmlCompiler $compiler;

    protected function setUp(): void
    {
        require_once dirname(__DIR__, 2) . '/plugins/flex/page-builder/src/HtmlCompiler.php';
        $this->compiler = new HtmlCompiler();
    }

    public function testItCompilesEscapedContentInsideTheBuilderRoot(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'title', 'type' => 'heading', 'level' => 6, 'text' => '<script>', 'size' => 14, 'line_height' => 1.5, 'weight' => 700, 'align' => 'center', 'background' => '#112233', 'radius' => 8, 'border_width' => 1, 'border_color' => 'red'],
            ['id' => 'link', 'type' => 'button', 'text' => 'Напред', 'url' => 'javascript:alert(1)'],
            ['id' => 'gap', 'type' => 'spacer', 'height' => 24],
        ], static fn(int $id): string => '/media/' . $id);

        self::assertStringStartsWith('<div class="fpb-root">', $html);
        self::assertStringContainsString('text-align:center', $html);
        self::assertStringContainsString('background:#112233', $html);
        self::assertStringContainsString('border-radius:8px', $html);
        self::assertStringContainsString('border:1px solid #111827', $html);
        self::assertStringNotContainsString('red', $html);
        self::assertStringContainsString('<h6 style="font-size:14px;line-height:1.5;font-weight:700">&lt;script&gt;</h6>', $html);
        self::assertStringContainsString('href="#"', $html);
        self::assertStringContainsString('height:24px', $html);
        self::assertStringNotContainsString('<script>', $html);
    }

    public function testItDropsUnsafeMarkupFromTheHtmlElement(): void
    {
        $html = $this->compiler->compile([
            ['type' => 'html', 'html' => '<p onclick="evil()">Текст</p><script>alert(1)</script>'],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('<p>Текст</p>', $html);
        self::assertStringNotContainsString('onclick', $html);
        self::assertStringNotContainsString('<script>', $html);
    }

    public function testItOmitsAnImageWithoutAPublicAddress(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'photo', 'type' => 'image', 'media_id' => 4, 'alt' => 'Лого'],
        ], static fn(int $id): string => '');

        self::assertStringNotContainsString('<img', $html);
        self::assertSame('', $html);
    }

    public function testItRendersAnEmptySectionAndTheElementsInsideIt(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'background' => '#abcdef', 'padding' => 12, 'children' => [
                ['id' => 'title', 'type' => 'heading', 'level' => 2, 'text' => 'Вътре'],
            ]],
            ['id' => 'empty', 'type' => 'section', 'children' => []],
        ], static fn(int $id): string => '');

        self::assertSame(2, substr_count($html, 'class="fpb-section"'));
        self::assertStringContainsString('background:#abcdef', $html);
        self::assertStringContainsString('padding:12px', $html);
        self::assertStringContainsString('<h2>Вътре</h2>', $html);
        self::assertStringNotContainsString('fpb-section--full', $html);
    }

    public function testItRendersAFullWidthSection(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'hero', 'type' => 'section', 'full_width' => true, 'children' => [
                ['id' => 'title', 'type' => 'heading', 'level' => 1, 'text' => 'Широка'],
            ]],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('class="fpb-section fpb-section--full"', $html);
        self::assertStringContainsString('<h1>Широка</h1>', $html);
        self::assertTrue($this->compiler->normalize([
            ['id' => 'hero', 'type' => 'section', 'full_width' => true, 'children' => []],
        ])[0]['full_width']);
    }

    public function testItRendersSectionVerticalPadding(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'padding_top' => 0, 'padding_bottom' => 48, 'children' => [
                ['id' => 'title', 'type' => 'heading', 'level' => 2, 'text' => 'Отстъп'],
            ]],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('padding-top:0px', $html);
        self::assertStringContainsString('padding-bottom:48px', $html);
    }

    public function testItRendersPaddingAndMarginOnALeafElement(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'title', 'type' => 'heading', 'level' => 2, 'text' => 'Поле', 'padding_left' => 16, 'margin_top' => 8, 'margin_bottom' => 0],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('padding-left:16px', $html);
        self::assertStringContainsString('margin-top:8px', $html);
        self::assertStringContainsString('margin-bottom:0px', $html);
    }

    public function testItRendersColumnsInsideASection(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'children' => [
                ['id' => 'row', 'type' => 'columns', 'columns' => 3, 'children' => [
                    ['id' => 'c1', 'type' => 'column', 'children' => [
                        ['id' => 'title', 'type' => 'heading', 'level' => 2, 'text' => 'Лява'],
                    ]],
                    ['id' => 'c2', 'type' => 'column', 'children' => []],
                    ['id' => 'c3', 'type' => 'column', 'children' => []],
                ]],
            ]],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('class="fpb-columns"', $html);
        self::assertSame(3, substr_count($html, 'class="fpb-column"'));
        self::assertStringContainsString('grid-template-columns:repeat(3,minmax(0,1fr))', $html);
        self::assertStringContainsString('<h2>Лява</h2>', $html);
    }

    public function testItAppliesGlobalDefaultsWhenAnElementValueIsMissing(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'title', 'type' => 'heading', 'text' => 'Наследство'],
            ['id' => 'own', 'type' => 'heading', 'level' => 3, 'text' => 'Собствено', 'size' => 20],
        ], static fn(int $id): string => '', [
            'heading' => ['level' => 1, 'size' => 40, 'color' => '#112233'],
        ]);

        self::assertStringContainsString('<h1 style="font-size:40px">Наследство</h1>', $html);
        self::assertStringContainsString('color:#112233', $html);
        self::assertStringContainsString('<h3 style="font-size:20px">Собствено</h3>', $html);
    }

    public function testItKeepsAnExplicitFalseOverAGlobalFullWidthSection(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'full_width' => false, 'children' => []],
            ['id' => 'wide', 'type' => 'section', 'children' => []],
        ], static fn(int $id): string => '', [
            'section' => ['full_width' => true],
        ]);

        self::assertSame(1, substr_count($html, 'fpb-section--full'));
        self::assertStringContainsString('class="fpb-section" data-fpb-id="band"', $html);
        self::assertStringContainsString('class="fpb-section fpb-section--full" data-fpb-id="wide"', $html);
    }

    public function testItRendersAPresetSectionGradientOverASolidBackground(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'background' => '#abcdef', 'gradient' => 'ocean', 'children' => []],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('background:linear-gradient(160deg,#0ea5e9,#0369a1)', $html);
        self::assertStringNotContainsString('background:#abcdef', $html);
    }

    public function testItRendersACustomSectionGradient(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'gradient' => 'custom', 'gradient_from' => '#112233', 'gradient_to' => '#445566', 'gradient_angle' => 90, 'children' => []],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('background:linear-gradient(90deg,#112233,#445566)', $html);
    }

    public function testItRendersASectionWallpaper(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'background' => '#abcdef', 'gradient' => 'ocean', 'children' => []],
        ], static fn(int $id): string => '/media/' . $id);

        self::assertStringContainsString('background-color:#abcdef', $html);
        self::assertStringContainsString('background-image:url("/media/4")', $html);
        self::assertStringContainsString('background-size:cover', $html);
        self::assertStringNotContainsString('linear-gradient', $html);

        $fitted = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'wallpaper_fit' => 'contain', 'children' => []],
        ], static fn(int $id): string => '/media/' . $id);
        self::assertStringContainsString('background-size:contain', $fitted);
    }

    public function testItOmitsASectionWallpaperWithoutAPublicAddress(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'wallpaper_fit' => 'contain', 'children' => []],
        ], static fn(int $id): string => '');

        self::assertStringNotContainsString('background-image', $html);
    }
}
