<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddLastErrorToPluginsTable extends AbstractMigration
{
    public function up(): void
    {
        if ($this->hasTable('plugins') && !$this->table('plugins')->hasColumn('last_error')) {
            $this->table('plugins')->addColumn('last_error', 'text', ['null' => true])->update();
        }
    }

    public function down(): void
    {
        if ($this->hasTable('plugins') && $this->table('plugins')->hasColumn('last_error')) {
            $this->table('plugins')->removeColumn('last_error')->update();
        }
    }
}
