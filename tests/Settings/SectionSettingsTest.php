<?php
declare(strict_types=1);
namespace Flex\Tests\Settings;

use Flex\Configuration\ConfigurationRepository;
use Flex\Database\DatabaseManager;
use Flex\Settings\SectionSettings;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;

final class SectionSettingsTest extends TestCase
{
    public function testSettingsValidatePersistAndEnforceUserPolicies(): void
    {
        $config = new ConfigurationRepository(['database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]]]);
        $database = new DatabaseManager($config);
        $database->schema()->create('settings', static function (Blueprint $table): void {
            $table->string('key')->primary(); $table->text('value'); $table->string('type'); $table->string('group'); $table->boolean('autoload'); $table->timestamps();
        });
        $database->schema()->create('pages', static function (Blueprint $table): void {
            $table->increments('id'); $table->string('title'); $table->string('status'); $table->softDeletes();
        });
        $database->schema()->create('users', static function (Blueprint $table): void {
            $table->increments('id'); $table->string('name'); $table->string('email'); $table->string('password_hash'); $table->string('role'); $table->string('status'); $table->boolean('email_verification_required')->default(false); $table->dateTime('email_verified_at')->nullable(); $table->softDeletes(); $table->timestamps();
        });
        try {
            $settings = new SectionSettings($database, $config);
            $database->connection()->table('pages')->insert(['id' => 1, 'title' => 'Home', 'status' => 'published']);
            $public = array_replace($settings->all('public'), ['home_page_id' => '1', 'closed' => '1']);
            self::assertSame($public, $settings->save('public', $public));
            foreach (['home_page_id' => '999', 'closed' => 'invalid', 'closed_message' => ''] as $key => $value) {
                try { $settings->save('public', array_replace($public, [$key => $value])); self::fail('Invalid settings accepted'); }
                catch (\InvalidArgumentException $error) { self::assertSame(422, $error->getCode()); }
                self::assertSame($public, $settings->all('public'));
            }
            $users = array_replace($settings->all('users'), ['default_role' => 'editor', 'require_email_verification' => '1', 'password_min_length' => '16', 'session_idle_minutes' => '5']);
            self::assertSame($users, $settings->save('users', $users));
            self::assertSame($users, (new SectionSettings($database, $config))->all('users'));
            foreach (['default_role' => 'super_admin', 'require_email_verification' => 'yes', 'password_min_length' => '11', 'session_idle_minutes' => '1441'] as $key => $value) {
                try { $settings->save('users', array_replace($users, [$key => $value])); self::fail('Invalid policy accepted'); }
                catch (\InvalidArgumentException $error) { self::assertSame(422, $error->getCode()); }
                self::assertSame($users, $settings->all('users'));
            }
            $service = new \Flex\Users\UserService(new \Flex\Users\UserRepository(), new \Flex\Auth\PasswordHasher(), $database, $settings);
            $attributes = ['name' => 'Editor', 'email' => 'editor@example.test', 'password' => 'long-secure-password', 'send_confirmation' => false];
            $user = $service->create($attributes);
            self::assertSame('editor', $user->getAttribute('role'));
            self::assertTrue($user->getAttribute('email_verification_required'));
            try { $service->create(array_replace($attributes, ['email' => 'other@example.test', 'password' => 'twelve-chars!'])); self::fail('Short password accepted'); }
            catch (\Flex\Users\Exception\UserValidationFailed) { self::assertSame(1, $database->connection()->table('users')->count()); }
            $recovery = new \Flex\Auth\PasswordRecovery($database, $config, new \Flex\Auth\PasswordHasher(), $this->createStub(\Symfony\Component\Mailer\MailerInterface::class), $settings);
            try { $recovery->reset('editor@example.test', 'grant', 'twelve-chars!', 'twelve-chars!', '127.0.0.1'); self::fail('Recovery ignored password policy'); }
            catch (\InvalidArgumentException $error) { self::assertStringContainsString('16', $error->getMessage()); }
            $session = new \Flex\Tests\Support\ArraySession();
            $session->put('auth_user_id', 1); $session->put('auth_last_activity', time() - 301);
            $auth = new \Flex\Auth\AuthenticationManager(new \Flex\Users\UserRepository(), new \Flex\Auth\PasswordHasher(), $session, new \Flex\Auth\LoginThrottle(new \Flex\Configuration\ProjectPaths(sys_get_temp_dir(), $config), $config), $settings);
            self::assertNull($auth->user()); self::assertTrue($session->invalidated);
            $mail = $settings->all('mail');
            self::assertSame('noreply@localhost', $settings->mailDefaults()['from_address']);
            foreach (['updates' => ['channel' => 'beta', 'catalog_timeout' => '15'], 'admin' => ['theme' => 'dark', 'remember_tabs' => '0']] as $section => $values) {
                self::assertSame($values, $settings->save($section, $values));
                self::assertSame($values, (new SectionSettings($database, $config))->all($section));
            }
            foreach ([['updates', 'channel', 'unsafe'], ['updates', 'catalog_timeout', '31'], ['admin', 'theme', 'invalid'], ['admin', 'remember_tabs', 'yes']] as [$section, $key, $value]) {
                $before = $settings->all($section);
                try { $settings->save($section, array_replace($before, [$key => $value])); self::fail('Invalid setting accepted'); }
                catch (\InvalidArgumentException $error) { self::assertSame(422, $error->getCode()); }
                self::assertSame($before, $settings->all($section));
            }
            $catalog = new \Flex\Updates\Remote\RemoteCatalogClient($config, $this->createStub(\Flex\Contracts\Updates\RemoteCatalogTransportInterface::class), sys_get_temp_dir(), $settings);
            self::assertSame('beta', $catalog->channel());
            $settings->save('updates', ['channel' => 'stable', 'catalog_timeout' => '10']);
            self::assertSame('stable', $catalog->channel());
            try { $settings->save('maintenance', []); self::fail('Diagnostics accepted a write'); }
            catch (\InvalidArgumentException $error) { self::assertSame(405, $error->getCode()); }
            $root = dirname(__DIR__, 2);
            $diagnostics = new \Flex\Settings\PlatformDiagnostics($database, new \Flex\Configuration\ProjectPaths($root, new ConfigurationRepository(['paths' => ['storage' => 'storage']])), new \Flex\Updates\Platform\PlatformVersionRegistry($root));
            $report = $diagnostics->check();
            self::assertSame('Достъпна', $report['База данни']);
            self::assertSame(PHP_VERSION, $report['PHP версия']);
            self::assertArrayHasKey('PHP: openssl', $report);
            self::assertStringNotContainsString($root, json_encode($report, JSON_THROW_ON_ERROR));
            $mail = array_replace($mail, ['from_name' => 'My Site', 'from_address' => 'sender@example.test', 'reply_to' => 'support@example.test']);
            self::assertSame($mail, $settings->save('mail', $mail));
            foreach (['from_address' => 'bad', 'reply_to' => 'bad', 'from_name' => "Header\r\nInjection"] as $key => $value) {
                try { $settings->save('mail', array_replace($mail, [$key => $value])); self::fail('Invalid email settings accepted'); }
                catch (\InvalidArgumentException $error) { self::assertSame(422, $error->getCode()); }
                self::assertSame($mail, $settings->all('mail'));
            }
            $transport = $this->createMock(\Symfony\Component\Mailer\MailerInterface::class);
            $transport->expects(self::once())->method('send')->with(self::callback(static function (\Symfony\Component\Mime\Email $email): bool {
                return $email->getFrom()[0]->getAddress() === 'sender@example.test' && $email->getFrom()[0]->getName() === 'My Site' && $email->getReplyTo()[0]->getAddress() === 'support@example.test' && $email->getTo()[0]->getAddress() === 'recipient@example.test';
            }), null);
            $message = (new \Symfony\Component\Mime\Email())->from('old@example.test')->to('recipient@example.test')->subject('Test')->text('Body');
            (new \Flex\Mail\SettingsMailer($transport, $settings))->send($message);
            self::assertSame('old@example.test', $message->getFrom()[0]->getAddress());
            $settings->save('mail', ['from_name' => '', 'from_address' => '', 'reply_to' => '']);
            self::assertSame('noreply@localhost', $settings->mailDefaults()['from_address']);
        } finally { $database->disconnect(); }
    }
}
