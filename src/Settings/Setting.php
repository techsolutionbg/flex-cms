<?php

declare(strict_types=1);

namespace Flex\Settings;

use Illuminate\Database\Eloquent\Model;

final class Setting extends Model
{
    protected $table = 'settings';
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['key', 'value', 'type', 'group', 'autoload'];

    protected function casts(): array
    {
        return [
            'autoload' => 'boolean',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
