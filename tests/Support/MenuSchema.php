<?php

declare(strict_types=1);

namespace Flex\Tests\Support;

use Flex\Database\DatabaseManager;
use Illuminate\Database\Schema\Blueprint;

final class MenuSchema
{
    public static function create(DatabaseManager $database): void
    {
        $schema = $database->schema();
        $schema->create('pages', static function (Blueprint $table): void {
            $table->increments('id');
            $table->string('title');
            $table->string('slug');
            $table->string('status');
            $table->integer('parent_id')->nullable();
            $table->text('settings')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
        $schema->create('menus', static function (Blueprint $table): void {
            $table->increments('id');
            $table->string('name');
            $table->string('slug')->unique();
            $table->integer('version');
            $table->string('status')->default('active');
            $table->softDeletes();
            $table->timestamps();
        });
        $schema->create('menu_items', static function (Blueprint $table): void {
            $table->increments('id');
            $table->integer('menu_id');
            $table->string('item_key');
            $table->string('parent_key')->nullable();
            $table->integer('position');
            $table->string('label');
            $table->string('type');
            $table->integer('page_id')->nullable();
            $table->string('url')->nullable();
            $table->boolean('new_tab');
            $table->string('seo_title')->default('');
            $table->string('aria_label')->default('');
            $table->string('css_class')->default('');
            $table->string('rel')->default('');
            $table->unique(['menu_id', 'item_key']);
            $table->foreign('menu_id')->references('id')->on('menus')->cascadeOnDelete();
            $table->foreign('page_id')->references('id')->on('pages')->nullOnDelete();
        });
        $schema->create('theme_menu_assignments', static function (Blueprint $table): void {
            $table->increments('id');
            $table->string('theme_id');
            $table->string('location');
            $table->integer('menu_id');
            $table->unique(['theme_id', 'location']);
            $table->foreign('menu_id')->references('id')->on('menus')->cascadeOnDelete();
        });
    }
}
