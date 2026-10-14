<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddAdminLocaleToUsers extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('users');
        if (!$table->hasColumn('admin_locale')) {
            $table->addColumn('admin_locale', 'string', ['limit' => 16, 'default' => 'bg']);
            $table->save();
        }
    }

    public function down(): void
    {
        if ($this->hasTable('users')) {
            $table = $this->table('users');
            if ($table->hasColumn('admin_locale')) {
                $table->removeColumn('admin_locale');
                $table->save();
            }
        }
    }
}
