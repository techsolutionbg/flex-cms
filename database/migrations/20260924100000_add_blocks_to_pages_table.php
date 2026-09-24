<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddBlocksToPagesTable extends AbstractMigration
{
    public function up(): void
    {
        if ($this->hasTable('pages') && !$this->table('pages')->hasColumn('blocks')) {
            $this->table('pages')->addColumn('blocks', 'text', ['null' => true])->update();
        }
    }

    public function down(): void
    {
        if ($this->hasTable('pages') && $this->table('pages')->hasColumn('blocks')) {
            $this->table('pages')->removeColumn('blocks')->update();
        }
    }
}
