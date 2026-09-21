<?php

declare(strict_types=1);

namespace Flex\Tests\Users;

use Flex\Auth\PasswordHasher;
use Flex\Configuration\ConfigurationRepository;
use Flex\Database\DatabaseManager;
use Flex\Users\Exception\UserValidationFailed;
use Flex\Users\UserRepository;
use Flex\Users\UserService;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;

final class UserServiceTest extends TestCase
{
    private DatabaseManager $database;
    private UserRepository $repository;
    private UserService $service;

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
        $this->repository = new UserRepository();
        $this->service = new UserService($this->repository, new PasswordHasher(), $this->database);
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
    }

    public function testItCreatesAndUpdatesValidatedUsers(): void
    {
        $user = $this->service->create([
            'name' => 'Editor',
            'email' => 'EDITOR@example.test',
            'password' => 'secure-password',
            'role' => 'editor',
            'status' => 'active',
        ]);
        $updated = $this->service->update((int) $user->getAttribute('id'), [
            'name' => 'Senior Editor',
            'email' => 'editor@example.test',
        ], 999);

        self::assertSame('editor@example.test', $user->getAttribute('email'));
        self::assertSame('Senior Editor', $updated->getAttribute('name'));
        self::assertSame('editor', $updated->getAttribute('role'));
    }

    public function testItRejectsDuplicateEmailAndWeakPasswords(): void
    {
        $this->service->create([
            'name' => 'Existing', 'email' => 'existing@example.test', 'password' => 'secure-password',
            'role' => 'user', 'status' => 'active',
        ]);

        $this->expectException(UserValidationFailed::class);

        $this->service->create([
            'name' => 'Duplicate', 'email' => 'existing@example.test', 'password' => 'short',
            'role' => 'unknown', 'status' => 'active',
        ]);
    }

    public function testItProtectsTheCurrentAndLastSuperAdministrator(): void
    {
        $administrator = $this->service->create([
            'name' => 'Administrator', 'email' => 'admin@example.test', 'password' => 'secure-password',
            'role' => 'super_admin', 'status' => 'active',
        ]);
        $id = (int) $administrator->getAttribute('id');

        try {
            $this->service->delete($id, $id);
            self::fail('Self-deletion was expected to fail.');
        } catch (UserValidationFailed) {
            self::addToAssertionCount(1);
        }

        $this->expectException(UserValidationFailed::class);
        $this->service->update($id, ['status' => 'disabled'], 999);
    }
}
