<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreatePagesTable extends AbstractMigration
{
    public function up(): void
    {
        if ($this->hasTable('pages')) {
            return;
        }

        $this->table('pages')
            ->addColumn('author_id', 'biginteger', ['signed' => false, 'null' => true])
            ->addColumn('title', 'string', ['limit' => 190])
            ->addColumn('slug', 'string', ['limit' => 190])
            ->addColumn('content', 'text', ['null' => true])
            ->addColumn('status', 'string', ['limit' => 20, 'default' => 'draft'])
            ->addColumn('published_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addColumn('updated_at', 'datetime')
            ->addIndex(['slug'], ['unique' => true, 'name' => 'pages_slug_unique'])
            ->addIndex(['status'], ['name' => 'pages_status_index'])
            ->create();
    }

    public function down(): void
    {
        if ($this->hasTable('pages')) {
            $this->table('pages')->drop()->save();
        }
    }
}
