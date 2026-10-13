<?php

declare(strict_types=1);

namespace Flex\Tests\PageBuilder;

use Flex\Configuration\ConfigurationRepository;
use Flex\Database\DatabaseManager;
use Flex\PageBuilder\{ChromeStore, DocumentStore, HtmlCompiler, ThemeChrome};
use PHPUnit\Framework\TestCase;

final class ChromeStoreTest extends TestCase
{
    private DatabaseManager $database;
    private ChromeStore $store;
    private DocumentStore $documents;

    protected function setUp(): void
    {
        $root = dirname(__DIR__, 2) . '/plugins/flex/page-builder/src';
        require_once $root . '/HtmlCompiler.php';
        require_once $root . '/DocumentStore.php';
        require_once $root . '/ChromeStore.php';
        require_once $root . '/ThemeChrome.php';

        $config = new ConfigurationRepository([
            'database' => [
                'default' => 'sqlite',
                'connections' => [
                    'sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
                ],
            ],
        ]);
        $this->database = new DatabaseManager($config);
        $this->database->connection();
        $this->store = new ChromeStore($this->database->connection());
        $this->documents = new DocumentStore($this->database->connection());
        $this->store->install();
        $this->documents->install();
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
    }

    public function testItSavesAndLoadsChromeWithCompiledRoot(): void
    {
        $id = ChromeStore::newId();
        $compiler = new HtmlCompiler();
        $elements = $compiler->normalize([
            ['id' => 'h1', 'type' => 'heading', 'text' => 'Меню', 'level' => 2],
        ]);
        $html = $compiler->compile($elements, static fn(int $mediaId): string => '', [], null, [], 'header');
        $saved = $this->store->save($id, 'header', 'Основна шапка', $elements, $html);

        self::assertSame($id, $saved['id']);
        self::assertSame('header', $saved['kind']);
        self::assertSame('Основна шапка', $saved['name']);
        self::assertStringContainsString('fpb-root fpb-chrome fpb-chrome--header', $saved['html']);
        self::assertStringContainsString('Меню', $saved['html']);

        $loaded = $this->store->get($id);
        self::assertNotNull($loaded);
        self::assertSame('heading', $loaded['elements'][0]['type']);
        self::assertSame($html, $this->store->html($id));
    }

    public function testItListsByKind(): void
    {
        $headerId = ChromeStore::newId();
        $footerId = ChromeStore::newId();
        $this->store->save($headerId, 'header', 'H', [], '');
        $this->store->save($footerId, 'footer', 'F', [], '');

        self::assertCount(1, $this->store->list('header'));
        self::assertCount(1, $this->store->list('footer'));
        self::assertSame('H', $this->store->list('header')[0]['name']);
    }

    public function testDocumentRoundTripsHeaderAndFooterIds(): void
    {
        $headerId = ChromeStore::newId();
        $footerId = ChromeStore::newId();
        $this->store->save($headerId, 'header', 'H', [], '<div class="fpb-root fpb-chrome fpb-chrome--header">H</div>');
        $this->store->save($footerId, 'footer', 'F', [], '<div class="fpb-root fpb-chrome fpb-chrome--footer">F</div>');

        $this->documents->save(12, [['id' => 'p1', 'type' => 'paragraph', 'text' => 'Hi']], '<div class="fpb-root">Hi</div>', null, $headerId, $footerId);
        $loaded = $this->documents->get(12);
        self::assertNotNull($loaded);
        self::assertSame($headerId, $loaded['header_id']);
        self::assertSame($footerId, $loaded['footer_id']);

        $this->documents->save(12, [], '', null, 'bad', 'also-bad');
        $cleared = $this->documents->get(12);
        self::assertNotNull($cleared);
        self::assertNull($cleared['header_id']);
        self::assertNull($cleared['footer_id']);
    }

    public function testChromeIdRejectsInvalidValues(): void
    {
        self::assertNull(DocumentStore::chromeId(null));
        self::assertNull(DocumentStore::chromeId(''));
        self::assertNull(DocumentStore::chromeId('header-1'));
        self::assertSame('ch_abcd1234', DocumentStore::chromeId('ch_abcd1234'));
    }

    public function testThemeChromeInjectsHtmlWhenIdsSetAndNullWhenThemeOrInvalid(): void
    {
        $headerId = ChromeStore::newId();
        $footerId = ChromeStore::newId();
        $this->store->save($headerId, 'header', 'H', [], '<div class="fpb-root fpb-chrome fpb-chrome--header">HDR</div>');
        $this->store->save($footerId, 'footer', 'F', [], '<div class="fpb-root fpb-chrome fpb-chrome--footer">FTR</div>');
        $this->documents->save(5, [], '<div class="fpb-root"></div>', null, $headerId, $footerId);

        $chrome = new ThemeChrome($this->documents, $this->store);
        $withIds = $chrome->inject(['page' => ['id' => 5]]);
        self::assertSame('<div class="fpb-root fpb-chrome fpb-chrome--header">HDR</div>', $withIds['flex_builder_header']);
        self::assertSame('<div class="fpb-root fpb-chrome fpb-chrome--footer">FTR</div>', $withIds['flex_builder_footer']);

        $this->documents->save(5, [], '<div class="fpb-root"></div>', null, null, null);
        $fromTheme = $chrome->inject(['page' => ['id' => 5]]);
        self::assertNull($fromTheme['flex_builder_header']);
        self::assertNull($fromTheme['flex_builder_footer']);

        $this->documents->save(5, [], '<div class="fpb-root"></div>', null, 'ch_deadbeef', $footerId);
        $invalid = $chrome->inject(['page' => ['id' => 5]]);
        self::assertNull($invalid['flex_builder_header']);
        self::assertNotNull($invalid['flex_builder_footer']);

        // Wrong kind on the id → treat as theme.
        $this->documents->save(5, [], '<div class="fpb-root"></div>', null, $footerId, $headerId);
        $wrongKind = $chrome->inject(['page' => ['id' => 5]]);
        self::assertNull($wrongKind['flex_builder_header']);
        self::assertNull($wrongKind['flex_builder_footer']);
    }
}
