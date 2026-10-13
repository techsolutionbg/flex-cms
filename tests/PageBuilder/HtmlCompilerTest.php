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

    public function testItHidesASectionOnThePublicPage(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'hidden' => true, 'children' => [
                ['id' => 'title', 'type' => 'heading', 'level' => 2, 'text' => 'Скрита'],
            ]],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('class="fpb-section fpb-is-hidden"', $html);
        self::assertStringContainsString('<h2>Скрита</h2>', $html);
        self::assertTrue($this->compiler->normalize([
            ['id' => 'band', 'type' => 'section', 'hidden' => true, 'children' => []],
        ])[0]['hidden']);
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

    public function testItKeepsACustomNameOnASection(): void
    {
        $normalized = $this->compiler->normalize([
            ['id' => 'hero', 'type' => 'section', 'name' => '  Начало  ', 'children' => []],
        ]);

        self::assertSame('Начало', $normalized[0]['name']);
    }

    public function testItBoxesANestedSectionThatIsNotFullWidth(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'outer', 'type' => 'section', 'full_width' => true, 'children' => [
                ['id' => 'inner', 'type' => 'section', 'full_width' => false, 'children' => []],
                ['id' => 'wide', 'type' => 'section', 'full_width' => true, 'children' => []],
            ]],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('class="fpb-section fpb-section--boxed" data-fpb-id="inner"', $html);
        self::assertStringContainsString('class="fpb-section fpb-section--full" data-fpb-id="wide"', $html);
        self::assertStringContainsString('class="fpb-section fpb-section--full" data-fpb-id="outer"', $html);
    }

    public function testItRendersASectionInsideASection(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'outer', 'type' => 'section', 'children' => [
                ['id' => 'inner', 'type' => 'section', 'background' => '#abcdef', 'children' => [
                    ['id' => 'title', 'type' => 'heading', 'level' => 2, 'text' => 'Вътрешна'],
                ]],
            ]],
        ], static fn(int $id): string => '');

        self::assertSame(2, substr_count($html, 'data-fpb-type="section"'));
        self::assertStringContainsString('data-fpb-id="inner"', $html);
        self::assertStringContainsString('<h2>Вътрешна</h2>', $html);
        self::assertSame('inner', $this->compiler->normalize([
            ['id' => 'outer', 'type' => 'section', 'children' => [
                ['id' => 'inner', 'type' => 'section', 'children' => []],
            ]],
        ])[0]['children'][0]['id']);
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
        self::assertStringContainsString('class="fpb-section-wallpaper"', $html);
        self::assertStringContainsString("background-image:url('/media/4')", $html);
        self::assertStringContainsString('background-size:cover', $html);
        self::assertStringNotContainsString('linear-gradient', $html);
        self::assertStringNotContainsString('<img', $html);
        self::assertMatchesRegularExpression(
            '/fpb-section-wallpaper"[^>]*background-color:#abcdef[^>]*background-image:url\(\'\/media\/4\'\)/',
            $html
        );

        $fitted = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'wallpaper_fit' => 'contain', 'children' => []],
        ], static fn(int $id): string => '/media/' . $id);
        self::assertStringContainsString('background-size:contain', $fitted);

        $anchored = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'wallpaper_position' => 'top-left', 'children' => []],
        ], static fn(int $id): string => '/media/' . $id);
        self::assertStringContainsString('background-position:left top', $anchored);

        $bottomRight = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'wallpaper_position' => 'bottom-right', 'children' => []],
        ], static fn(int $id): string => '/media/' . $id);
        self::assertStringContainsString('background-position:right bottom', $bottomRight);

        $invalidPosition = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'wallpaper_position' => 'somewhere', 'children' => []],
        ], static fn(int $id): string => '/media/' . $id);
        self::assertStringContainsString('background-position:center', $invalidPosition);
    }

    public function testItEmitsTabletAndPhoneStyleOverrides(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'title', 'type' => 'heading', 'level' => 2, 'text' => 'Заглавие', 'size' => 40, 'tablet' => ['size' => 28], 'phone' => ['size' => 18, 'hidden' => true]],
            ['id' => 'row', 'type' => 'columns', 'columns' => 3, 'children' => [
                ['id' => 'c1', 'type' => 'column', 'children' => []],
                ['id' => 'c2', 'type' => 'column', 'children' => []],
                ['id' => 'c3', 'type' => 'column', 'children' => []],
            ], 'phone' => ['columns' => 1]],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('@media (max-width:1023px)', $html);
        self::assertStringContainsString('[data-fpb-id="title"]', $html);
        self::assertStringContainsString('font-size:28px', $html);
        self::assertStringContainsString('@media (max-width:639px)', $html);
        self::assertStringContainsString('font-size:18px', $html);
        self::assertStringContainsString('display:none', $html);
        self::assertStringContainsString('grid-template-columns:repeat(1,minmax(0,1fr))', $html);
    }

    public function testItKeepsOnlyValidBreakpointOverrides(): void
    {
        $normalized = $this->compiler->normalize([
            ['id' => 'title', 'type' => 'heading', 'text' => 'X', 'tablet' => ['size' => 16, 'align' => 'center', 'junk' => true], 'phone' => ['hidden' => true]],
        ]);

        self::assertSame(['size' => 16, 'align' => 'center'], $normalized[0]['tablet']);
        self::assertSame(['hidden' => true], $normalized[0]['phone']);
    }

    public function testItRendersASectionOverlay(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'overlay_color' => '#000', 'overlay_opacity' => 50, 'children' => []],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('class="fpb-section-overlay"', $html);
        self::assertStringContainsString('background:rgba(0,0,0,0.5)', $html);
    }

    public function testItRendersAGrayscaleImage(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'photo', 'type' => 'image', 'media_id' => 4, 'alt' => 'Лого', 'image_filter' => 'grayscale'],
        ], static fn(int $id): string => '/media/' . $id);

        self::assertStringContainsString('fpb-photo--grayscale', $html);
        self::assertStringNotContainsString('fpb-photo--grayscale', $this->compiler->compile([
            ['id' => 'photo', 'type' => 'image', 'media_id' => 4, 'alt' => 'Лого'],
        ], static fn(int $id): string => '/media/' . $id));
    }

    public function testItRendersAGrayscaleWallpaper(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'image_filter' => 'grayscale', 'children' => []],
        ], static fn(int $id): string => '/media/' . $id);

        self::assertStringContainsString('fpb-section-wallpaper', $html);
        self::assertStringContainsString('fpb-photo--grayscale', $html);
    }

    public function testItRendersTextEffectsOnAHeading(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'title', 'type' => 'heading', 'level' => 2, 'text' => 'Сянка', 'shadow_color' => '#112233', 'shadow_x' => 1, 'shadow_y' => 3, 'shadow_blur' => 6, 'italic' => true, 'text_transform' => 'uppercase', 'letter_spacing' => 2, 'stroke_width' => 1, 'stroke_color' => '#000'],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('text-shadow:1px 3px 6px #112233', $html);
        self::assertStringContainsString('font-style:italic', $html);
        self::assertStringContainsString('text-transform:uppercase', $html);
        self::assertStringContainsString('letter-spacing:2px', $html);
        self::assertStringContainsString('-webkit-text-stroke:1px #000', $html);
    }

    public function testItRendersAnImageColorFilter(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'photo', 'type' => 'image', 'media_id' => 4, 'alt' => 'Лого', 'image_tint' => '#7c3aed', 'image_tint_opacity' => 40],
        ], static fn(int $id): string => '/media/' . $id);

        self::assertStringContainsString('fpb-photo--tint', $html);
        self::assertStringContainsString('--fpb-tint:#7c3aed', $html);
        self::assertStringContainsString('--fpb-tint-opacity:0.4', $html);
    }

    public function testItOmitsASectionOverlayWithoutAColor(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'overlay_opacity' => 50, 'children' => []],
        ], static fn(int $id): string => '');

        self::assertStringNotContainsString('fpb-section-overlay', $html);
    }

    public function testItOmitsASectionWallpaperWithoutAPublicAddress(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'wallpaper_fit' => 'contain', 'children' => []],
        ], static fn(int $id): string => '');

        self::assertStringNotContainsString('background-image', $html);
    }

    public function testItRendersAPresetPatternWallpaper(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_preset' => 'dots', 'children' => []],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('fpb-section-wallpaper', $html);
        self::assertStringContainsString('fpb-pattern fpb-pattern-dots', $html);
        self::assertStringNotContainsString('<img', $html);
    }

    public function testItOmitsAnUnknownPatternWallpaper(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_preset' => 'not-a-pattern', 'children' => []],
        ], static fn(int $id): string => '');

        self::assertStringNotContainsString('fpb-pattern', $html);
    }

    public function testItPrefersAMediaWallpaperOverAPatternPreset(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'band', 'type' => 'section', 'wallpaper_id' => 4, 'wallpaper_preset' => 'dots', 'children' => []],
        ], static fn(int $id): string => '/media/' . $id);

        self::assertStringContainsString("background-image:url('/media/4')", $html);
        self::assertStringNotContainsString('fpb-pattern-dots', $html);
    }

    public function testItResolvesButtonLinksToPages(): void
    {
        $paths = [3 => '/kontakt', 1 => '/'];
        $html = $this->compiler->compile([
            ['id' => 'to-page', 'type' => 'button', 'text' => 'Контакт', 'link_type' => 'page', 'page_id' => 3],
            ['id' => 'custom', 'type' => 'button', 'text' => 'Външен', 'link_type' => 'url', 'url' => 'https://example.com/x'],
            ['id' => 'missing', 'type' => 'button', 'text' => 'Липсва', 'link_type' => 'page', 'page_id' => 99],
        ], static fn(int $id): string => '', [], static fn(int $id): string => $paths[$id] ?? '');

        self::assertStringContainsString('href="/kontakt"', $html);
        self::assertStringContainsString('href="https://example.com/x"', $html);
        self::assertStringContainsString('href="#">Липсва</a>', $html);
    }

    public function testItKeepsLegacyButtonUrlWhenLinkTypeIsMissing(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'legacy', 'type' => 'button', 'text' => 'Начало', 'url' => '/home'],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('href="/home"', $html);
    }

    public function testItEmitsButtonHoverStyles(): void
    {
        $html = $this->compiler->compile([
            [
                'id' => 'cta',
                'type' => 'button',
                'text' => 'Към нас',
                'url' => '/contacts',
                'hover_background' => '#0ea5e9',
                'hover_color' => '#ffffff',
                'hover_border_color' => '#0369a1',
            ],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('[data-fpb-id="cta"] .fpb-button:hover{', $html);
        self::assertStringContainsString('background:#0ea5e9', $html);
        self::assertStringContainsString('color:#ffffff', $html);
        self::assertStringContainsString('border-color:#0369a1', $html);
        self::assertStringContainsString('transition:background-color .2s ease,color .2s ease,border-color .2s ease', $html);
    }

    public function testItSkipsButtonHoverStylesWhenUnset(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'plain', 'type' => 'button', 'text' => 'Ок', 'url' => '/'],
        ], static fn(int $id): string => '');

        self::assertStringNotContainsString(':hover', $html);
    }

    public function testItAppliesNamedButtonStylesBeforeDefaults(): void
    {
        $html = $this->compiler->compile(
            [
                ['id' => 'cta', 'type' => 'button', 'text' => 'CTA', 'url' => '/', 'button_style_id' => 'bs_primary'],
            ],
            static fn(int $id): string => '',
            ['button' => ['background' => '#111827', 'color' => '#ffffff']],
            null,
            [
                [
                    'id' => 'bs_primary',
                    'name' => 'Основен',
                    'background' => '#0ea5e9',
                    'color' => '#f8fafc',
                    'hover_background' => '#0369a1',
                ],
            ],
        );

        self::assertStringContainsString('background:#0ea5e9', $html);
        self::assertStringContainsString('color:#f8fafc', $html);
        self::assertStringContainsString('[data-fpb-id="cta"] .fpb-button:hover{background:#0369a1}', $html);
        self::assertStringNotContainsString('background:#111827', $html);
    }

    public function testItLetsLocalButtonStylesOverrideNamedDesigns(): void
    {
        $html = $this->compiler->compile(
            [
                [
                    'id' => 'cta',
                    'type' => 'button',
                    'text' => 'CTA',
                    'url' => '/',
                    'button_style_id' => 'bs_primary',
                    'background' => '#be123c',
                ],
            ],
            static fn(int $id): string => '',
            [],
            null,
            [
                [
                    'id' => 'bs_primary',
                    'name' => 'Основен',
                    'background' => '#0ea5e9',
                    'color' => '#ffffff',
                ],
            ],
        );

        self::assertStringContainsString('background:#be123c', $html);
        self::assertStringContainsString('color:#ffffff', $html);
    }

    public function testItFallsBackToDefaultsWhenButtonStyleIsMissing(): void
    {
        $html = $this->compiler->compile(
            [
                ['id' => 'cta', 'type' => 'button', 'text' => 'CTA', 'url' => '/', 'button_style_id' => 'bs_missing'],
            ],
            static fn(int $id): string => '',
            ['button' => ['background' => '#111827', 'color' => '#ffffff']],
            null,
            [
                ['id' => 'bs_primary', 'name' => 'Основен', 'background' => '#0ea5e9'],
            ],
        );

        self::assertStringContainsString('background:#111827', $html);
        self::assertStringContainsString('color:#ffffff', $html);
    }

    public function testItNormalizesButtonStyles(): void
    {
        $styles = $this->compiler->normalizeButtonStyles([
            ['id' => 'bs_ok', 'name' => '  CTA  ', 'background' => '#0ea5e9', 'hover_color' => '#fff'],
            ['id' => 'nope', 'name' => 'Bad'],
            ['id' => 'bs_ok', 'name' => 'Duplicate'],
            'skip',
        ]);

        self::assertCount(1, $styles);
        self::assertSame('bs_ok', $styles[0]['id']);
        self::assertSame('CTA', $styles[0]['name']);
        self::assertSame('#0ea5e9', $styles[0]['background']);
        self::assertSame('#fff', $styles[0]['hover_color']);
    }
}
