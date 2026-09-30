<?php

declare(strict_types=1);

namespace Flex\Users;

use Illuminate\Database\Eloquent\Model;

final class EmailVerificationToken extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'email_verification_tokens';

    protected $fillable = [
        'user_id',
        'token_hash',
        'expires_at',
        'used_at',
        'created_at',
    ];

    public function getCreatedAtColumn(): string
    {
        return 'created_at';
    }
}
