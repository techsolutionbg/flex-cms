<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Extensions\Exception\PluginPermissionDenied;
use Flex\Extensions\PluginServices;
use Flex\Mail\SettingsMailer;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SectionSettings;
use Flex\Tests\Support\ArraySession;
use Flex\Themes\ThemeManager;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class PluginServicesTest extends TestCase
{
    private string $directory;
    private ConfigurationRepository $config;
    private DatabaseManager $database;
    private ProjectPaths $paths;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-extension-services-' . bin2hex(random_bytes(5));
        mkdir($this->directory . '/themes/plain', 0770, true);
        $this->config = new ConfigurationRepository(['paths' => ['themes' => 'themes'], 'app' => ['active_theme' => 'plain'], 'session' => ['csrf_token_lifetime' => 7200], 'mail' => ['from' => ['address' => 'site@example.test', 'name' => 'Site']], 'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]]]);
        $this->database = new DatabaseManager($this->config);
        $this->database->schema()->create('settings', static function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->text('value');
            $table->string('group')->default('site');
        });
        $this->database->schema()->create('extension_documents', static function (Blueprint $table): void {
            $table->string('plugin_id');
            $table->string('document_key');
            $table->text('payload');
            $table->dateTime('updated_at');
            $table->primary(['plugin_id', 'document_key']);
        });
        $this->paths = new ProjectPaths($this->directory, $this->config);
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
        foreach (['theme.json', 'extension.json', 'view.php', 'view.twig'] as $file) {
            if (is_file($this->directory . '/themes/plain/' . $file)) {
                unlink($this->directory . '/themes/plain/' . $file);
            }
        }
        if (is_file($this->directory . '/outside.json')) {
            unlink($this->directory . '/outside.json');
        }
        rmdir($this->directory . '/themes/plain');
        rmdir($this->directory . '/themes');
        rmdir($this->directory);
    }

    /** @param list<string> $permissions */
    private function services(array $permissions, string $id = 'acme/forms', ?MailerInterface $mailer = null): PluginServices
    {
        return new PluginServices($id, $permissions, $this->database, new CsrfTokenManager(new ArraySession(), $this->config), $mailer ?? $this->createStub(MailerInterface::class), new ThemeManager($this->paths, $this->config), $this->paths);
    }

    public function testStorageIsScopedAndRollsBackAllWrites(): void
    {
        $first = $this->services(['storage.documents'])->storage();
        $second = $this->services(['storage.documents'], 'other/plugin')->storage();
        $first->put('form:a', ['name' => 'Private']);
        self::assertNull($second->get('form:a'));
        try {
            $first->transaction(static function () use ($first): void {
                $first->put('form:a', ['name' => 'Changed']);
                $first->put('form:b', []);
                throw new \RuntimeException();
            });
        } catch (\RuntimeException) {
        }
        self::assertSame('Private', ($first->get('form:a') ?? [])['name']);
        self::assertNull($first->get('form:b'));
    }

    public function testStorageRequiresApprovedPermission(): void
    {
        $this->expectException(PluginPermissionDenied::class);
        $this->services([])->storage();
    }

    public function testMailRequiresApprovedPermission(): void
    {
        $this->expectException(PluginPermissionDenied::class);
        $this->services([])->sendMail(['owner@example.test'], 'Subject', 'Body');
    }

    public function testThemeAccessRequiresPermissionAndPlainThemeHasNoExtension(): void
    {
        self::assertNull($this->services(['theme.extensions'])->themeExtension());
        $this->expectException(PluginPermissionDenied::class);
        $this->services([])->themeExtension();
    }

    public function testReadActiveThemeJsonRequiresPermissionAndReadsManifest(): void
    {
        file_put_contents($this->directory . '/themes/plain/theme.json', '{"id":"plain","content_schema":"fields/manifest.json"}');
        $services = $this->services(['theme.extensions']);
        $manifest = $services->readActiveThemeManifest();
        self::assertSame('fields/manifest.json', $manifest['content_schema']);
        $this->expectException(PluginPermissionDenied::class);
        $this->services([])->readActiveThemeManifest();
    }

    public function testDescriptorsAndBothTemplateTypesAreResolvedInsideTheTheme(): void
    {
        file_put_contents($this->directory . '/themes/plain/theme.json', '{"extensions":{"acme/forms":"extension.json"}}');
        file_put_contents($this->directory . '/themes/plain/extension.json', '{"version":1,"forms":{}}');
        file_put_contents($this->directory . '/themes/plain/view.php', '<?php echo htmlspecialchars($title, ENT_QUOTES);');
        file_put_contents($this->directory . '/themes/plain/view.twig', '{{ title }}');
        $services = $this->services(['theme.extensions']);
        $extension = $services->themeExtension();
        self::assertNotNull($extension);
        self::assertSame('plain', $extension['id']);
        self::assertSame('&lt;b&gt;', $services->renderThemeTemplate('view.php', ['title' => '<b>']));
        self::assertSame('&lt;b&gt;', $services->renderThemeTemplate('view.twig', ['title' => '<b>']));
        $this->expectException(\RuntimeException::class);
        $services->renderThemeTemplate('../outside.php', []);
    }

    public function testDescriptorTraversalIsRejected(): void
    {
        file_put_contents($this->directory . '/outside.json', '{"version":1}');
        file_put_contents($this->directory . '/themes/plain/theme.json', '{"extensions":{"acme/forms":"../../outside.json"}}');
        $this->expectException(\RuntimeException::class);
        $this->services(['theme.extensions'])->themeExtension();
    }

    public function testSiteFromIsPreservedAndExplicitReplyToWinsOverGlobalDefault(): void
    {
        $this->database->connection()->table('settings')->insert(['key' => 'settings.mail.reply_to', 'value' => 'global@example.test', 'group' => 'settings.mail']);
        $transport = $this->createMock(MailerInterface::class);
        $transport->expects(self::exactly(2))->method('send')->willReturnCallback(static function (\Symfony\Component\Mime\RawMessage $message): void {
            self::assertInstanceOf(Email::class, $message);
            self::assertSame('site@example.test', $message->getFrom()[0]->getAddress());
            self::assertSame($message->getSubject() === 'Explicit' ? 'visitor@example.test' : 'global@example.test', $message->getReplyTo()[0]->getAddress());
        });
        $mailer = new SettingsMailer($transport, new SectionSettings($this->database, $this->config));
        $services = $this->services(['mail.send'], mailer: $mailer);
        $services->sendMail(['owner@example.test'], 'Explicit', 'Body', 'visitor@example.test');
        $services->sendMail(['owner@example.test'], 'Default', 'Body');
    }

    public function testCsrfServiceUsesTheSessionToken(): void
    {
        $services = $this->services([]);
        self::assertTrue($services->validateCsrf($services->csrfToken()));
        self::assertFalse($services->validateCsrf('invalid'));
    }
}
