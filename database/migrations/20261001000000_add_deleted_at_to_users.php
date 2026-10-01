<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddDeletedAtToUsers extends AbstractMigration
{
    public function up(): void
    {
        if ($this->hasTable('users') && !$this->table('users')->hasColumn('deleted_at')) {
            $this->table('users')
                ->addColumn('deleted_at', 'datetime', ['null' => true])
                ->addIndex(['deleted_at'], ['name' => 'users_deleted_at_index'])
                ->update();
        }
    }

    public function down(): void
    {
        if ($this->hasTable('users') && $this->table('users')->hasColumn('deleted_at')) {
            $this->table('users')->removeColumn('deleted_at')->update();
        }
    }
}
