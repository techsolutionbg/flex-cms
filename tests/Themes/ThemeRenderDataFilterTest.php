<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Extensions\ExtensionApi;
use Flex\Themes\ThemeManager;
use PHPUnit\Framework\TestCase;

final class ThemeRenderDataFilterTest extends TestCase
{
    public function testRenderDataFilterCanInjectBuilderChromeVariables(): void
    {
        $directory = sys_get_temp_dir() . '/flex-render-data-' . bin2hex(random_bytes(4));
        mkdir($directory . '/themes/demo', 0777, true);
        file_put_contents($directory . '/themes/demo/theme.json', '{"id":"demo","name":"Demo","version":"1.0.0"}');
        file_put_contents(
            $directory . '/themes/demo/index.php',
            '<?php echo ($flex_builder_header ?? "null") . "|" . ($flex_builder_footer ?? "null");',
        );

        try {
            $api = new ExtensionApi();
            $api->addFilter('theme.render.data', static function (mixed $data): mixed {
                if (!is_array($data)) {
                    return $data;
                }
                $data['flex_builder_header'] = '<header>H</header>';
                $data['flex_builder_footer'] = '<footer>F</footer>';

                return $data;
            });

            $config = new ConfigurationRepository([
                'paths' => ['themes' => 'themes'],
                'app' => ['active_theme' => 'demo'],
            ]);
            $manager = new ThemeManager(new ProjectPaths($directory, $config), $config, null, $api);

            self::assertSame('<header>H</header>|<footer>F</footer>', $manager->renderForTheme('demo', 'page.twig'));
        } finally {
            @unlink($directory . '/themes/demo/index.php');
            @unlink($directory . '/themes/demo/theme.json');
            @rmdir($directory . '/themes/demo');
            @rmdir($directory . '/themes');
            @rmdir($directory);
        }
    }

    public function testRenderDataFilterFallbackKeepsOriginalDataWhenFilterReturnsNonArray(): void
    {
        $directory = sys_get_temp_dir() . '/flex-render-data-fb-' . bin2hex(random_bytes(4));
        mkdir($directory . '/themes/demo', 0777, true);
        file_put_contents($directory . '/themes/demo/theme.json', '{"id":"demo","name":"Demo","version":"1.0.0"}');
        file_put_contents(
            $directory . '/themes/demo/index.php',
            '<?php echo ($title ?? "") . "|" . (array_key_exists("flex_builder_header", get_defined_vars()) ? "set" : "unset");',
        );

        try {
            $api = new ExtensionApi();
            $api->addFilter('theme.render.data', static fn(mixed $data): mixed => 'broken');

            $config = new ConfigurationRepository([
                'paths' => ['themes' => 'themes'],
                'app' => ['active_theme' => 'demo'],
            ]);
            $manager = new ThemeManager(new ProjectPaths($directory, $config), $config, null, $api);

            self::assertSame('Hello|unset', $manager->renderForTheme('demo', 'page.twig', ['title' => 'Hello']));
        } finally {
            @unlink($directory . '/themes/demo/index.php');
            @unlink($directory . '/themes/demo/theme.json');
            @rmdir($directory . '/themes/demo');
            @rmdir($directory . '/themes');
            @rmdir($directory);
        }
    }
}
