<?php

declare(strict_types=1);

namespace Flex\Tests\ThemeContent;

use Flex\ThemeContent\ThemeContentSchemaValidator;
use PHPUnit\Framework\TestCase;

final class ThemeContentSchemaValidatorTest extends TestCase
{
    private string $directory;
    private ThemeContentSchemaValidator $validator;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-theme-content-schema-' . bin2hex(random_bytes(4));
        mkdir($this->directory . '/layouts', 0775, true);
        file_put_contents($this->directory . '/global.json', '{"sections":[]}');
        file_put_contents($this->directory . '/layouts/home.json', '{"sections":[{"id":"hero","label":"Hero","fields":[{"id":"title","type":"text","label":"Title"}]}]}');
        $this->validator = new ThemeContentSchemaValidator();
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory . '/*') ?: [] as $file) {
            is_dir($file) ? $this->removeDir($file) : unlink($file);
        }
        @rmdir($this->directory);
    }

    public function testValidManifestPasses(): void
    {
        $manifest = [
            'schema_version' => 1,
            'global' => ['file' => 'global.json', 'label' => 'Global'],
            'layouts' => [
                ['id' => 'home', 'label' => 'Home', 'file' => 'layouts/home.json', 'template' => 'landing'],
            ],
        ];
        self::assertSame([], $this->validator->validateManifest($manifest, $this->directory));
    }

    public function testPageBindingRequiresMatcher(): void
    {
        $manifest = [
            'schema_version' => 1,
            'global' => ['file' => 'global.json', 'label' => 'Global'],
            'layouts' => [
                ['id' => 'default', 'label' => 'Default', 'file' => 'layouts/home.json'],
            ],
            'pages' => [
                ['id' => 'start', 'label' => 'Start', 'file' => 'layouts/home.json'],
            ],
        ];
        $errors = $this->validator->validateManifest($manifest, $this->directory);
        self::assertNotSame([], $errors);
    }

    public function testPageBindingWithSlugPasses(): void
    {
        $manifest = [
            'schema_version' => 1,
            'global' => ['file' => 'global.json', 'label' => 'Global'],
            'layouts' => [
                ['id' => 'default', 'label' => 'Default', 'file' => 'layouts/home.json'],
            ],
            'pages' => [
                ['id' => 'start', 'label' => 'Start', 'file' => 'layouts/home.json', 'slug' => 'home'],
            ],
        ];
        self::assertSame([], $this->validator->validateManifest($manifest, $this->directory));
    }

    public function testManifestWithoutLayoutsPassesWhenPagesAreDefined(): void
    {
        $manifest = [
            'schema_version' => 1,
            'global' => ['file' => 'global.json', 'label' => 'Global'],
            'pages' => [
                ['id' => 'start', 'label' => 'Start', 'file' => 'layouts/home.json', 'slug' => 'home'],
            ],
        ];
        self::assertSame([], $this->validator->validateManifest($manifest, $this->directory));
    }

    public function testRepeaterDepthIsLimited(): void
    {
        $definition = [
            'sections' => [
                [
                    'id' => 'outer',
                    'label' => 'Outer',
                    'fields' => [
                        [
                            'id' => 'items',
                            'type' => 'repeater',
                            'label' => 'Items',
                            'fields' => [
                                [
                                    'id' => 'nested',
                                    'type' => 'repeater',
                                    'label' => 'Nested',
                                    'fields' => [
                                        ['id' => 'title', 'type' => 'text', 'label' => 'Title'],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];
        $errors = $this->validator->validateSectionsFile($definition, 'test');
        self::assertNotSame([], $errors);
    }

    private function removeDir(string $path): void
    {
        foreach (glob($path . '/*') ?: [] as $file) {
            is_dir($file) ? $this->removeDir($file) : unlink($file);
        }
        rmdir($path);
    }
}
