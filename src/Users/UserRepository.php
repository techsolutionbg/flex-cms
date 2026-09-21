<?php

declare(strict_types=1);

namespace Flex\Users;

use Illuminate\Database\Eloquent\Collection;

final class UserRepository
{
    public function find(int $id): ?User
    {
        $user = User::query()->find($id);

        return $user instanceof User ? $user : null;
    }

    public function findByEmail(string $email): ?User
    {
        $user = User::query()->where('email', strtolower($email))->first();

        return $user instanceof User ? $user : null;
    }

    /** @return Collection<int, User> */
    public function all(): Collection
    {
        /** @var Collection<int, User> $users */
        $users = User::query()->orderBy('id')->get();

        return $users;
    }

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): User
    {
        $user = new User($attributes);
        $user->saveOrFail();

        return $user;
    }

    public function emailExists(string $email, ?int $exceptId = null): bool
    {
        $query = User::query()->where('email', strtolower($email));
        if ($exceptId !== null) {
            $query->whereKeyNot($exceptId);
        }

        return $query->exists();
    }

    public function countActiveSuperAdmins(): int
    {
        return User::query()->where('role', 'super_admin')->where('status', 'active')->count();
    }
}
