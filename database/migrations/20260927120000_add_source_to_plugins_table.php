<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddSourceToPluginsTable extends AbstractMigration
{
    public function up(): void
    {
        if ($this->hasTable('plugins') && !$this->table('plugins')->hasColumn('source')) {
            $this->table('plugins')
                ->addColumn('source', 'string', ['limit' => 20, 'default' => 'local'])
                ->update();
        }
    }

    public function down(): void
    {
        if ($this->hasTable('plugins') && $this->table('plugins')->hasColumn('source')) {
            $this->table('plugins')->removeColumn('source')->update();
        }
    }
}
