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

        return $this->database->transaction(fn(): User => $this->users->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password_hash' => $this->passwords->hash($data['password']),
            'role' => $data['role'],
            'status' => $data['status'],
        ]));
    }

    /** @param array<string, mixed> $attributes */
    public function update(int $id, array $attributes, int $actingUserId): User
    {
        $user = $this->requireUser($id);
        $data = $this->validate($attributes, false, $id, $user);

        if ($id === $actingUserId && ($data['status'] !== 'active' || $data['role'] !== $user->getAttribute('role'))) {
            throw new UserValidationFailed(['You cannot disable your own account or change your own role.']);
        }

        $removesActiveSuperAdmin = $user->getAttribute('role') === 'super_admin'
            && $user->getAttribute('status') === 'active'
            && ($data['role'] !== 'super_admin' || $data['status'] !== 'active');
        if ($removesActiveSuperAdmin && $this->users->countActiveSuperAdmins() <= 1) {
            throw new UserValidationFailed(['The last active super administrator cannot be changed or disabled.']);
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
        if ($id === $actingUserId) {
            throw new UserValidationFailed(['You cannot delete your own account.']);
        }

        $user = $this->requireUser($id);
        if ($user->getAttribute('role') === 'super_admin'
            && $user->getAttribute('status') === 'active'
            && $this->users->countActiveSuperAdmins() <= 1) {
            throw new UserValidationFailed(['The last active super administrator cannot be deleted.']);
        }

        $user->delete();
    }

    private function requireUser(int $id): User
    {
        $user = $this->users->find($id);
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
            $errors[] = 'Name is required and must not exceed 120 characters.';
        }
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 190) {
            $errors[] = 'Email address is invalid.';
        } elseif ($this->users->emailExists($email, $id)) {
            $errors[] = 'Email address is already in use.';
        }
        if (($creating || $password !== '') && strlen($password) < 12) {
            $errors[] = 'Password must contain at least 12 characters.';
        }
        if (!in_array($role, self::ROLES, true)) {
            $errors[] = 'Role is invalid.';
        }
        if (!in_array($status, self::STATUSES, true)) {
            $errors[] = 'Status is invalid.';
        }

        if ($errors !== []) {
            throw new UserValidationFailed($errors);
        }

        return compact('name', 'email', 'password', 'role', 'status');
    }
}
