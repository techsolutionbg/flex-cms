<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddPluginPermissionsToPluginsTable extends AbstractMigration
{
    public function up(): void
    {
        if (!$this->hasTable('plugins')) {
            return;
        }

        $table = $this->table('plugins');
        if (!$table->hasColumn('requested_permissions')) {
            $table->addColumn('requested_permissions', 'text', ['null' => true]);
        }
        if (!$table->hasColumn('approved_permissions')) {
            $table->addColumn('approved_permissions', 'text', ['null' => true]);
        }
        $table->update();
    }

    public function down(): void
    {
        if (!$this->hasTable('plugins')) {
            return;
        }

        $table = $this->table('plugins');
        if ($table->hasColumn('requested_permissions')) {
            $table->removeColumn('requested_permissions');
        }
        if ($table->hasColumn('approved_permissions')) {
            $table->removeColumn('approved_permissions');
        }
        $table->update();
    }
}
