<?php

declare(strict_types=1);

namespace Flex\Tests\Pages;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Pages\PageRepository;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;

final class PageSlugUniquenessTest extends TestCase
{
    private DatabaseManager $database;
    private PageRepository $pages;

    protected function setUp(): void
    {
        $config = new ConfigurationRepository([
            'database' => [
                'default' => 'sqlite',
                'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']],
            ],
        ]);
        $this->database = new DatabaseManager($config);
        $this->database->schema()->create('pages', static function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 190)->unique();
            $table->string('title', 190);
            $table->text('content')->nullable();
            $table->string('status', 30)->default('draft');
            $table->unsignedBigInteger('author_id')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->text('settings')->nullable();
            $table->text('blocks')->nullable();
            $table->unsignedBigInteger('featured_media_id')->nullable();
            $table->dateTime('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
        $this->pages = new PageRepository();
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
    }

    public function testSlugExistsIncludesTrashedPages(): void
    {
        $connection = $this->database->connection();
        $connection->table('pages')->insert([
            'id' => 1,
            'slug' => 'home',
            'title' => 'Old home',
            'status' => 'draft',
            'created_at' => gmdate('Y-m-d H:i:s'),
            'updated_at' => gmdate('Y-m-d H:i:s'),
            'deleted_at' => gmdate('Y-m-d H:i:s'),
        ]);
        $connection->table('pages')->insert([
            'id' => 17,
            'slug' => 'start',
            'title' => 'Начало',
            'status' => 'published',
            'created_at' => gmdate('Y-m-d H:i:s'),
            'updated_at' => gmdate('Y-m-d H:i:s'),
            'deleted_at' => null,
        ]);

        self::assertTrue($this->pages->slugExists('home', 17));
        self::assertFalse($this->pages->slugExists('start', 17));
    }
}
