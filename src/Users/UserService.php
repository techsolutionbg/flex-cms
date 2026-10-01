<?php

declare(strict_types=1);

namespace Flex\Users;

use Flex\Auth\PasswordHasher;
use Flex\Database\DatabaseManager;
use Flex\Users\Exception\UserNotFound;
use Flex\Users\Exception\UserValidationFailed;

final readonly class UserService
{
    private const ROLES = ['user', 'editor', 'admin', 'super_admin'];
    private const STATUSES = ['active', 'disabled'];

    public function __construct(
        private UserRepository $users,
        private PasswordHasher $passwords,
        private DatabaseManager $database,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): User
    {
        $data = $this->validate($attributes, true);
        if ($data['role'] === 'super_admin' && $this->users->countSuperAdmins() > 0) {
            throw new UserValidationFailed(['Разрешен е само един супер администратор.']);
        }

        return $this->database->transaction(fn(): User => $this->users->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password_hash' => $this->passwords->hash($data['password']),
            'role' => $data['role'],
            'status' => $data['status'],
            'email_verification_required' => filter_var($attributes['send_confirmation'] ?? false, FILTER_VALIDATE_BOOLEAN),
        ]));
    }

    /** @param array<string, mixed> $attributes */
    public function update(int $id, array $attributes, int $actingUserId): User
    {
        $user = $this->requireUser($id);
        $data = $this->validate($attributes, false, $id, $user);

        if ($data['role'] === 'super_admin'
            && $user->getAttribute('role') !== 'super_admin'
            && $this->users->countSuperAdmins() > 0) {
            throw new UserValidationFailed(['Разрешен е само един супер администратор.']);
        }

        if ($user->getAttribute('role') === 'super_admin'
            && ($data['role'] !== 'super_admin' || $data['status'] !== 'active')) {
            throw new UserValidationFailed(['Супер администраторът не може да бъде деактивиран или да му бъде променена ролята.']);
        }

        if ($data['password'] !== '') {
            $actingUser = $this->requireUser($actingUserId);
            $currentPassword = is_string($attributes['current_password'] ?? null) ? $attributes['current_password'] : '';
            if ($actingUser->getAttribute('role') !== 'super_admin'
                && ($currentPassword === '' || !$this->passwords->verify($currentPassword, (string) $actingUser->getAttribute('password_hash')))) {
                throw new UserValidationFailed(['Текущата парола е задължителна и трябва да бъде правилна.']);
            }
        }

        if ($id === $actingUserId && ($data['status'] !== 'active' || $data['role'] !== $user->getAttribute('role'))) {
            throw new UserValidationFailed(['Не можете да деактивирате собствения си профил или да промените собствената си роля.']);
        }

        $removesActiveSuperAdmin = $user->getAttribute('role') === 'super_admin'
            && $user->getAttribute('status') === 'active'
            && ($data['role'] !== 'super_admin' || $data['status'] !== 'active');
        if ($removesActiveSuperAdmin && $this->users->countActiveSuperAdmins() <= 1) {
            throw new UserValidationFailed(['Последният активен супер администратор не може да бъде променян или деактивиран.']);
        }

        $user->setAttribute('name', $data['name']);
        $user->setAttribute('email', $data['email']);
        $user->setAttribute('role', $data['role']);
        $user->setAttribute('status', $data['status']);
        if ($data['password'] !== '') {
            $user->setAttribute('password_hash', $this->passwords->hash($data['password']));
        }
        $user->saveOrFail();

        return $user;
    }

    public function delete(int $id, int $actingUserId): void
    {
        $this->forceDelete($id, $actingUserId);
    }

    public function trash(int $id, int $actingUserId): void
    {
        if ($id === $actingUserId) {
            throw new UserValidationFailed(['Не можете да преместите собствения си профил в кошчето.']);
        }

        $user = $this->requireUserWithTrashed($id);
        if (in_array($user->getAttribute('role'), ['admin', 'super_admin'], true)) {
            throw new UserValidationFailed(['Администраторите и супер администраторите не могат да бъдат премествани в кошчето.']);
        }
        $user->setAttribute('status', 'disabled');
        $user->saveOrFail();
        $user->delete();
    }

    public function restore(int $id): User
    {
        $user = $this->requireUserWithTrashed($id);
        $user->restore();
        $user->setAttribute('status', 'disabled');
        $user->saveOrFail();

        return $user;
    }

    public function forceDelete(int $id, int $actingUserId): void
    {
        if ($id === $actingUserId) {
            throw new UserValidationFailed(['Не можете да изтриете собствения си профил.']);
        }
        $user = $this->requireUserWithTrashed($id);
        if (in_array($user->getAttribute('role'), ['admin', 'super_admin'], true)) {
            throw new UserValidationFailed(['Администраторите и супер администраторите не могат да бъдат изтривани.']);
        }
        $user->forceDelete();
    }

    private function requireUser(int $id): User
    {
        $user = $this->users->find($id);
        if ($user === null) {
            throw new UserNotFound(sprintf('User %d was not found.', $id));
        }

        return $user;
    }

    private function requireUserWithTrashed(int $id): User
    {
        $user = $this->users->findWithTrashed($id);
        if ($user === null) {
            throw new UserNotFound(sprintf('User %d was not found.', $id));
        }

        return $user;
    }

    /**
     * @param array<string, mixed> $attributes
     * @return array{name: string, email: string, password: string, role: string, status: string}
     */
    private function validate(array $attributes, bool $creating, ?int $id = null, ?User $current = null): array
    {
        $name = trim(is_string($attributes['name'] ?? null) ? $attributes['name'] : (string) $current?->getAttribute('name'));
        $email = strtolower(trim(is_string($attributes['email'] ?? null) ? $attributes['email'] : (string) $current?->getAttribute('email')));
        $password = is_string($attributes['password'] ?? null) ? $attributes['password'] : '';
        $role = is_string($attributes['role'] ?? null) ? $attributes['role'] : (string) ($current?->getAttribute('role') ?? 'user');
        $status = is_string($attributes['status'] ?? null) ? $attributes['status'] : (string) ($current?->getAttribute('status') ?? 'active');
        $errors = [];

        if ($name === '' || mb_strlen($name) > 120) {
            $errors[] = 'Името е задължително и не може да надвишава 120 символа.';
        }
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 190) {
            $errors[] = 'Имейл адресът е невалиден.';
        } elseif ($this->users->emailExists($email, $id)) {
            $errors[] = 'Имейл адресът вече се използва.';
        }
        if (($creating || $password !== '') && strlen($password) < 12) {
            $errors[] = 'Паролата трябва да съдържа поне 12 символа.';
        }
        if (($creating || $password !== '') && array_key_exists('password_confirmation', $attributes) && $password !== (string) $attributes['password_confirmation']) {
            $errors[] = 'Паролата и потвърждението не съвпадат.';
        }
        if (!in_array($role, self::ROLES, true)) {
            $errors[] = 'Ролята е невалидна.';
        }
        if (!in_array($status, self::STATUSES, true)) {
            $errors[] = 'Статусът е невалиден.';
        }

        if ($errors !== []) {
            throw new UserValidationFailed($errors);
        }

        return compact('name', 'email', 'password', 'role', 'status');
    }
}
