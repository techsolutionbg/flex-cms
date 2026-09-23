<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddParentIdToPagesTable extends AbstractMigration
{
    public function up(): void
    {
        if (!$this->hasTable('pages')) {
            return;
        }

        $table = $this->table('pages');
        if (!$table->hasColumn('parent_id')) {
            $table
                ->addColumn('parent_id', 'biginteger', ['signed' => false, 'null' => true])
                ->addIndex(['parent_id'], ['name' => 'pages_parent_id_index'])
                ->update();
        }
    }

    public function down(): void
    {
        if (!$this->hasTable('pages')) {
            return;
        }

        $table = $this->table('pages');
        if ($table->hasColumn('parent_id')) {
            $table->removeIndexByName('pages_parent_id_index')->removeColumn('parent_id')->update();
        }
    }
}
