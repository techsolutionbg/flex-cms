<?php

declare(strict_types=1);

namespace Flex\Pages;

use Illuminate\Database\Eloquent\Model;

final class Page extends Model
{
    protected $table = 'pages';

    protected $fillable = ['author_id', 'title', 'slug', 'content', 'status', 'published_at'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'author_id' => 'integer',
            'published_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    /** @return array<string, mixed> */
    public function toPublicArray(): array
    {
        return [
            'id' => (int) $this->getAttribute('id'),
            'author_id' => $this->getAttribute('author_id') === null ? null : (int) $this->getAttribute('author_id'),
            'title' => (string) $this->getAttribute('title'),
            'slug' => (string) $this->getAttribute('slug'),
            'content' => (string) ($this->getAttribute('content') ?? ''),
            'status' => (string) $this->getAttribute('status'),
            'published_at' => $this->getAttribute('published_at')?->toIso8601String(),
            'created_at' => $this->getAttribute('created_at')?->toIso8601String(),
            'updated_at' => $this->getAttribute('updated_at')?->toIso8601String(),
        ];
    }
}
