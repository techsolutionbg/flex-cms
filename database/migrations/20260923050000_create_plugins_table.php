<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreatePluginsTable extends AbstractMigration
{
    public function up(): void
    {
        if ($this->hasTable('plugins')) {
            return;
        }

        $this->table('plugins', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 190, 'null' => false])
            ->addColumn('name', 'string', ['limit' => 190])
            ->addColumn('version', 'string', ['limit' => 80])
            ->addColumn('description', 'text', ['null' => true])
            ->addColumn('entrypoint', 'string', ['limit' => 255])
            ->addColumn('path', 'string', ['limit' => 500])
            ->addColumn('status', 'string', ['limit' => 30, 'default' => 'inactive'])
            ->addColumn('manifest', 'text', ['null' => true])
            ->addColumn('last_error', 'text', ['null' => true])
            ->addColumn('installed_at', 'datetime', ['null' => true])
            ->addColumn('activated_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addColumn('updated_at', 'datetime')
            ->addIndex(['status'], ['name' => 'plugins_status_index'])
            ->create();
    }

    public function down(): void
    {
        if ($this->hasTable('plugins')) {
            $this->table('plugins')->drop()->save();
        }
    }
}
