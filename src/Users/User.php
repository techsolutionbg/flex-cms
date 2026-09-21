<?php

declare(strict_types=1);

namespace Flex\Users;

use Flex\Auth\AuthenticatedUser;
use Illuminate\Database\Eloquent\Model;

final class User extends Model
{
    protected $table = 'users';

    protected $fillable = [
        'name',
        'email',
        'password_hash',
        'role',
        'status',
        'last_login_at',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'last_login_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function identity(): AuthenticatedUser
    {
        return new AuthenticatedUser(
            (int) $this->getAttribute('id'),
            (string) $this->getAttribute('name'),
            (string) $this->getAttribute('email'),
            (string) $this->getAttribute('role'),
            (string) $this->getAttribute('status'),
        );
    }
}
