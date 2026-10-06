<?php

declare(strict_types=1);

namespace Flex\Tests\Auth;

use Flex\Auth\{PasswordHasher, PasswordRecovery};
use Flex\Configuration\ConfigurationRepository;
use Flex\Database\DatabaseManager;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class PasswordRecoveryTest extends TestCase
{
    private DatabaseManager $database;
    private PasswordRecovery $recovery;
    /** @var list<Email> */
    private array $messages = [];

    protected function setUp(): void
    {
        $config = new ConfigurationRepository(['app' => ['key' => 'test-secret'], 'mail' => ['from' => ['address' => 'noreply@example.test', 'name' => 'Flex CMS']], 'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]]]);
        $this->database = new DatabaseManager($config);
        $this->database->schema()->create('users', static function (Blueprint $table): void {
            $table->increments('id');
            $table->string('email');
            $table->string('status');
            $table->string('role');
            $table->string('password_hash');
            $table->integer('auth_version')->default(0);
            $table->softDeletes();
            $table->timestamps();
        });
        $this->database->schema()->create('password_reset_requests', static function (Blueprint $table): void {
            $table->increments('id');
            $table->integer('user_id');
            $table->string('code_hash');
            $table->dateTime('expires_at');
            $table->integer('attempts')->default(0);
            $table->string('grant_hash')->nullable();
            $table->dateTime('grant_expires_at')->nullable();
            $table->dateTime('used_at')->nullable();
            $table->dateTime('created_at');
        });
        $this->database->schema()->create('password_reset_limits', static function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->integer('attempts');
            $table->bigInteger('window_started_at');
            $table->bigInteger('last_attempt_at');
        });
        $this->database->connection()->table('users')->insert(['id' => 1, 'email' => 'admin@example.test', 'role' => 'super_admin', 'status' => 'active', 'password_hash' => (new PasswordHasher())->hash('old-password-123')]);
        $mailer = $this->createStub(MailerInterface::class);
        $mailer->method('send')->willReturnCallback(function (Email $message): void {
            $this->messages[] = $message;
        });
        $this->recovery = new PasswordRecovery($this->database, $config, new PasswordHasher(), $mailer);
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
    }

    private function code(): string
    {
        $this->recovery->request('admin@example.test', '127.0.0.1');
        $message = end($this->messages);
        self::assertInstanceOf(Email::class, $message);
        $body = $message->getTextBody();
        self::assertIsString($body);
        self::assertSame(1, preg_match('/\b\d{6}\b/', $body, $matches));
        self::assertArrayHasKey(0, $matches);
        return $matches[0];
    }

    public function testFullFlowHashesSecretsChangesPasswordAndPreventsReplay(): void
    {
        $code = $this->code();
        $row = $this->database->connection()->table('password_reset_requests')->first();
        self::assertNotNull($row);
        self::assertNotSame($code, $row->code_hash);
        $token = $this->recovery->verify('admin@example.test', $code, '127.0.0.1');
        self::assertNotSame($token, $this->database->connection()->table('password_reset_requests')->value('grant_hash'));
        $this->recovery->reset('admin@example.test', $token, 'new-password-123', 'new-password-123', '127.0.0.1');
        $user = $this->database->connection()->table('users')->first();
        self::assertNotNull($user);
        self::assertTrue(password_verify('new-password-123', $user->password_hash));
        self::assertFalse(password_verify('old-password-123', $user->password_hash));
        self::assertSame(1, $user->auth_version);
        $this->expectException(\InvalidArgumentException::class);
        $this->recovery->reset('admin@example.test', $token, 'another-password', 'another-password', '127.0.0.1');
    }

    public function testMissingAndDisabledAccountsReceiveNoMail(): void
    {
        $this->recovery->request('missing@example.test', '127.0.0.1');
        $this->database->connection()->table('users')->update(['status' => 'disabled']);
        $this->recovery->request('admin@example.test', '127.0.0.1');
        self::assertSame([], $this->messages);
    }

    public function testFiveWrongCodesLockRequestAndPersistAttempts(): void
    {
        $code = $this->code();
        $wrong = $code === '000000' ? '111111' : '000000';
        for ($attempt = 0; $attempt < 5; $attempt++) {
            try {
                $this->recovery->verify('admin@example.test', $wrong, '127.0.0.1');
                self::fail('Wrong code accepted');
            } catch (\InvalidArgumentException $error) {
                self::assertSame(422, $error->getCode());
            }
        }
        self::assertSame(5, $this->database->connection()->table('password_reset_requests')->value('attempts'));
        $this->expectException(\InvalidArgumentException::class);
        $this->recovery->verify('admin@example.test', $code, '127.0.0.1');
    }

    public function testExpiredCodeIsRejected(): void
    {
        $code = $this->code();
        $this->database->connection()->table('password_reset_requests')->update(['expires_at' => '2000-01-01 00:00:00']);
        $this->expectException(\InvalidArgumentException::class);
        $this->recovery->verify('admin@example.test', $code, '127.0.0.1');
    }

    public function testResendInvalidatesPreviousCodeAndGrant(): void
    {
        $code = $this->code();
        $grant = $this->recovery->verify('admin@example.test', $code, '127.0.0.1');
        $this->database->connection()->table('password_reset_limits')->update(['last_attempt_at' => time() - 61]);
        $this->code();
        self::assertNotNull($this->database->connection()->table('password_reset_requests')->where('id', 1)->value('used_at'));
        $this->expectException(\InvalidArgumentException::class);
        $this->recovery->reset('admin@example.test', $grant, 'new-password-123', 'new-password-123', '127.0.0.1');
    }

    public function testImmediateResendIsLimited(): void
    {
        $this->code();
        $this->expectExceptionCode(429);
        $this->recovery->request('admin@example.test', 'different-ip');
    }

    public function testExpiredGrantDoesNotChangePassword(): void
    {
        $grant = $this->recovery->verify('admin@example.test', $this->code(), '127.0.0.1');
        $this->database->connection()->table('password_reset_requests')->update(['grant_expires_at' => '2000-01-01 00:00:00']);
        $this->expectException(\InvalidArgumentException::class);
        $this->recovery->reset('admin@example.test', $grant, 'new-password-123', 'new-password-123', '127.0.0.1');
    }

    public function testMismatchedPasswordsDoNotConsumeGrant(): void
    {
        $grant = $this->recovery->verify('admin@example.test', $this->code(), '127.0.0.1');
        try {
            $this->recovery->reset('admin@example.test', $grant, 'new-password-123', 'wrong-password-123', '127.0.0.1');
            self::fail('Mismatch accepted');
        } catch (\InvalidArgumentException) {
            self::assertNull($this->database->connection()->table('password_reset_requests')->value('used_at'));
        }
        $this->recovery->reset('admin@example.test', $grant, 'new-password-123', 'new-password-123', '127.0.0.1');
        self::assertSame(1, $this->database->connection()->table('users')->value('auth_version'));
    }
}
