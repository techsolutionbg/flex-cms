<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Illuminate\Database\Eloquent\Model;

final class Plugin extends Model
{
    protected $table = 'plugins';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'version', 'description', 'entrypoint', 'path', 'status', 'manifest', 'last_error', 'requested_permissions', 'approved_permissions', 'installed_at', 'activated_at'];

    protected function casts(): array
    {
        return [
            'manifest' => 'array',
            'requested_permissions' => 'array',
            'approved_permissions' => 'array',
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
            'requested_permissions' => $this->requestedPermissions(),
            'approved_permissions' => $this->approvedPermissions(),
            'last_error' => $this->getAttribute('last_error'),
            'installed_at' => $this->getAttribute('installed_at')?->toIso8601String(),
            'activated_at' => $this->getAttribute('activated_at')?->toIso8601String(),
        ];
    }

    /** @return list<string> */
    public function requestedPermissions(): array
    {
        return $this->permissions('requested_permissions');
    }

    /** @return list<string> */
    public function approvedPermissions(): array
    {
        return $this->permissions('approved_permissions');
    }

    /** @return list<string> */
    private function permissions(string $attribute): array
    {
        $value = $this->getAttribute($attribute);

        return is_array($value) ? array_values(array_filter($value, 'is_string')) : [];
    }
}
