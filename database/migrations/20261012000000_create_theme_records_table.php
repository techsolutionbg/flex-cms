<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateThemeRecordsTable extends AbstractMigration
{
    public function up(): void
    {
        if ($this->hasTable('theme_records')) {
            return;
        }

        $this->table('theme_records')
            ->addColumn('theme_id', 'string', ['limit' => 190])
            ->addColumn('resource', 'string', ['limit' => 40])
            ->addColumn('title', 'string', ['limit' => 190])
            ->addColumn('slug', 'string', ['limit' => 190])
            ->addColumn('summary', 'text', ['null' => true])
            ->addColumn('content', 'text', ['null' => true])
            ->addColumn('status', 'string', ['limit' => 20, 'default' => 'draft'])
            ->addColumn('featured_media_id', 'integer', ['signed' => false, 'null' => true])
            ->addColumn('published_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addColumn('updated_at', 'datetime')
            ->addColumn('deleted_at', 'datetime', ['null' => true])
            ->addIndex(['theme_id', 'resource', 'slug'], ['unique' => true, 'name' => 'theme_records_slug_unique'])
            ->addIndex(['theme_id', 'resource', 'status'], ['name' => 'theme_records_status_index'])
            ->addForeignKey('featured_media_id', 'media', 'id', ['delete' => 'RESTRICT'])
            ->create();
    }

    public function down(): void
    {
        if ($this->hasTable('theme_records')) {
            $this->table('theme_records')->drop()->save();
        }
    }
}
