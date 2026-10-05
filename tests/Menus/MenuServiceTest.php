<?php

declare(strict_types=1);

namespace Flex\Tests\Menus;

use Flex\Auth\AuthenticatedUser;
use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Database\DatabaseManager;
use Flex\Http\Controller\Admin\AdminMenusDataController;
use Flex\Http\RequestInput;
use Flex\Http\ResponseFactory;
use Flex\Menus\MenuException;
use Flex\Menus\MenuService;
use Flex\Menus\PublicMenuRenderer;
use Flex\Pages\PageRepository;
use Flex\Tests\Support\MenuSchema;
use Flex\Themes\ThemeManager;
use Illuminate\Database\Schema\Blueprint;
use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7\ServerRequest;
use PHPUnit\Framework\TestCase;

final class MenuServiceTest extends TestCase
{
    private DatabaseManager $database;
    private ThemeManager $themes;
    private MenuService $menus;
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-menus-' . bin2hex(random_bytes(5));
        $config = new ConfigurationRepository(['paths' => ['themes' => 'themes'], 'app' => ['active_theme' => 'one'], 'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]]]]);
        $this->database = new DatabaseManager($config);
        $this->database->schema()->create('settings', static function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->text('value');
            $table->string('type')->default('string');
            $table->string('group')->default('site');
            $table->boolean('autoload')->default(true);
            $table->timestamps();
        });
        MenuSchema::create($this->database);
        foreach (['one', 'two', 'plain'] as $id) {
            mkdir($this->directory . '/themes/' . $id, 0770, true);
            file_put_contents($this->directory . '/themes/' . $id . '/index.php', '<?php echo "theme";');
            file_put_contents($this->directory . '/themes/' . $id . '/theme.json', json_encode(['id' => $id, 'name' => $id, 'version' => '1.0.0', 'supports' => ['menus' => $id !== 'plain'], 'menu_locations' => ['primary' => 'Основно', 'footer' => 'Футър', 'secondary' => 'Допълнително']], JSON_THROW_ON_ERROR));
        }
        $this->themes = new ThemeManager(new ProjectPaths($this->directory, $config), $config);
        $this->themes->activate('one');
        $this->menus = new MenuService($this->database, $this->themes);
    }
    protected function tearDown(): void
    {
        $this->database->disconnect();
        foreach (['one', 'two', 'plain'] as $id) {
            unlink($this->directory . '/themes/' . $id . '/index.php');
            unlink($this->directory . '/themes/' . $id . '/theme.json');
            rmdir($this->directory . '/themes/' . $id);
        }
        rmdir($this->directory . '/themes');
        rmdir($this->directory);
    }
    public function testMetadataAndPlacementSavePreservesItemsAndRollsBackConflicts(): void
    {
        $menu = $this->create([$this->link('contact')]);
        $result = $this->menus->saveWithPlacement([
            'name' => 'Renamed', 'slug' => 'main', 'version' => $menu['version'],
            'placement' => ['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'location' => 'footer'],
        ], $menu['id']);
        self::assertSame($menu['items'], $result['menu']['items']);
        self::assertSame(['footer' => $menu['id']], $this->menus->assignments('one'));
        $saved = $result['menu'];
        $this->rejected(fn() => $this->menus->saveWithPlacement([
            'name' => 'Must roll back', 'slug' => 'main', 'version' => $saved['version'],
            'placement' => ['theme' => 'one', 'assignment_version' => 'stale', 'location' => 'primary'],
        ], $menu['id']), 409);
        self::assertSame($saved, $this->menus->get($menu['id']));
        self::assertSame(['footer' => $menu['id']], $this->menus->assignments('one'));
        $this->menus->saveWithPlacement([
            'name' => 'Renamed', 'slug' => 'main', 'version' => $saved['version'],
            'placement' => ['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'location' => null],
        ], $menu['id']);
        self::assertSame([], $this->menus->assignments('one'));
        self::assertSame($menu['items'], $this->menus->get($menu['id'])['items']);
    }

    public function testNewMenuWithInvalidPlacementIsNotPartiallyCreated(): void
    {
        $this->rejected(fn() => $this->menus->saveWithPlacement([
            'name' => 'New menu', 'slug' => 'new-menu',
            'placement' => ['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'location' => 'invalid'],
        ]), 422);
        self::assertCount(0, $this->menus->index()['menus']);
        $result = $this->menus->saveWithPlacement([
            'name' => 'New menu', 'slug' => 'new-menu',
            'placement' => ['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'location' => 'primary'],
        ]);
        self::assertSame(['primary' => $result['menu']['id']], $result['index']['assignments']);
    }

    public function testOptionalSlugIsGeneratedAndKeptUnique(): void
    {
        $first = $this->menus->save(['name' => 'Основно меню']);
        self::assertMatchesRegularExpression('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $first['slug']);
        self::assertNotSame('menu', $first['slug']);
        $second = $this->menus->save(['name' => 'Основно меню', 'slug' => '  ']);
        self::assertSame($first['slug'] . '-2', $second['slug']);
        $updated = $this->menus->save(['name' => 'Основно меню', 'slug' => '', 'version' => $first['version']], $first['id']);
        self::assertSame($first['slug'], $updated['slug']);
        $manual = $this->menus->save(['name' => 'Основно меню', 'slug' => 'custom-menu']);
        self::assertSame('custom-menu', $manual['slug']);
        $this->rejected(fn() => $this->menus->save(['name' => 'Another', 'slug' => 'custom-menu']), 422);
        $this->rejected(fn() => $this->menus->save(['name' => 'Another', 'slug' => 'Invalid Slug']), 422);
        $fallback = $this->menus->save(['name' => '!!!']);
        self::assertSame('menu', $fallback['slug']);
        $long = $this->menus->save(['name' => str_repeat('a', 120)]);
        $duplicate = $this->menus->save(['name' => str_repeat('a', 120)]);
        self::assertSame(120, strlen($long['slug']));
        self::assertSame(120, strlen($duplicate['slug']));
        self::assertStringEndsWith('-2', $duplicate['slug']);
    }

    public function testOnlyActiveMenusRenderAndHiddenMenusKeepTheirItemsAndLocations(): void
    {
        $menu = $this->create([$this->link('contact')]);
        self::assertSame('active', $menu['status']);
        $this->menus->assign(['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['primary' => $menu['id']]]);
        $renderer = new PublicMenuRenderer($this->database);
        $pages = (new PageRepository())->publicPageSet();
        foreach (['inactive', 'draft', 'active'] as $status) {
            $menu = $this->menus->save(['name' => $menu['name'], 'slug' => $menu['slug'], 'version' => $menu['version'], 'status' => $status], $menu['id']);
            self::assertSame($status, $menu['status']);
            self::assertCount(1, $menu['items']);
            self::assertSame(['primary' => $menu['id']], $this->menus->assignments('one'));
            $public = $renderer->forTheme('one', $pages, ['primary' => 'Main']);
            if ($status === 'active') {
                self::assertCount(1, $public['menus']['primary']);
                self::assertStringContainsString('/contacts', $public['menu_html']['primary']);
            } else {
                self::assertSame([], $public['menus']);
                self::assertSame([], $public['menu_html']);
            }
        }
        $this->rejected(fn() => $this->menus->save(['name' => $menu['name'], 'slug' => $menu['slug'], 'version' => $menu['version'], 'status' => 'invalid'], $menu['id']), 422);
        self::assertSame($menu, $this->menus->get($menu['id']));
    }

    public function testOmittedStatusPreservesDraftAndNewMenusCanStartAsDraft(): void
    {
        $draft = $this->menus->save(['name' => 'Draft', 'status' => 'draft']);
        self::assertSame('draft', $draft['status']);
        $updated = $this->menus->save(['name' => 'Renamed draft', 'slug' => $draft['slug'], 'version' => $draft['version']], $draft['id']);
        self::assertSame('draft', $updated['status']);
        self::assertSame('draft', $this->menus->index()['menus'][0]['status']);
    }

    public function testMenuPagesEndpointIncludesEveryAvailablePageStatus(): void
    {
        $db = $this->database->connection();
        foreach (['published', 'draft', 'active', 'inactive', 'pending'] as $status) {
            $db->table('pages')->insert(['title' => 'Page ' . $status, 'slug' => $status, 'status' => $status]);
        }
        $db->table('pages')->insert(['title' => 'Deleted', 'slug' => 'deleted', 'status' => 'draft', 'deleted_at' => gmdate('Y-m-d H:i:s')]);
        $auth = $this->createStub(AuthenticationInterface::class);
        $auth->method('user')->willReturn(new AuthenticatedUser(1, 'Admin', 'admin@example.test', 'super_admin', 'active'));
        $controller = new AdminMenusDataController($auth, $this->themes, new ResponseFactory(new Psr17Factory()), $this->menus, new PageRepository(), new RequestInput());
        $response = $controller(new ServerRequest('GET', 'http://localhost/api/admin/menus'));
        self::assertSame(200, $response->getStatusCode());
        $pages = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR)['pages'];
        self::assertCount(5, $pages);
        self::assertEqualsCanonicalizing(['published', 'draft', 'active', 'inactive', 'pending'], array_column($pages, 'status'));
    }

    public function testItemAttributesRoundTripRenderSafelyAndRejectInvalidOverrides(): void
    {
        $db = $this->database->connection();
        $pageId = (int) $db->table('pages')->insertGetId(['title' => 'Home', 'slug' => 'home', 'status' => 'published']);
        $item = [...$this->link('home'), 'type' => 'page', 'page_id' => $pageId, 'url' => '', 'seo_title' => 'Title "quoted" <text>', 'aria_label' => 'Read "home"', 'css_class' => 'nav-link featured', 'rel' => 'nofollow sponsored', 'new_tab' => true];
        $menu = $this->create([$item]);
        self::assertSame($item['seo_title'], $menu['items'][0]['seo_title']);
        self::assertSame($item['aria_label'], $menu['items'][0]['aria_label']);
        self::assertSame($item['css_class'], $menu['items'][0]['css_class']);
        $this->menus->assign(['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['primary' => $menu['id']]]);
        $renderer = new PublicMenuRenderer($this->database);
        $public = $renderer->forTheme('one', (new PageRepository())->publicPageSet(), ['primary' => 'Main']);
        self::assertSame('/home', $public['menus']['primary'][0]['url']);
        self::assertStringContainsString('title="Title &quot;quoted&quot; &lt;text&gt;"', $public['menu_html']['primary']);
        self::assertStringContainsString('aria-label="Read &quot;home&quot;"', $public['menu_html']['primary']);
        self::assertStringContainsString('class="nav-link featured"', $public['menu_html']['primary']);
        self::assertStringContainsString('rel="nofollow sponsored noopener noreferrer"', $public['menu_html']['primary']);
        foreach (['url' => 'javascript:alert(1)', 'css_class' => 'x" onclick="bad', 'rel' => 'onclick', 'seo_title' => str_repeat('x', 191)] as $field => $value) {
            $this->rejected(fn() => $this->menus->save(['name' => $menu['name'], 'slug' => $menu['slug'], 'version' => $menu['version'], 'items' => [[...$item, $field => $value]]], $menu['id']), 422);
        }
        self::assertSame($menu, $this->menus->get($menu['id']));
        $menu = $this->menus->save(['name' => $menu['name'], 'slug' => $menu['slug'], 'version' => $menu['version'], 'items' => [[...$item, 'url' => '/custom-link']]], $menu['id']);
        self::assertSame('/custom-link', $renderer->forTheme('one', (new PageRepository())->publicPageSet(), ['primary' => 'Main'])['menus']['primary'][0]['url']);
        $db->table('pages')->where('id', $pageId)->update(['status' => 'draft']);
        self::assertSame([], $renderer->forTheme('one', (new PageRepository())->publicPageSet(), ['primary' => 'Main'])['menus']['primary']);
    }

    private function link(string $id, ?string $parent = null): array
    {
        return ['id' => $id, 'parent_id' => $parent, 'type' => 'link', 'label' => $id, 'url' => '/contacts', 'new_tab' => false];
    }
    private function create(array $items = []): array
    {
        return $this->menus->save(['name' => 'Основно меню', 'slug' => 'main', 'items' => $items]);
    }
    private function rejected(callable $action, int $status): void
    {
        try {
            $action();
            self::fail('Invalid mutation must fail');
        } catch (MenuException $exception) {
            self::assertSame($status, $exception->getCode());
        }
    }
    public function testCrudRejectsStaleWritesAndDeletesBindingsWithoutDeletingPages(): void
    {
        $menu = $this->create([$this->link('a'), $this->link('b', 'a')]);
        self::assertSame(2, $this->menus->index()['menus'][0]['item_count']);
        $updated = $this->menus->save([...$menu, 'name' => 'Обновено'], $menu['id']);
        self::assertSame(2, $updated['version']);
        $this->rejected(fn() => $this->menus->save($menu, $menu['id']), 409);
        $this->rejected(fn() => $this->menus->delete($menu['id'], 1), 409);
        $this->menus->assign(['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['primary' => $menu['id'], 'footer' => $menu['id'], 'secondary' => $menu['id']]]);
        self::assertCount(3, $this->menus->assignments('one'));
        $page = $this->database->connection()->table('pages')->insertGetId(['title' => 'Home', 'slug' => 'home', 'status' => 'published']);
        $this->rejected(fn() => $this->menus->delete($menu['id'], 2), 409);
        $this->menus->trash($menu['id'], 2);
        $this->menus->delete($menu['id'], 3);
        self::assertSame([], $this->menus->index()['menus']);
        self::assertSame([], $this->menus->assignments('one'));
        self::assertTrue($this->database->connection()->table('pages')->where('id', $page)->exists());
    }
    public function testTrashPreservesTheTreeAndBindingsWhileHidingItUntilRestored(): void
    {
        $menu = $this->create([$this->link('parent'), $this->link('child', 'parent')]);
        $this->menus->assign(['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['primary' => $menu['id']]]);
        $this->menus->trash($menu['id'], 1);
        self::assertSame([], $this->menus->index()['menus']);
        $trashed = $this->menus->index('trash')['menus'][0];
        self::assertSame(2, $trashed['item_count']);
        self::assertSame(2, $trashed['version']);
        self::assertNotNull($trashed['deleted_at']);
        self::assertSame([], $this->menus->assignments('one'));
        self::assertSame(1, $this->database->connection()->table('theme_menu_assignments')->count());
        $renderer = new PublicMenuRenderer($this->database);
        self::assertSame([], $renderer->forTheme('one', (new PageRepository())->publicPageSet(), ['primary' => 'Main'])['menus']);
        $this->rejected(fn() => $this->menus->get($menu['id']), 404);
        $this->rejected(fn() => $this->menus->save([...$menu, 'version' => 2], $menu['id']), 409);
        $this->rejected(fn() => $this->menus->assign(['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['footer' => $menu['id']]]), 422);
        $this->rejected(fn() => $this->menus->restore($menu['id'], 1), 409);
        $this->menus->restore($menu['id'], 2);
        self::assertSame([], $this->menus->index('trash')['menus']);
        self::assertSame($menu['items'], $this->menus->get($menu['id'])['items']);
        self::assertSame(['primary' => $menu['id']], $this->menus->assignments('one'));
        self::assertCount(1, $renderer->forTheme('one', (new PageRepository())->publicPageSet(), ['primary' => 'Main'])['menus']['primary']);
    }

    public function testRestoreDoesNotOverwriteALocationReassignedWhileTheMenuWasTrashed(): void
    {
        $menu = $this->create();
        $other = $this->menus->save(['name' => 'Other', 'slug' => 'other', 'items' => []]);
        $this->menus->assign(['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['primary' => $menu['id']]]);
        $this->menus->trash($menu['id'], 1);
        $this->menus->assign(['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['primary' => $other['id']]]);
        $this->menus->restore($menu['id'], 2);
        self::assertSame(['primary' => $other['id']], $this->menus->assignments('one'));
    }

    public function testControllerTrashRestoreAndForceDeleteWorkflow(): void
    {
        $auth = $this->createStub(AuthenticationInterface::class);
        $auth->method('user')->willReturn(new AuthenticatedUser(1, 'Admin', 'admin@example.test', 'super_admin', 'active'));
        $controller = new AdminMenusDataController($auth, $this->themes, new ResponseFactory(new Psr17Factory()), $this->menus, new PageRepository(), new RequestInput());
        $menu = $this->create();
        $args = ['id' => (string) $menu['id']];
        $url = 'http://localhost/api/admin/menus/' . $menu['id'];
        $delete = (new ServerRequest('DELETE', $url))->withParsedBody(['version' => 1]);
        self::assertSame(200, $controller($delete, $args)->getStatusCode());
        $trash = $controller((new ServerRequest('GET', 'http://localhost/api/admin/menus'))->withQueryParams(['view' => 'trash']));
        self::assertCount(1, json_decode((string) $trash->getBody(), true)['menus']);
        $restore = (new ServerRequest('POST', $url . '/restore'))->withParsedBody(['version' => 2]);
        self::assertSame(201, $controller($restore, $args)->getStatusCode());
        $force = (new ServerRequest('DELETE', $url . '/force'))->withParsedBody(['version' => 3]);
        self::assertSame(409, $controller($force, $args)->getStatusCode());
        self::assertSame(200, $controller($delete->withParsedBody(['version' => 3]), $args)->getStatusCode());
        self::assertSame(200, $controller($force->withParsedBody(['version' => 4]), $args)->getStatusCode());
        self::assertSame([], $this->menus->index('trash')['menus']);
    }

    public function testInvalidTreesAndUnsafeLinksLeaveTheOriginalMenuIntact(): void
    {
        $menu = $this->create([$this->link('original')]);
        foreach ([[$this->link('a', 'b'), $this->link('b', 'a')], [$this->link('a', 'missing')], [$this->link('a'), $this->link('b', 'a'), $this->link('c', 'b'), $this->link('d', 'c')], [$this->link('a'), $this->link('a')], [[...$this->link('a'), 'url' => 'javascript:alert(1)']], [[...$this->link('a'), 'url' => '//evil.test']], [[...$this->link('a'), 'type' => 'page', 'page_id' => 999]]] as $items) {
            $this->rejected(fn() => $this->menus->save([...$menu, 'name' => 'Invalid', 'items' => $items], $menu['id']), 422);
            self::assertSame($menu, $this->menus->get($menu['id']));
        }
        $this->rejected(fn() => $this->create(), 422);
    }
    public function testThemeAssignmentsSurviveSwitchingAndRejectStaleOrInvalidRequests(): void
    {
        $menu = $this->create();
        $revision = $this->menus->assignmentVersion('one');
        $request = ['theme' => 'one', 'assignment_version' => $revision, 'assignments' => ['primary' => $menu['id']]];
        $this->menus->assign($request);
        $this->rejected(fn() => $this->menus->assign($request), 409);
        $this->rejected(fn() => $this->menus->assign([...$request, 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['unknown' => $menu['id']]]), 422);
        $this->themes->activate('two');
        self::assertSame([], $this->menus->index()['assignments']);
        $this->rejected(fn() => $this->menus->assign($request), 409);
        $this->themes->activate('plain');
        $this->rejected(fn() => $this->menus->save($menu, $menu['id']), 403);
        $this->themes->activate('one');
        self::assertSame(['primary' => $menu['id']], $this->menus->assignments('one'));
    }
    public function testPublicMenusResolveCurrentPagePathsHideUnpublishedBranchesAndEscapeMarkup(): void
    {
        $db = $this->database->connection();
        $parent = $db->table('pages')->insertGetId(['title' => 'Parent', 'slug' => 'parent', 'status' => 'published']);
        $child = $db->table('pages')->insertGetId(['title' => 'Child', 'slug' => 'child', 'status' => 'published', 'parent_id' => $parent, 'settings' => json_encode(['use_parent_slugs' => true])]);
        $draft = $db->table('pages')->insertGetId(['title' => 'Draft', 'slug' => 'draft', 'status' => 'draft']);
        $menu = $this->create([[...$this->link('live'), 'type' => 'page', 'page_id' => $child, 'url' => '', 'label' => '<script>'], [...$this->link('draft'), 'type' => 'page', 'page_id' => $draft, 'url' => ''], $this->link('hidden', 'draft'), [...$this->link('external'), 'url' => 'https://example.com', 'new_tab' => true]]);
        $this->menus->assign(['theme' => 'one', 'assignment_version' => $this->menus->assignmentVersion('one'), 'assignments' => ['primary' => $menu['id']]]);
        $renderer = new PublicMenuRenderer($this->database);
        $data = $renderer->forTheme('one', (new PageRepository())->publicPageSet(), ['primary' => 'Main']);
        self::assertCount(2, $data['menus']['primary']);
        self::assertSame('/parent/child', $data['menus']['primary'][0]['url']);
        self::assertStringContainsString('&lt;script&gt;', $data['menu_html']['primary']);
        self::assertStringContainsString('rel="noopener noreferrer"', $data['menu_html']['primary']);
        $db->table('pages')->where('id', $child)->update(['slug' => 'changed']);
        self::assertSame('/parent/changed', $renderer->forTheme('one', (new PageRepository())->publicPageSet(), ['primary' => 'Main'])['menus']['primary'][0]['url']);
        $db->table('pages')->where('id', $child)->delete();
        self::assertCount(1, $renderer->forTheme('one', (new PageRepository())->publicPageSet(), ['primary' => 'Main'])['menus']['primary']);
    }
    public function testControllerEnforcesPermissionsAndReturnsCrudAndConflictResponses(): void
    {
        $user = new AuthenticatedUser(1, 'Admin', 'admin@example.test', 'super_admin', 'active');
        $auth = $this->createStub(AuthenticationInterface::class);
        $auth->method('user')->willReturnCallback(static function () use (&$user) {
            return $user;
        });
        $controller = new AdminMenusDataController($auth, $this->themes, new ResponseFactory(new Psr17Factory()), $this->menus, new PageRepository(), new RequestInput());
        $post = (new ServerRequest('POST', 'http://localhost/api/admin/menus'))->withParsedBody(['name' => 'Test', 'slug' => 'test', 'items' => []]);
        $response = $controller($post);
        self::assertSame(201, $response->getStatusCode());
        $menu = json_decode((string) $response->getBody(), true)['menu'];
        $put = (new ServerRequest('PUT', 'http://localhost/api/admin/menus/' . $menu['id']))->withParsedBody([...$menu, 'version' => 0]);
        self::assertSame(409, $controller($put, ['id' => (string) $menu['id']])->getStatusCode());
        self::assertSame(200, $controller(new ServerRequest('GET', 'http://localhost/api/admin/menus'))->getStatusCode());
        $user = new AuthenticatedUser(2, 'Editor', 'editor@example.test', 'editor', 'active');
        self::assertSame(403, $controller($post)->getStatusCode());
    }
}
