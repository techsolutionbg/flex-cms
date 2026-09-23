<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Illuminate\Database\Eloquent\Model;

final class Plugin extends Model
{
    protected $table = 'plugins';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'version', 'description', 'entrypoint', 'path', 'status', 'manifest', 'last_error', 'installed_at', 'activated_at'];

    protected function casts(): array
    {
        return [
            'manifest' => 'array',
            'installed_at' => 'immutable_datetime',
            'activated_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    /** @return array<string, mixed> */
    public function toPublicArray(): array
    {
        return [
            'id' => (string) $this->getAttribute('id'),
            'name' => (string) $this->getAttribute('name'),
            'version' => (string) $this->getAttribute('version'),
            'description' => (string) ($this->getAttribute('description') ?? ''),
            'entrypoint' => (string) $this->getAttribute('entrypoint'),
            'path' => (string) $this->getAttribute('path'),
            'status' => (string) $this->getAttribute('status'),
            'manifest' => is_array($this->getAttribute('manifest')) ? $this->getAttribute('manifest') : [],
            'last_error' => $this->getAttribute('last_error'),
            'installed_at' => $this->getAttribute('installed_at')?->toIso8601String(),
            'activated_at' => $this->getAttribute('activated_at')?->toIso8601String(),
        ];
    }
}
