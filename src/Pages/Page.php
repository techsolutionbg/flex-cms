<?php

declare(strict_types=1);

namespace Flex\Pages;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Page extends Model
{
    use SoftDeletes;

    protected $table = 'pages';

    protected $fillable = ['author_id', 'parent_id', 'title', 'slug', 'content', 'status', 'published_at', 'settings'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'author_id' => 'integer',
            'parent_id' => 'integer',
            'published_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
            'deleted_at' => 'immutable_datetime',
            'settings' => 'array',
        ];
    }

    /** @return array<string, mixed> */
    public function toPublicArray(): array
    {
        return [
            'id' => (int) $this->getAttribute('id'),
            'author_id' => $this->getAttribute('author_id') === null ? null : (int) $this->getAttribute('author_id'),
            'parent_id' => $this->getAttribute('parent_id') === null ? null : (int) $this->getAttribute('parent_id'),
            'title' => (string) $this->getAttribute('title'),
            'slug' => (string) $this->getAttribute('slug'),
            'content' => (string) ($this->getAttribute('content') ?? ''),
            'status' => (string) $this->getAttribute('status'),
            'published_at' => $this->getAttribute('published_at')?->toIso8601String(),
            'created_at' => $this->getAttribute('created_at')?->toIso8601String(),
            'updated_at' => $this->getAttribute('updated_at')?->toIso8601String(),
            'deleted_at' => $this->getAttribute('deleted_at')?->toIso8601String(),
            'settings' => is_array($this->getAttribute('settings')) ? $this->getAttribute('settings') : [],
        ];
    }
}
