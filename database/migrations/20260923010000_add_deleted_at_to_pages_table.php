<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddDeletedAtToPagesTable extends AbstractMigration
{
    public function up(): void
    {
        if (!$this->hasTable('pages')) return;
        $table = $this->table('pages');
        if (!$table->hasColumn('deleted_at')) {
            $table->addColumn('deleted_at', 'datetime', ['null' => true])
                ->addIndex(['deleted_at'], ['name' => 'pages_deleted_at_index'])
                ->update();
        }
    }

    public function down(): void
    {
        if (!$this->hasTable('pages')) return;
        $table = $this->table('pages');
        if ($table->hasColumn('deleted_at')) {
            $table->removeIndexByName('pages_deleted_at_index')->removeColumn('deleted_at')->update();
        }
    }
}
