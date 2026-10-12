<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Extension\V1\Time;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class ThemeRecord extends Model
{
    use SoftDeletes;

    protected $table = 'theme_records';

    protected $fillable = ['theme_id', 'resource', 'title', 'slug', 'summary', 'content', 'status', 'featured_media_id', 'published_at'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'featured_media_id' => 'integer',
            'published_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
            'deleted_at' => 'immutable_datetime',
        ];
    }

    /** @param array<string, mixed>|null $media */
    public function toPublicArray(?array $media = null): array
    {
        $record = [
            'id' => (int) $this->getAttribute('id'),
            'theme_id' => (string) $this->getAttribute('theme_id'),
            'resource' => (string) $this->getAttribute('resource'),
            'title' => (string) $this->getAttribute('title'),
            'slug' => (string) $this->getAttribute('slug'),
            'summary' => (string) ($this->getAttribute('summary') ?? ''),
            'content' => (string) ($this->getAttribute('content') ?? ''),
            'status' => (string) $this->getAttribute('status'),
            'featured_media_id' => $this->getAttribute('featured_media_id') === null ? null : (int) $this->getAttribute('featured_media_id'),
            'published_at' => Time::iso($this->getAttribute('published_at')),
            'created_at' => Time::iso($this->getAttribute('created_at')),
            'updated_at' => Time::iso($this->getAttribute('updated_at')),
            'deleted_at' => Time::iso($this->getAttribute('deleted_at')),
        ];
        if ($media !== null) {
            $record['featured_media'] = $media === [] ? null : $media;
        }

        return $record;
    }
}
