<?php

declare(strict_types=1);

namespace Flex\Tests\Auth;

use Flex\Auth\AuthenticationManager;
use Flex\Auth\Exception\TooManyLoginAttempts;
use Flex\Auth\LoginThrottle;
use Flex\Auth\PasswordHasher;
use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Tests\Support\ArraySession;
use Flex\Users\UserRepository;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;

final class AuthenticationManagerTest extends TestCase
{
    private DatabaseManager $database;
    private UserRepository $users;
    private PasswordHasher $passwords;
    private ArraySession $session;
    private string $directory;

    protected function setUp(): void
    {
        $this->database = new DatabaseManager(new ConfigurationRepository([
            'database' => ['default' => 'sqlite', 'connections' => [
                'sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
            ]],
        ]));
        $this->database->schema()->create('users', static function (Blueprint $table): void {
            $table->increments('id');
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('role');
            $table->string('status');
            $table->dateTime('last_login_at')->nullable();
            $table->timestamps();
        });
        $this->users = new UserRepository();
        $this->passwords = new PasswordHasher();
        $this->session = new ArraySession();
        $this->directory = sys_get_temp_dir() . '/flex-auth-' . bin2hex(random_bytes(6));
        mkdir($this->directory . '/storage/cache', 0775, true);
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
        foreach (glob($this->directory . '/storage/cache/auth/*.json') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($this->directory . '/storage/cache/auth');
        @rmdir($this->directory . '/storage/cache');
        @rmdir($this->directory . '/storage');
        @rmdir($this->directory);
    }

    public function testItAuthenticatesActiveUsersAndRegeneratesTheSession(): void
    {
        $user = $this->users->create([
            'name' => 'Administrator',
            'email' => 'admin@example.test',
            'password_hash' => $this->passwords->hash('correct-password'),
            'role' => 'super_admin',
            'status' => 'active',
        ]);
        $authentication = $this->manager();

        self::assertTrue($authentication->attempt('ADMIN@example.test', 'correct-password', '127.0.0.1'));
        self::assertSame(1, $this->session->regenerations);
        self::assertSame((int) $user->getAttribute('id'), $this->session->get('auth_user_id'));
        self::assertSame('admin@example.test', $authentication->user()?->email);
        self::assertNotNull($this->users->find((int) $user->getAttribute('id'))?->getAttribute('last_login_at'));
    }

    public function testItRejectsInvalidCredentialsAndDisabledUsers(): void
    {
        $this->users->create([
            'name' => 'Disabled',
            'email' => 'disabled@example.test',
            'password_hash' => $this->passwords->hash('correct-password'),
            'role' => 'user',
            'status' => 'disabled',
        ]);
        $authentication = $this->manager();

        self::assertFalse($authentication->attempt('missing@example.test', 'wrong-password', '127.0.0.1'));
        self::assertFalse($authentication->attempt('disabled@example.test', 'correct-password', '127.0.0.1'));
        self::assertFalse($authentication->check());
    }

    public function testLogoutInvalidatesTheSession(): void
    {
        $this->session->put('auth_user_id', 10);
        $authentication = $this->manager();
        $authentication->logout();

        self::assertTrue($this->session->invalidated);
        self::assertFalse($authentication->check());
    }

    public function testItThrottlesRepeatedLoginFailures(): void
    {
        $authentication = $this->manager();
        for ($attempt = 0; $attempt < 5; ++$attempt) {
            self::assertFalse($authentication->attempt('target@example.test', 'wrong-password', '192.0.2.10'));
        }

        $this->expectException(TooManyLoginAttempts::class);
        $authentication->attempt('target@example.test', 'wrong-password', '192.0.2.10');
    }

    private function manager(): AuthenticationManager
    {
        $configuration = new ConfigurationRepository([
            'app' => ['key' => str_repeat('a', 64)],
            'paths' => ['storage' => 'storage'],
        ]);

        return new AuthenticationManager(
            $this->users,
            $this->passwords,
            $this->session,
            new LoginThrottle(new ProjectPaths($this->directory, $configuration), $configuration),
        );
    }
}
