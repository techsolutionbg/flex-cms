<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateMediaTable extends AbstractMigration
{
    public function change(): void
    {
        $this->table('media')
            ->addColumn('original_name', 'string', ['limit' => 255])
            ->addColumn('path', 'string', ['limit' => 255])
            ->addColumn('thumbnail_path', 'string', ['limit' => 255, 'null' => true])
            ->addColumn('mime', 'string', ['limit' => 100])
            ->addColumn('size', 'biginteger', ['signed' => false])
            ->addColumn('width', 'integer', ['null' => true])
            ->addColumn('height', 'integer', ['null' => true])
            ->addColumn('uploaded_by', 'integer', ['signed' => false])
            ->addColumn('title', 'string', ['limit' => 255])
            ->addColumn('alt', 'string', ['limit' => 255, 'default' => ''])
            ->addColumn('caption', 'text', ['default' => ''])
            ->addColumn('description', 'text', ['default' => ''])
            ->addColumn('deleted_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addColumn('updated_at', 'datetime')
            ->addIndex(['path'], ['unique' => true])
            ->addIndex(['deleted_at', 'created_at'])->create();
    }
}
