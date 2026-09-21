<?php

declare(strict_types=1);

namespace Flex\Auth;

final readonly class AuthenticatedUser
{
    public function __construct(
        public int $id,
        public string $name,
        public string $email,
        public string $role,
        public string $status,
    ) {}

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    /** @return array{id: int, name: string, email: string, role: string, status: string} */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'status' => $this->status,
        ];
    }
}
